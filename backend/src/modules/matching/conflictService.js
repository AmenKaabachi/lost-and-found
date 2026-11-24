
import mongoose from 'mongoose';

import Correspondance from '../../models/Correspondance.js';
import ConflitMatching from '../../models/ConflitMatching.js';

import {
  StatutCorrespondance,
  StatutReponseCorrespondance,
  DecisionFinaleCorrespondance,
  TypeConflitMatching,
  StatutConflitMatching
} from '../../models/enums.js';

const SCORE_TOLERANCE = 0.01;

/**
 * Détecte les égalités entre les meilleures propositions
 * d'une même déclaration trouvée.
 *
 * Les correspondances déjà rattachées à un conflit actif
 * restent prises en compte même avec le statut EN_CONFLIT.
 */
export const detectEqualScoreConflictForFoundDeclaration = async (
  declarationTrouveeId
) => {
  if (!mongoose.isValidObjectId(declarationTrouveeId)) {
    throw new Error('Identifiant de déclaration trouvée invalide.');
  }

  // Rechercher un éventuel conflit actif.
  const existingConflict = await ConflitMatching.findOne({
    type: TypeConflitMatching.EGALITE_SCORE,
    declarationTrouveeId,
    statut: { $ne: StatutConflitMatching.RESOLU }
  });

  // Récupérer les nouvelles propositions.
  const proposedCorrespondences = await Correspondance.find({
    declarationTrouveeId,
    statut: StatutCorrespondance.PROPOSEE
  });

  // Récupérer les anciennes correspondances du conflit actif.
  let existingConflictCorrespondences = [];

  const existingConflictIds = Array.isArray(
    existingConflict?.correspondanceIds
  )
    ? existingConflict.correspondanceIds
    : [];

  if (existingConflictIds.length > 0) {
    existingConflictCorrespondences = await Correspondance.find({
      _id: { $in: existingConflictIds },
      declarationTrouveeId,
      statut: StatutCorrespondance.EN_CONFLIT
    });
  }

  // Fusionner les correspondances sans doublons.
  const correspondencesById = new Map();

  for (const correspondence of [
    ...existingConflictCorrespondences,
    ...proposedCorrespondences
  ]) {
    correspondencesById.set(
      correspondence._id.toString(),
      correspondence
    );
  }

  const correspondences = [...correspondencesById.values()]
    .sort((a, b) => b.score - a.score);

  if (correspondences.length < 2) {
    if (existingConflict) {
      return {
        success: true,
        hasConflict: true,
        reason: 'Un conflit actif existe déjà et reste à examiner.',
        bestScore: correspondences[0]?.score ?? null,
        equalBestMatches: [],
        conflict: existingConflict
      };
    }

    return {
      success: true,
      hasConflict: false,
      reason: 'Pas assez de propositions concurrentes.',
      bestScore: correspondences[0]?.score ?? null,
      equalBestMatches: [],
      conflict: null
    };
  }

  const bestScore = correspondences[0].score;

  const equalBestMatches = correspondences.filter(
    correspondence =>
      Math.abs(correspondence.score - bestScore) <= SCORE_TOLERANCE
  );

  if (equalBestMatches.length < 2) {
    // Ne jamais fermer automatiquement un conflit existant.
    if (existingConflict) {
      return {
        success: true,
        hasConflict: true,
        reason:
          'Le conflit actif reste à examiner malgré la nouvelle répartition des scores.',
        bestScore,
        equalBestMatches: [],
        conflict: existingConflict
      };
    }

    return {
      success: true,
      hasConflict: false,
      bestScore,
      equalBestMatches: [],
      conflict: null
    };
  }

  const correspondenceIds = equalBestMatches.map(
    correspondence => correspondence._id
  );

  let conflict = existingConflict;

  if (conflict) {
    const knownIds = new Set(
      (conflict.correspondanceIds || []).map(id => id.toString())
    );

    const newIds = correspondenceIds.filter(
      id => !knownIds.has(id.toString())
    );

    if (newIds.length > 0) {
      conflict.correspondanceIds.push(...newIds);
      await conflict.save();
    }
  } else {
    // Nouvelle vérification pour limiter les doublons concurrents.
    conflict = await ConflitMatching.findOne({
      type: TypeConflitMatching.EGALITE_SCORE,
      declarationTrouveeId,
      statut: { $ne: StatutConflitMatching.RESOLU }
    });

    if (conflict) {
      const knownIds = new Set(
        (conflict.correspondanceIds || []).map(id => id.toString())
      );

      const newIds = correspondenceIds.filter(
        id => !knownIds.has(id.toString())
      );

      if (newIds.length > 0) {
        conflict.correspondanceIds.push(...newIds);
        await conflict.save();
      }
    } else {
      conflict = await ConflitMatching.create({
        type: TypeConflitMatching.EGALITE_SCORE,
        statut: StatutConflitMatching.EN_ATTENTE,
        declarationTrouveeId,
        correspondanceIds
      });
    }
  }

  // Passer les meilleures correspondances en conflit.
  await Correspondance.updateMany(
    { _id: { $in: correspondenceIds } },
    {
      $set: {
        statut: StatutCorrespondance.EN_CONFLIT
      }
    }
  );

  return {
    success: true,
    hasConflict: true,
    bestScore,
    equalBestMatches,
    conflict
  };
};

