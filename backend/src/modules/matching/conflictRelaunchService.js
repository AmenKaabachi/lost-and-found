
import mongoose from 'mongoose';

import ConflitMatching from '../../models/ConflitMatching.js';
import Correspondance from '../../models/Correspondance.js';
import Declaration from '../../models/Declaration.js';

import {
  TypeConflitMatching,
  StatutConflitMatching
} from '../../models/enums.js';

import { calculateMatchScore } from './scoringService.js';
import { getMatchingSettings } from './settingsService.js';

const PROFILE_FIELDS = 'nomEtablissement lieuResidence moyenTransport';

/**
 * Convertit une déclaration en objet indépendant du document Mongoose.
 */
const prepareDeclaration = (declaration) => {
  return declaration.toObject();
};

/**
 * Ajoute les réponses complémentaires au texte de la déclaration
 * appartenant au destinataire de chaque demande.
 *
 * La déclaration originale en base n'est jamais modifiée.
 */
const addSupplementaryInformation = (
  declaration,
  informations,
  declarantId
) => {
  const relevantAnswers = informations
    .filter((information) => {
      return (
        typeof information.reponse === 'string' &&
        information.reponse.trim().length > 0 &&
        information.destinataireId?.toString() === declarantId.toString()
      );
    })
    .map((information) => information.reponse.trim());

  if (relevantAnswers.length === 0) {
    return declaration;
  }

  return {
    ...declaration,
    description: [
      declaration.description || '',
      ...relevantAnswers
    ].filter(Boolean).join('. ')
  };
};

/**
 * Recharge une déclaration avec le profil de son déclarant.
 */
const loadDeclaration = async (declarationId) => {
  const declaration = await Declaration.findOne({
    _id: declarationId,
    isDeleted: false
  }).populate('declarantId', PROFILE_FIELDS);

  if (!declaration) {
    throw new Error(
      `Déclaration introuvable : ${declarationId}`
    );
  }

  if (!declaration.declarantId) {
    throw new Error(
      `Déclarant introuvable : ${declarationId}`
    );
  }

  return declaration;
};

/**
 * Relance le calcul des correspondances d'un conflit.
 *
 * Important :
 * - aucune réponse utilisateur n'est supprimée ;
 * - aucun statut de correspondance n'est automatiquement validé ;
 * - aucun conflit n'est automatiquement résolu ;
 * - les réponses complémentaires influencent le texte NLP.
 */
export const relaunchConflictMatching = async (
  conflictId,
  adminId,
  motif
) => {
  if (!mongoose.isValidObjectId(conflictId)) {
    throw new Error('Identifiant de conflit invalide.');
  }

  if (!mongoose.isValidObjectId(adminId)) {
    throw new Error('Identifiant administrateur invalide.');
  }

  const conflict = await ConflitMatching.findById(conflictId);

  if (!conflict) {
    throw new Error('Conflit introuvable.');
  }

  if (conflict.statut === StatutConflitMatching.RESOLU) {
    throw new Error('Ce conflit est déjà résolu.');
  }

  const informations = conflict.informationsSupplementaires || [];

  // Une réponse vide ou composée uniquement d'espaces
  // est considérée comme une information non renseignée.
  const pendingInformation = informations.some(
    (information) =>
      typeof information.reponse !== 'string' ||
      !information.reponse.trim()
  );

  if (pendingInformation) {
    throw new Error(
      'Toutes les demandes d’informations doivent recevoir une réponse avant la relance.'
    );
  }

  if (
    !Array.isArray(conflict.correspondanceIds) ||
    conflict.correspondanceIds.length === 0
  ) {
    throw new Error(
      'Ce conflit ne contient aucune correspondance à recalculer.'
    );
  }

  const recalculatedMatches = [];
  const settings = await getMatchingSettings();

  // Première phase : recalculer tous les scores.
  // Aucune modification en base n'est effectuée pendant cette phase.
  for (const correspondenceId of conflict.correspondanceIds) {
    const correspondence = await Correspondance.findById(
      correspondenceId
    );

    if (!correspondence) {
      throw new Error(
        `Correspondance introuvable : ${correspondenceId}`
      );
    }

    const lostDocument = await loadDeclaration(
      correspondence.declarationPerdueId
    );

    const foundDocument = await loadDeclaration(
      correspondence.declarationTrouveeId
    );

    const lostDeclarantId = lostDocument.declarantId._id;
    const foundDeclarantId = foundDocument.declarantId._id;

    let lost = prepareDeclaration(lostDocument);
    let found = prepareDeclaration(foundDocument);

    // Ajouter les réponses complémentaires à la bonne déclaration.
    lost = addSupplementaryInformation(
      lost,
      informations,
      lostDeclarantId
    );

    found = addSupplementaryInformation(
      found,
      informations,
      foundDeclarantId
    );

    const scoreResult = await calculateMatchScore(lost, found, settings);

    const score = Number(scoreResult.score);

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(
        `Score invalide pour la correspondance ${correspondenceId}.`
      );
    }

    recalculatedMatches.push({
      correspondence,
      score,
      methode: scoreResult.method || 'AUTO_NLP',
      confidence: scoreResult.confidence,
      breakdown: scoreResult.breakdown
    });
  }

  // Deuxième phase : enregistrer les nouveaux scores.
  for (const match of recalculatedMatches) {
    match.correspondence.score = match.score;
    match.correspondence.methode = match.methode;

    // Ne pas modifier le statut ni les réponses des utilisateurs.
    await match.correspondence.save();
  }

  recalculatedMatches.sort((a, b) => b.score - a.score);

  const bestScore = recalculatedMatches[0].score;

  const equalBestMatches = recalculatedMatches.filter(
    (match) => Math.abs(match.score - bestScore) <= 0.01
  );

  const hasEqualScores = equalBestMatches.length > 1;

  // Une relance ne résout jamais automatiquement un conflit.
  conflict.statut = StatutConflitMatching.EN_ATTENTE;
  conflict.traiteParId = adminId;

  conflict.historiqueRelances.push({
    adminId,
    dateRelance: new Date(),
    motif: motif || 'Relance du moteur de matching'
  });

  await conflict.save();

  return {
    success: true,
    conflictId: conflict._id,
    conflictType: conflict.type,
    conflictResolved: false,
    hasEqualScores,
    bestScore,
    equalBestMatches: equalBestMatches.map((match) => ({
      correspondanceId: match.correspondence._id,
      score: match.score
    })),
    recalculatedMatches: recalculatedMatches.map((match) => ({
      correspondanceId: match.correspondence._id,
      score: match.score,
      confidence: match.confidence,
      methode: match.methode,
      breakdown: match.breakdown,
      statut: match.correspondence.statut
    })),
    message: hasEqualScores
      ? 'Les scores restent équivalents. Le conflit nécessite des informations ou un examen complémentaire.'
      : conflict.type === TypeConflitMatching.DESACCORD_UTILISATEURS
        ? 'Les scores ont été recalculés, mais le désaccord entre utilisateurs reste à traiter.'
        : 'Les scores ont été recalculés. Aucune décision automatique de propriété n’a été prise.'
  };
};
