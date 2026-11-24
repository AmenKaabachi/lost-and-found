
import mongoose from 'mongoose';

import Resolution from '../models/Resolution.js';
import Declaration from '../models/Declaration.js';
import Correspondance from '../models/Correspondance.js';
import JournalAudit from '../models/JournalAudit.js';

import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';

import {
  Role,
  TypeDeclaration,
  StatutDeclaration,
  StatutCorrespondance,
  StatutResolution
} from '../models/enums.js';

const isAdmin = (user) => (
  [Role.ADMIN, Role.SUPER_ADMIN].includes(user.role)
);

const logResolutionAction = async (acteurId, action, resolution, details = {}) => {
  await JournalAudit.create({
    acteurId,
    action,
    typeEntite: 'Resolution',
    entiteId: resolution._id,
    details
  });
};

const getResolutionOrFail = async (resolutionId, locale) => {
  const resolution = await Resolution.findById(resolutionId);

  if (!resolution) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      translations[locale].notFound('Résolution')
    );
  }

  return resolution;
};

const ensureResolutionAccess = async (resolution, user, locale) => {
  if (isAdmin(user)) return;

  const declarations = await Declaration.find({
    _id: {
      $in: [
        resolution.declarationPerdueId,
        resolution.declarationTrouveeId
      ]
    },
    isDeleted: false
  }).select('declarantId');

  const isParticipant = declarations.some(
    declaration => declaration.declarantId.toString() === user._id.toString()
  );

  if (!isParticipant) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      translations[locale].forbidden
    );
  }
};

const ensureAdmin = (user, locale) => {
  if (!isAdmin(user)) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      translations[locale].forbidden
    );
  }
};

const ensureStatus = (resolution, expectedStatus, locale) => {
  if (resolution.statut !== expectedStatus) {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      translations[locale].statusTransitionForbidden
    );
  }
};

/**
 * GET /api/resolutions
 *
 * Retourne les résolutions accessibles à l'utilisateur.
 * Un administrateur peut consulter toutes les résolutions.
 */
export const getResolutions = asyncHandler(async (req, res) => {
  let query = {};

  if (!isAdmin(req.user)) {
    const declarations = await Declaration.find({
      declarantId: req.user._id,
      isDeleted: false
    }).select('_id');

    const declarationIds = declarations.map(declaration => declaration._id);

    query = {
      $or: [
        { declarationPerdueId: { $in: declarationIds } },
        { declarationTrouveeId: { $in: declarationIds } }
      ]
    };
  }

  const resolutions = await Resolution.find(query)
    .sort({ createdAt: -1 })
    .populate('declarationPerdueId')
    .populate('declarationTrouveeId')
    .populate('proprietaireId', 'nom prenom email')
    .populate('remiseParId', 'nom prenom');

  sendSuccess(res, resolutions);
});

/**
 * GET /api/resolutions/:id
 *
 * Retourne une résolution à ses deux déclarants ou à un administrateur.
 */
export const getResolutionById = asyncHandler(async (req, res) => {
  const resolution = await getResolutionOrFail(req.params.id, req.locale);

  await ensureResolutionAccess(resolution, req.user, req.locale);

  await resolution.populate([
    { path: 'declarationPerdueId' },
    { path: 'declarationTrouveeId' },
    { path: 'proprietaireId', select: 'nom prenom email' },
    { path: 'remiseParId', select: 'nom prenom' }
  ]);

  sendSuccess(res, resolution);
});


/**
 * PATCH /api/resolutions/:id/handover
 *
 * Confirme la remise de l'objet.
 *
 * APPROUVEE -> REMISE_EFFECTUEE
 *
 * Déclaration PERDU  -> RESOLVED
 * Déclaration TROUVE -> RESTITUEE
 *
 * Les modifications sont réalisées dans une transaction.
 */
export const confirmHandover = asyncHandler(async (req, res) => {
  ensureAdmin(req.user, req.locale);

  const session = await mongoose.startSession();

  let updatedResolution;

  try {
    await session.withTransaction(async () => {
      const resolution = await Resolution.findById(req.params.id).session(session);

      if (!resolution) {
        throw new AppError(
          404,
          ERROR_CODES.RESOURCE_NOT_FOUND,
          translations[req.locale].notFound('Résolution')
        );
      }

      // Vérifier que la correspondance associée existe
      // et qu'elle a bien été validée par les deux déclarants.
      const correspondence = await Correspondance.findById(
        resolution.correspondanceId
      ).session(session);

      if (
        !correspondence ||
        correspondence.statut !== StatutCorrespondance.VALIDEE
      ) {
        throw new AppError(
          409,
          ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
          'La correspondance doit être validée avant de confirmer la remise.'
        );
      }

      ensureStatus(
        resolution,
        StatutResolution.APPROUVEE,
        req.locale
      );

      const declarations = await Declaration.find({
        _id: {
          $in: [
            resolution.declarationPerdueId,
            resolution.declarationTrouveeId
          ]
        },
        isDeleted: false
      }).session(session);

      if (declarations.length !== 2) {
        throw new AppError(
          409,
          ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
          'Les deux déclarations liées à cette résolution doivent exister.'
        );
      }

      const declarationPerdue = declarations.find(
        declaration =>
          declaration._id.toString() === resolution.declarationPerdueId.toString()
      );

      const declarationTrouvee = declarations.find(
        declaration =>
          declaration._id.toString() === resolution.declarationTrouveeId.toString()
      );

      if (
        !declarationPerdue ||
        !declarationTrouvee ||
        declarationPerdue.type !== TypeDeclaration.PERDU ||
        declarationTrouvee.type !== TypeDeclaration.TROUVE
      ) {
        throw new AppError(
          409,
          ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
          'Les déclarations liées à cette résolution sont incohérentes.'
        );
      }

      if (
        declarationPerdue.statut !== StatutDeclaration.RESOLUTION_IN_PROGRESS ||
        declarationTrouvee.statut !== StatutDeclaration.RESOLUTION_IN_PROGRESS
      ) {
        throw new AppError(
          409,
          ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
          translations[req.locale].statusTransitionForbidden
        );
      }

      declarationPerdue.statut = StatutDeclaration.RESOLVED;
      declarationTrouvee.statut = StatutDeclaration.RESTITUEE;

      await declarationPerdue.save({ session });
      await declarationTrouvee.save({ session });

      resolution.statut = StatutResolution.REMISE_EFFECTUEE;
      resolution.remiseParId = req.user._id;
      resolution.dateRemise = new Date();

      if (req.body.notes !== undefined) {
        resolution.notes = req.body.notes;
      }

      await resolution.save({ session });

      updatedResolution = resolution;
    });
  } finally {
    await session.endSession();
  }

  await logResolutionAction(
    req.user._id,
    'CONFIRM_HANDOVER',
    updatedResolution,
    {
      nouveauStatut: updatedResolution.statut,
      dateRemise: updatedResolution.dateRemise
    }
  );

  sendSuccess(
    res,
    updatedResolution,
    'Handover confirmed'
  );
});