/**
 * Détecte une contradiction entre les réponses initiales.
 */
const hasInitialDisagreement = (correspondence) => {
  const lost = correspondence.reponseDeclarantPerdu?.statut;
  const found = correspondence.reponseDeclarantTrouve?.statut;

  return (
    (lost === StatutReponseCorrespondance.ACCEPTEE &&
      found === StatutReponseCorrespondance.REFUSEE) ||
    (lost === StatutReponseCorrespondance.REFUSEE &&
      found === StatutReponseCorrespondance.ACCEPTEE)
  );
};

/**
 * Détecte une contradiction entre les décisions finales.
 */
const hasFinalDisagreement = (correspondence) => {
  const lost = correspondence.decisionFinaleDeclarantPerdu?.statut;
  const found = correspondence.decisionFinaleDeclarantTrouve?.statut;

  return (
    (lost === DecisionFinaleCorrespondance.CONFIRMEE &&
      found === DecisionFinaleCorrespondance.REJETEE) ||
    (lost === DecisionFinaleCorrespondance.REJETEE &&
      found === DecisionFinaleCorrespondance.CONFIRMEE)
  );
};

/**
 * Enregistre un désaccord entre les déclarants.
 */
export const registerUserDisagreement = async (correspondanceId) => {
  if (!mongoose.isValidObjectId(correspondanceId)) {
    throw new Error('Identifiant de correspondance invalide.');
  }

  const correspondence = await Correspondance.findById(correspondanceId);

  if (!correspondence) {
    throw new Error('Correspondance introuvable.');
  }

  const finalStatuses = [
    StatutCorrespondance.VALIDEE,
    StatutCorrespondance.REJETEE,
    StatutCorrespondance.ANNULEE
  ];

  if (finalStatuses.includes(correspondence.statut)) {
    return {
      success: true,
      hasConflict: false,
      reason: 'La correspondance possède déjà un statut définitif.',
      conflict: null
    };
  }

  const disagreementDetected =
    hasInitialDisagreement(correspondence) ||
    hasFinalDisagreement(correspondence);

  if (!disagreementDetected) {
    return {
      success: true,
      hasConflict: false,
      reason: 'Aucun désaccord entre les déclarants.',
      conflict: null
    };
  }

  // Rechercher un conflit actif existant.
  let conflict = await ConflitMatching.findOne({
    type: TypeConflitMatching.DESACCORD_UTILISATEURS,
    correspondanceIds: correspondence._id,
    statut: { $ne: StatutConflitMatching.RESOLU }
  });

  if (conflict) {
    return {
      success: true,
      hasConflict: true,
      reason: 'Un conflit actif existe déjà.',
      conflict
    };
  }

  correspondence.statut = StatutCorrespondance.EN_CONFLIT;
  await correspondence.save();

  conflict = await ConflitMatching.create({
    type: TypeConflitMatching.DESACCORD_UTILISATEURS,
    statut: StatutConflitMatching.EN_ATTENTE,
    declarationPerdueId: correspondence.declarationPerdueId,
    declarationTrouveeId: correspondence.declarationTrouveeId,
    correspondanceIds: [correspondence._id]
  });

  return {
    success: true,
    hasConflict: true,
    conflict
  };
};
