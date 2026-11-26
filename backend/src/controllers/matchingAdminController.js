import mongoose from 'mongoose';

import ConflitMatching from '../models/ConflitMatching.js';
import Correspondance from '../models/Correspondance.js';
import Declaration from '../models/Declaration.js';
import JournalAudit from '../models/JournalAudit.js';
import MatchingSettings from '../models/MatchingSettings.js';
import MatchingState from '../models/MatchingState.js';
import {
  StatutConflitMatching,
  StatutCorrespondance,
  StatutDeclaration
} from '../models/enums.js';
import { getMatchingSettings, saveMatchingSettings } from '../modules/matching/settingsService.js';
import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

const queueDeclarationMatching = async (declarationId) => {
  const now = new Date();
  try {
    const state = await MatchingState.findOneAndUpdate(
      {
        declarationId,
        $or: [
          { lockUntil: null },
          { lockUntil: { $exists: false } },
          { lockUntil: { $lte: now } }
        ]
      },
      {
        $set: {
          status: 'EN_ATTENTE',
          processedUpdatedAt: null,
          lockUntil: null,
          lastError: null
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    return Boolean(state);
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const currentState = await MatchingState.findOne({ declarationId })
      .select('lockUntil')
      .lean();

    if (currentState?.lockUntil && currentState.lockUntil > now) {
      return false;
    }

    throw error;
  }
};

const audit = (acteurId, action, entityId, details = {}) => (
  JournalAudit.create({
    acteurId,
    action,
    typeEntite: 'Correspondance',
    entiteId: entityId,
    details
  })
);

export const queueAllActiveMatching = asyncHandler(async (req, res) => {
  const declarations = await Declaration.find({
    statut: StatutDeclaration.ACTIVE,
    isDeleted: { $ne: true }
  }).select('_id').lean();

  let queued = 0;
  let locked = 0;

  for (const declaration of declarations) {
    if (await queueDeclarationMatching(declaration._id)) {
      queued += 1;
    } else {
      locked += 1;
    }
  }

  return sendSuccess(res, {
    totalActive: declarations.length,
    queued,
    skippedLocked: locked
  }, 'Le recalcul des déclarations actives a été placé dans la file.', 202);
});

export const queueDeclarationMatchingById = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.declarationId)) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Identifiant de déclaration invalide.');
  }

  const declaration = await Declaration.findOne({
    _id: req.params.declarationId,
    isDeleted: { $ne: true }
  }).select('_id statut');

  if (!declaration) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Déclaration introuvable.');
  }
  if (declaration.statut !== StatutDeclaration.ACTIVE) {
    throw new AppError(409, ERROR_CODES.STATUS_TRANSITION_FORBIDDEN, 'Seules les déclarations actives peuvent être recalculées.');
  }

  const queued = await queueDeclarationMatching(declaration._id);
  if (!queued) {
    throw new AppError(409, ERROR_CODES.CONFLICT, 'Le matching de cette déclaration est déjà en cours.');
  }

  return sendSuccess(res, {
    declarationId: declaration._id,
    queued: true
  }, 'Le recalcul a été placé dans la file.', 202);
});

export const updateMatchStatus = asyncHandler(async (req, res) => {
  const correspondence = await Correspondance.findById(req.params.id);
  if (!correspondence) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Correspondance introuvable.');
  }

  if (
    correspondence.statut === StatutCorrespondance.VALIDEE ||
    req.body.statut === StatutCorrespondance.VALIDEE
  ) {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      'Une correspondance validée ne peut être modifiée que par le flux de résolution.'
    );
  }

  const ancienStatut = correspondence.statut;
  correspondence.statut = req.body.statut;
  await correspondence.save();
  await audit(req.user._id, 'ADMIN_STATUS_MATCH', correspondence._id, {
    ancienStatut,
    nouveauStatut: correspondence.statut
  });

  return sendSuccess(res, correspondence, 'Statut de la correspondance mis à jour.');
});

export const archiveMatch = asyncHandler(async (req, res) => {
  const correspondence = await Correspondance.findById(req.params.id);
  if (!correspondence) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Correspondance introuvable.');
  }

  if (!correspondence.archivedAt) {
    correspondence.archivedAt = new Date();
    await correspondence.save();
    await audit(req.user._id, 'ARCHIVE_MATCH', correspondence._id, {
      archivedAt: correspondence.archivedAt
    });
  }

  return sendSuccess(res, correspondence, 'Correspondance archivée.');
});

export const getMatchingSettingsController = asyncHandler(async (_req, res) => {
  return sendSuccess(res, await getMatchingSettings());
});

export const updateMatchingSettingsController = asyncHandler(async (req, res) => {
  const settings = await saveMatchingSettings(req.body);
  const settingsDocument = await MatchingSettings.findOne({ key: 'default' }).select('_id');
  await JournalAudit.create({
    acteurId: req.user._id,
    action: 'UPDATE_MATCHING_SETTINGS',
    typeEntite: 'MatchingSettings',
    entiteId: settingsDocument._id,
    details: settings
  });

  return sendSuccess(res, settings, 'Paramètres du matching mis à jour.');
});

export const getMatchingStats = asyncHandler(async (_req, res) => {
  const [total, byStatus, scoreStats, openConflicts] = await Promise.all([
    Correspondance.countDocuments(),
    Correspondance.aggregate([
      { $group: { _id: '$statut', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Correspondance.aggregate([
      { $group: { _id: null, averageScore: { $avg: '$score' }, minimumScore: { $min: '$score' }, maximumScore: { $max: '$score' } } }
    ]),
    ConflitMatching.countDocuments({ statut: { $ne: 'RESOLU' } })
  ]);
  const scoreSummary = scoreStats[0] || {};

  return sendSuccess(res, {
    total,
    byStatus: byStatus.map(({ _id, count }) => ({ statut: _id, count })),
    scores: {
      averageScore: scoreSummary.averageScore ?? null,
      minimumScore: scoreSummary.minimumScore ?? null,
      maximumScore: scoreSummary.maximumScore ?? null
    },
    openConflicts
  });
});

export const getAdminMatches = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = {};

  if (req.query.statut) {
    if (!Object.values(StatutCorrespondance).includes(req.query.statut)) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Statut de correspondance invalide.');
    }
    filter.statut = req.query.statut;
  }
  if (req.query.archived === 'true') {
    filter.archivedAt = { $ne: null };
  } else {
    filter.archivedAt = null;
  }

  const [matches, total] = await Promise.all([
    Correspondance.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'declarationPerdueId',
        select: 'titre type statut declarantId isDeleted',
        populate: { path: 'declarantId', select: 'nom prenom email' }
      })
      .populate({
        path: 'declarationTrouveeId',
        select: 'titre type statut declarantId isDeleted',
        populate: { path: 'declarantId', select: 'nom prenom email' }
      }),
    Correspondance.countDocuments(filter)
  ]);

  return sendSuccess(res, {
    matches,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  });
});

export const getAdminConflicts = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = {};
  if (req.query.statut) {
    if (!Object.values(StatutConflitMatching).includes(req.query.statut)) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Statut de conflit invalide.');
    }
    filter.statut = req.query.statut;
  }

  const [conflicts, total] = await Promise.all([
    ConflitMatching.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('declarationTrouveeId', 'titre type')
      .populate('declarationPerdueId', 'titre type')
      .populate('correspondanceIds', 'score statut'),
    ConflitMatching.countDocuments(filter)
  ]);

  return sendSuccess(res, {
    conflicts,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  });
});
