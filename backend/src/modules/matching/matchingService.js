
import mongoose from 'mongoose';

import Declaration from '../../models/Declaration.js';
import Correspondance from '../../models/Correspondance.js';
import Notification from '../../models/Notification.js';

import {
  TypeDeclaration,
  StatutDeclaration,
  StatutCorrespondance
} from '../../models/enums.js';

import { calculateMatchScore } from './scoringService.js';
import { getMatchingSettings } from './settingsService.js';

import {
  detectEqualScoreConflictForFoundDeclaration
} from './conflictService.js';

const PROFILE_FIELDS = 'nomEtablissement lieuResidence moyenTransport';

const createMatchNotifications = async (correspondence, lost, found) => {
  const notifications = [
    {
      destinataireId: lost.declarantId._id || lost.declarantId,
      type: 'NOUVELLE_CORRESPONDANCE',
      titre: 'Nouvelle correspondance proposée',
      contenu: 'Une déclaration trouvée pourrait correspondre à votre objet perdu.'
    },
    {
      destinataireId: found.declarantId._id || found.declarantId,
      type: 'NOUVELLE_CORRESPONDANCE',
      titre: 'Nouvelle correspondance proposée',
      contenu: 'Une déclaration perdue pourrait correspondre à votre objet trouvé.'
    }
  ];

  await Promise.all(notifications.map(async (notification) => {
    try {
      await Notification.findOneAndUpdate(
        {
          destinataireId: notification.destinataireId,
          referenceId: correspondence._id,
          type: notification.type
        },
        {
          $setOnInsert: {
            ...notification,
            referenceId: correspondence._id,
            referenceType: 'Correspondance',
            lue: false
          }
        },
        {
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
    }
  }));
};

/**
 * Détermine les identifiants dans l'ordre PERDU puis TROUVE.
 */
const getCorrespondenceIds = (declarationA, declarationB) => {
  if (declarationA.type === TypeDeclaration.PERDU) {
    return {
      declarationPerdueId: declarationA._id,
      declarationTrouveeId: declarationB._id
    };
  }

  return {
    declarationPerdueId: declarationB._id,
    declarationTrouveeId: declarationA._id
  };
};

/**
 * Vérifie si une correspondance peut être actualisée.
 */
const canUpdateAutomatically = (correspondence) => {
  return correspondence.statut === StatutCorrespondance.PROPOSEE;
};

/**
 * Met à jour uniquement une proposition.
 */
const updateProposedCorrespondence = async (
  correspondence,
  scoreResult
) => {
  return Correspondance.findOneAndUpdate(
    {
      _id: correspondence._id,
      statut: StatutCorrespondance.PROPOSEE
    },
    {
      $set: {
        score: scoreResult.score,
        methode: scoreResult.method || 'AUTO_NLP'
      }
    },
    {
      new: true,
      runValidators: true
    }
  );
};

/**
 * Construit le résultat d'une correspondance.
 */
const buildMatchResult = (correspondence, scoreResult) => ({
  correspondanceId: correspondence._id,
  declarationPerdueId: correspondence.declarationPerdueId,
  declarationTrouveeId: correspondence.declarationTrouveeId,
  score: correspondence.score,
  confidence: scoreResult.confidence,
  methode: correspondence.methode,
  breakdown: scoreResult.breakdown,
  degradedCriteria: scoreResult.degradedCriteria
});

/**
 * Lance le matching pour une déclaration.
 */
export const runMatchingForDeclaration = async (declarationId) => {
  if (!mongoose.Types.ObjectId.isValid(declarationId)) {
    throw new Error('Identifiant de déclaration invalide.');
  }

  const declaration = await Declaration.findOne({
    _id: declarationId,
    isDeleted: false
  }).populate('declarantId', PROFILE_FIELDS);

  if (!declaration) {
    throw new Error('Déclaration introuvable.');
  }

  if (declaration.statut !== StatutDeclaration.ACTIVE) {
    return {
      success: true,
      message: 'La déclaration n’est pas active.',
      declarationId,
      evaluatedCandidates: 0,
      savedMatches: 0,
      skippedBelowThreshold: 0,
      skippedExistingMatches: 0,
      detectedConflicts: [],
      matches: []
    };
  }

  if (!declaration.declarantId) {
    throw new Error('Déclarant introuvable pour cette déclaration.');
  }

  const settings = await getMatchingSettings();

  const declarantId = declaration.declarantId._id
    ? declaration.declarantId._id
    : declaration.declarantId;

  const oppositeType =
    declaration.type === TypeDeclaration.PERDU
      ? TypeDeclaration.TROUVE
      : declaration.type === TypeDeclaration.TROUVE
        ? TypeDeclaration.PERDU
        : null;

  if (!oppositeType) {
    throw new Error('Type de déclaration invalide.');
  }

  const candidates = await Declaration.find({
    _id: { $ne: declaration._id },
    declarantId: { $ne: declarantId },
    type: oppositeType,
    statut: StatutDeclaration.ACTIVE,
    isDeleted: false
  }).populate('declarantId', PROFILE_FIELDS);

  const matches = [];

  let savedMatches = 0;
  let skippedBelowThreshold = 0;
  let skippedExistingMatches = 0;

  // Comparer la déclaration principale à chaque candidate.
  for (const candidate of candidates) {
    const {
      declarationPerdueId,
      declarationTrouveeId
    } = getCorrespondenceIds(declaration, candidate);

    const existingCorrespondence = await Correspondance.findOne({
      declarationPerdueId,
      declarationTrouveeId
    });

    // Ne jamais modifier une correspondance qui n'est plus PROPOSEE.
    if (
      existingCorrespondence &&
      !canUpdateAutomatically(existingCorrespondence)
    ) {
      skippedExistingMatches++;
      continue;
    }

    const scoreResult = await calculateMatchScore(
      declaration,
      candidate,
      settings
    );

    const score = Number(scoreResult.score);

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(
        `Score invalide pour la déclaration ${candidate._id}.`
      );
    }

    if (!existingCorrespondence && score < settings.minimumMatchScore) {
      skippedBelowThreshold++;
      continue;
    }

    let correspondence;

    if (existingCorrespondence) {
      correspondence = await updateProposedCorrespondence(
        existingCorrespondence,
        { ...scoreResult, score }
      );

      if (!correspondence) {
        skippedExistingMatches++;
        continue;
      }
    } else {
      try {
        correspondence = await Correspondance.create({
          declarationPerdueId,
          declarationTrouveeId,
          score,
          methode: scoreResult.method || 'AUTO_NLP',
          statut: StatutCorrespondance.PROPOSEE
        });
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }

        const concurrentCorrespondence = await Correspondance.findOne({
          declarationPerdueId,
          declarationTrouveeId
        });

        if (
          !concurrentCorrespondence ||
          !canUpdateAutomatically(concurrentCorrespondence)
        ) {
          skippedExistingMatches++;
          continue;
        }

        correspondence = await updateProposedCorrespondence(
          concurrentCorrespondence,
          { ...scoreResult, score }
        );

        if (!correspondence) {
          skippedExistingMatches++;
          continue;
        }
      }
    }

    savedMatches++;

    const lostDeclaration = declarationPerdueId.toString() === declaration._id.toString()
      ? declaration
      : candidate;
    const foundDeclaration = declarationTrouveeId.toString() === declaration._id.toString()
      ? declaration
      : candidate;
    await createMatchNotifications(
      correspondence,
      lostDeclaration,
      foundDeclaration
    );

    matches.push(buildMatchResult(correspondence, scoreResult));
  }

  matches.sort((a, b) => b.score - a.score);

  // Détecter les égalités pour les déclarations TROUVE concernées.
  // Cela permet de détecter la compétition même lorsque la déclaration
  // principale est de type PERDU.
  const foundDeclarationIds = [
    ...new Set(
      candidates
        .filter(candidate => candidate.type === TypeDeclaration.TROUVE)
        .map(candidate => candidate._id.toString())
        .concat(
          declaration.type === TypeDeclaration.TROUVE
            ? [declaration._id.toString()]
            : []
        )
    )
  ];

  const detectedConflicts = [];

  for (const foundDeclarationId of foundDeclarationIds) {
    const result = await detectEqualScoreConflictForFoundDeclaration(
      foundDeclarationId
    );

    if (result.hasConflict) {
      detectedConflicts.push({
        declarationTrouveeId: foundDeclarationId,
        conflictId: result.conflict?._id,
        bestScore: result.bestScore
      });
    }
  }

  const topScore = matches.length > 0
    ? matches[0].score
    : null;

  const equalTopMatches = topScore === null
    ? []
    : matches.filter(
        match => Math.abs(match.score - topScore) < 0.01
      );

  return {
    success: true,
    declarationId: declaration._id,
    declarationType: declaration.type,
    evaluatedCandidates: candidates.length,
    savedMatches,
    skippedBelowThreshold,
    skippedExistingMatches,
    topScore,
    hasEqualTopScores: equalTopMatches.length > 1,
    equalTopMatches,
    detectedConflicts,
    matches
  };
};
