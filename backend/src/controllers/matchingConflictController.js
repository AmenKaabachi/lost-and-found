
import mongoose from 'mongoose';

import ConflitMatching from '../models/ConflitMatching.js';
import JournalAudit from '../models/JournalAudit.js';

import {
  Role,
  TypeConflitMatching,
  StatutConflitMatching
} from '../models/enums.js';

import { relaunchConflictMatching } from '../modules/matching/conflictRelaunchService.js';

import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';

const isAdmin = (user) =>
  [Role.ADMIN, Role.SUPER_ADMIN].includes(user.role);

const requireAdmin = (user) => {
  if (!isAdmin(user)) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Cette action est réservée aux administrateurs'
    );
  }
};

const validateObjectId = (id, resource) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Identifiant ${resource} invalide`
    );
  }
};

const loadConflict = async (id) => {
  validateObjectId(id, 'conflit');

  const conflict = await ConflitMatching.findById(id)
    .populate('declarationTrouveeId', 'titre type declarantId')
    .populate('declarationPerdueId', 'titre type declarantId')
    .populate({
      path: 'correspondanceIds',
      select: 'score statut declarationPerdueId declarationTrouveeId',
      populate: [
        {
          path: 'declarationPerdueId',
          select: 'titre declarantId type'
        },
        {
          path: 'declarationTrouveeId',
          select: 'titre declarantId type'
        }
      ]
    })
    .populate('traiteParId', 'nom prenom');

  if (!conflict) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      'Conflit introuvable'
    );
  }

  return conflict;
};

const createConflictAudit = async (
  userId,
  action,
  conflictId,
  details = {}
) => {
  await JournalAudit.create({
    acteurId: userId,
    action,
    typeEntite: 'ConflitMatching',
    entiteId: conflictId,
    details
  });
};

/**
 * Convertit uniquement les erreurs métier connues du service
 * de relance.
 *
 * Les erreurs techniques sont propagées au middleware global.
 */
const handleRelaunchError = (error) => {
  const message = error.message || 'Erreur lors de la relance';

  if (
    message.includes('Conflit introuvable') ||
    message.includes('Correspondance introuvable') ||
    message.includes('Déclaration introuvable') ||
    message.includes('Déclarant introuvable')
  ) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      message
    );
  }

  if (message.includes('Identifiant')) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      message
    );
  }

  if (
    message.includes('déjà résolu') ||
    message.includes('doivent recevoir une réponse') ||
    message.includes('ne contient aucune correspondance')
  ) {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      message
    );
  }

  // Une erreur inconnue est probablement technique.
  // Elle doit être traitée par le middleware global en HTTP 500.
  throw error;
};

/**
 * GET /api/matching/conflicts
 *
 * Consultation des conflits par un administrateur.
 */
export const getConflicts = asyncHandler(async (req, res) => {
  requireAdmin(req.user);

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 20, 1),
    100
  );

  const filter = {};

  if (req.query.type) {
    if (!Object.values(TypeConflitMatching).includes(req.query.type)) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Type de conflit invalide'
      );
    }

    filter.type = req.query.type;
  }

  if (req.query.statut) {
    if (!Object.values(StatutConflitMatching).includes(req.query.statut)) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Statut de conflit invalide'
      );
    }

    filter.statut = req.query.statut;
  }

  const [conflicts, total] = await Promise.all([
    ConflitMatching.find(filter)
      .populate('declarationTrouveeId', 'titre type')
      .populate('declarationPerdueId', 'titre type')
      .populate({
        path: 'correspondanceIds',
        select: 'score statut declarationPerdueId declarationTrouveeId'
      })
      .populate('traiteParId', 'nom prenom')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

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

/**
 * POST /api/matching/conflicts/:id/request-info
 */
export const requestAdditionalInformation = asyncHandler(
  async (req, res) => {
    requireAdmin(req.user);

    const conflict = await loadConflict(req.params.id);

    if (conflict.statut === StatutConflitMatching.RESOLU) {
      throw new AppError(
        409,
        ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
        'Ce conflit est déjà résolu'
      );
    }

    const { destinataireId, question } = req.body || {};

    validateObjectId(destinataireId, 'destinataire');

    if (typeof question !== 'string' || !question.trim()) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'La question est obligatoire'
      );
    }

    const cleanQuestion = question.trim();

    if (cleanQuestion.length > 1000) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'La question ne doit pas dépasser 1000 caractères'
      );
    }

    const participantIds = new Set();

    for (const correspondence of conflict.correspondanceIds) {
      if (!correspondence) continue;

      const lostOwner =
        correspondence.declarationPerdueId?.declarantId;

      const foundOwner =
        correspondence.declarationTrouveeId?.declarantId;

      if (lostOwner) participantIds.add(lostOwner.toString());
      if (foundOwner) participantIds.add(foundOwner.toString());
    }

    if (conflict.declarationPerdueId?.declarantId) {
      participantIds.add(
        conflict.declarationPerdueId.declarantId.toString()
      );
    }

    if (conflict.declarationTrouveeId?.declarantId) {
      participantIds.add(
        conflict.declarationTrouveeId.declarantId.toString()
      );
    }

    if (!participantIds.has(destinataireId.toString())) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Le destinataire ne participe pas à ce conflit'
      );
    }

    conflict.informationsSupplementaires.push({
      demandeParId: req.user._id,
      destinataireId,
      question: cleanQuestion,
      dateDemande: new Date()
    });

    conflict.statut =
      StatutConflitMatching.INFORMATIONS_DEMANDEES;

    conflict.traiteParId = req.user._id;

    await conflict.save();

    const information =
      conflict.informationsSupplementaires[
        conflict.informationsSupplementaires.length - 1
      ];

    await createConflictAudit(
      req.user._id,
      'DEMANDE_INFORMATION_CONFLIT',
      conflict._id,
      {
        destinataireId,
        informationId: information._id,
        question: cleanQuestion
      }
    );

    return sendSuccess(
      res,
      {
        conflictId: conflict._id,
        information
      },
      'Demande d’information envoyée',
      201
    );
  }
);

/**
 * PATCH /api/matching/conflicts/:id/informations/:informationId/respond
 */
export const respondToInformationRequest = asyncHandler(
  async (req, res) => {
    const conflict = await loadConflict(req.params.id);

    validateObjectId(req.params.informationId, 'information');

    if (conflict.statut === StatutConflitMatching.RESOLU) {
      throw new AppError(
        409,
        ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
        'Ce conflit est déjà résolu'
      );
    }

    const information = conflict.informationsSupplementaires.id(
      req.params.informationId
    );

    if (!information) {
      throw new AppError(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'Demande d’information introuvable'
      );
    }

    if (
      information.destinataireId.toString() !==
      req.user._id.toString()
    ) {
      throw new AppError(
        403,
        ERROR_CODES.FORBIDDEN,
        'Vous n’êtes pas le destinataire de cette demande'
      );
    }

    const { reponse } = req.body || {};

    if (typeof reponse !== 'string' || !reponse.trim()) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'La réponse est obligatoire'
      );
    }

    const cleanResponse = reponse.trim();

    if (cleanResponse.length > 2000) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'La réponse ne doit pas dépasser 2000 caractères'
      );
    }

    if (
      typeof information.reponse === 'string' &&
      information.reponse.trim()
    ) {
      throw new AppError(
        409,
        ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
        'Vous avez déjà répondu à cette demande'
      );
    }

    information.reponse = cleanResponse;
    information.dateReponse = new Date();

    const allAnswered = conflict.informationsSupplementaires.every(
      (item) =>
        typeof item.reponse === 'string' &&
        item.reponse.trim().length > 0
    );

    if (allAnswered) {
      conflict.statut = StatutConflitMatching.EN_ATTENTE;
    }

    await conflict.save();

    await createConflictAudit(
      req.user._id,
      'REPONSE_INFORMATION_CONFLIT',
      conflict._id,
      {
        informationId: information._id,
        reponse: cleanResponse
      }
    );

    return sendSuccess(
      res,
      {
        conflictId: conflict._id,
        information,
        allAnswered
      },
      'Votre réponse a été enregistrée'
    );
  }
);

/**
 * POST /api/matching/conflicts/:id/relaunch
 *
 * Réservé aux administrateurs.
 *
 * Body facultatif :
 * {
 *   "motif": "Nouvelles informations reçues"
 * }
 */
export const relaunchConflict = asyncHandler(async (req, res) => {
  requireAdmin(req.user);

  const { motif } = req.body || {};

  if (
    motif !== undefined &&
    (typeof motif !== 'string' || motif.trim().length > 500)
  ) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Le motif doit être une chaîne de 500 caractères maximum'
    );
  }

  let result;

  try {
    result = await relaunchConflictMatching(
      req.params.id,
      req.user._id,
      motif?.trim()
    );
  } catch (error) {
    handleRelaunchError(error);
  }

  await createConflictAudit(
    req.user._id,
    'RELANCIEMENT_MATCHING_CONFLIT',
    result.conflictId,
    {
      motif: motif?.trim() || null,
      bestScore: result.bestScore,
      hasEqualScores: result.hasEqualScores,
      recalculatedMatches: result.recalculatedMatches.length
    }
  );

  return sendSuccess(
    res,
    result,
    'Le recalcul du conflit est terminé'
  );
});

/**
 * PATCH /api/matching/conflicts/:id/resolve
 *
 * Clôture administrative sans attribuer automatiquement l'objet.
 */
export const resolveConflict = asyncHandler(async (req, res) => {
  requireAdmin(req.user);
  const conflict = await loadConflict(req.params.id);

  if (conflict.statut === StatutConflitMatching.RESOLU) {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      'Ce conflit est déjà résolu'
    );
  }

  const commentaire = req.body?.commentaire?.trim();
  if (!commentaire) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Un commentaire de clôture est obligatoire'
    );
  }

  conflict.statut = StatutConflitMatching.RESOLU;
  conflict.traiteParId = req.user._id;
  conflict.dateResolution = new Date();
  conflict.commentaireResolution = commentaire;
  await conflict.save();

  await createConflictAudit(
    req.user._id,
    'RESOLUTION_CONFLIT_MATCHING',
    conflict._id,
    { commentaire }
  );

  return sendSuccess(
    res,
    conflict,
    'Conflit clôturé. Aucune correspondance n’a été déclarée gagnante.'
  );
});
