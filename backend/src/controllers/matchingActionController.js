
import mongoose from 'mongoose';

import Correspondance from '../models/Correspondance.js';
import Declaration from '../models/Declaration.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Resolution from '../models/Resolution.js';
import Notification from '../models/Notification.js';
import JournalAudit from '../models/JournalAudit.js';

import {
  StatutDeclaration,
  StatutCorrespondance,
  StatutReponseCorrespondance,
  DecisionFinaleCorrespondance,
  StatutResolution
} from '../models/enums.js';

import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';

import { registerUserDisagreement } from '../modules/matching/conflictService.js';

const validateObjectId = (id, m) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      m.validationError
    );
  }
};

const loadCorrespondence = async (id, session = null) => {
  let query = Correspondance.findById(id);

  if (session) {
    query = query.session(session);
  }

  return query
    .populate({
      path: 'declarationPerdueId',
      match: { isDeleted: false },
      populate: {
        path: 'declarantId',
        select: 'nom prenom email telephone avatar'
      }
    })
    .populate({
      path: 'declarationTrouveeId',
      match: { isDeleted: false },
      populate: {
        path: 'declarantId',
        select: 'nom prenom email telephone avatar'
      }
    });
};

const getParticipantSide = (correspondence, userId) => {
  const lostOwner =
    correspondence.declarationPerdueId.declarantId?._id?.toString();

  const foundOwner =
    correspondence.declarationTrouveeId.declarantId?._id?.toString();

  const currentUserId = userId.toString();

  if (lostOwner === currentUserId) {
    return 'Perdu';
  }

  if (foundOwner === currentUserId) {
    return 'Trouve';
  }

  return null;
};

const ensureParticipant = (correspondence, user, m) => {
  const side = getParticipantSide(correspondence, user._id);

  if (!side) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      m.forbidden
    );
  }

  return side;
};

const createAudit = async ({
  userId,
  correspondenceId,
  action,
  details = {}
}) => {
  await JournalAudit.create({
    acteurId: userId,
    action,
    typeEntite: 'Correspondance',
    entiteId: correspondenceId,
    details
  });
};

const createNotification = async ({
  recipientId,
  type,
  title,
  content,
  correspondenceId
}) => {
  await Notification.create({
    destinataireId: recipientId,
    type,
    titre: title,
    contenu: content,
    referenceId: correspondenceId,
    referenceType: 'Correspondance'
  });
};

const getOtherParticipantId = (correspondence, side) => {
  if (side === 'Perdu') {
    return correspondence.declarationTrouveeId.declarantId._id;
  }

  return correspondence.declarationPerdueId.declarantId._id;
};

/**
 * GET /api/matches/:id/conversation
 *
 * Récupérer ou créer la conversation liée à une correspondance.
 */
export const getMatchConversation = asyncHandler(async (req, res) => {
  const m = translations[req.locale];

  validateObjectId(req.params.id, m);

  const correspondence = await loadCorrespondence(req.params.id);

  if (
    !correspondence ||
    !correspondence.declarationPerdueId ||
    !correspondence.declarationTrouveeId
  ) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      m.notFound('Correspondance')
    );
  }

  if (correspondence.statut !== StatutCorrespondance.EN_DISCUSSION) {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      'La conversation est disponible uniquement lorsque les deux déclarants ont accepté la correspondance.'
    );
  }

  ensureParticipant(correspondence, req.user, m);

  const lostOwner =
    correspondence.declarationPerdueId.declarantId._id;

  const foundOwner =
    correspondence.declarationTrouveeId.declarantId._id;

  const conversation = await Conversation.findOneAndUpdate(
    {
      correspondanceId: correspondence._id
    },
    {
      $setOnInsert: {
        participantIds: [lostOwner, foundOwner],
        correspondanceId: correspondence._id,
        lastMessageAt: null,
        archivee: false
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).populate({
    path: 'participantIds',
    select: 'nom prenom email avatar'
  });

  if (conversation.archivee) {
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Cette conversation est archivée.'
    );
  }

  const messages = await Message.find({
    conversationId: conversation._id,
    supprimeAt: null
  })
    .populate('expediteurId', 'nom prenom avatar')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return sendSuccess(
    res,
    {
      conversation,
      messages: messages.reverse()
    },
    'Conversation récupérée avec succès.'
  );
});

/**
 * PATCH /api/matches/:id/response
 *
 * Première réponse d'un déclarant :
 * ACCEPTEE / REFUSEE / INCERTAINE.
 */
export const respondToMatch = asyncHandler(async (req, res) => {
  const m = translations[req.locale];

  validateObjectId(req.params.id, m);

  const { reponse, motif = null } = req.body;

  const allowedResponses = Object.values(
    StatutReponseCorrespondance
  ).filter((value) => value !== StatutReponseCorrespondance.EN_ATTENTE);

  if (!allowedResponses.includes(reponse)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'La réponse doit être ACCEPTEE, REFUSEE ou INCERTAINE.'
    );
  }

  if (
    motif !== null &&
    (typeof motif !== 'string' || motif.trim().length > 1000)
  ) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Le motif ne doit pas dépasser 1000 caractères.'
    );
  }

  const correspondence = await loadCorrespondence(req.params.id);

  if (
    !correspondence ||
    !correspondence.declarationPerdueId ||
    !correspondence.declarationTrouveeId
  ) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      m.notFound('Correspondance')
    );
  }

  const side = ensureParticipant(correspondence, req.user, m);

  if (
    [
      StatutCorrespondance.VALIDEE,
      StatutCorrespondance.REJETEE,
      StatutCorrespondance.ANNULEE,
      StatutCorrespondance.EN_CONFLIT
    ].includes(correspondence.statut)
  ) {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      'Cette correspondance ne peut plus recevoir de réponse.'
    );
  }

  if (
    ![
      StatutCorrespondance.PROPOSEE,
      StatutCorrespondance.A_VERIFIER,
      StatutCorrespondance.EN_ATTENTE_REPONSE
    ].includes(correspondence.statut)
  ) {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      'La période de réponse initiale est terminée.'
    );
  }

  const responseField =
    side === 'Perdu'
      ? 'reponseDeclarantPerdu'
      : 'reponseDeclarantTrouve';

  const currentResponse = correspondence[responseField];

  if (
    currentResponse.statut !==
    StatutReponseCorrespondance.EN_ATTENTE
  ) {
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Vous avez déjà répondu à cette correspondance.'
    );
  }

  correspondence[responseField] = {
    statut: reponse,
    dateReponse: new Date(),
    motif: motif?.trim() || null
  };

  const lostResponse =
    side === 'Perdu'
      ? reponse
      : correspondence.reponseDeclarantPerdu.statut;

  const foundResponse =
    side === 'Trouve'
      ? reponse
      : correspondence.reponseDeclarantTrouve.statut;

  if (
    lostResponse === StatutReponseCorrespondance.REFUSEE &&
    foundResponse === StatutReponseCorrespondance.REFUSEE
  ) {
    correspondence.statut = StatutCorrespondance.REJETEE;
  } else if (
    (
      lostResponse === StatutReponseCorrespondance.ACCEPTEE &&
      foundResponse === StatutReponseCorrespondance.REFUSEE
    ) ||
    (
      lostResponse === StatutReponseCorrespondance.REFUSEE &&
      foundResponse === StatutReponseCorrespondance.ACCEPTEE
    )
  ) {
    correspondence.statut = StatutCorrespondance.EN_CONFLIT;
  } else if (
    lostResponse === StatutReponseCorrespondance.INCERTAINE ||
    foundResponse === StatutReponseCorrespondance.INCERTAINE
  ) {
    correspondence.statut = StatutCorrespondance.A_VERIFIER;
  } else if (
    lostResponse === StatutReponseCorrespondance.ACCEPTEE &&
    foundResponse === StatutReponseCorrespondance.ACCEPTEE
  ) {
    correspondence.statut = StatutCorrespondance.EN_DISCUSSION;
  } else {
    correspondence.statut = StatutCorrespondance.EN_ATTENTE_REPONSE;
  }

  await correspondence.save();

  if (correspondence.statut === StatutCorrespondance.EN_CONFLIT) {
    await registerUserDisagreement(correspondence._id);
  }

  await createAudit({
    userId: req.user._id,
    correspondenceId: correspondence._id,
    action: 'REPONSE_CORRESPONDANCE',
    details: {
      reponse,
      motif: motif?.trim() || null,
      statut: correspondence.statut
    }
  });

  const otherParticipantId = getOtherParticipantId(
    correspondence,
    side
  );

  await createNotification({
    recipientId: otherParticipantId,
    type: 'REPONSE_CORRESPONDANCE',
    title: 'Nouvelle réponse à une correspondance',
    content: "L'autre déclarant vient de répondre à votre proposition.",
    correspondenceId: correspondence._id
  });

  return sendSuccess(
    res,
    {
      correspondance: correspondence,
      statut: correspondence.statut
    },
    'Votre réponse a été enregistrée.'
  );
});

/**
 * PATCH /api/matches/:id/final-decision
 *
 * Décision définitive après discussion :
 * CONFIRMEE / REJETEE.
 *
 * Si les deux déclarants confirment :
 * - Correspondance => VALIDEE
 * - Déclarations => RESOLUTION_IN_PROGRESS
 * - Création d'une Resolution.
 *
 * Les trois opérations sont réalisées dans une transaction MongoDB.
 */
export const submitFinalDecision = asyncHandler(async (req, res) => {
  const m = translations[req.locale];

  validateObjectId(req.params.id, m);

  const { decision, motif = null } = req.body;

  const allowedDecisions = Object.values(
    DecisionFinaleCorrespondance
  ).filter((value) => value !== DecisionFinaleCorrespondance.EN_ATTENTE);

  if (!allowedDecisions.includes(decision)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'La décision doit être CONFIRMEE ou REJETEE.'
    );
  }

  if (
    motif !== null &&
    (typeof motif !== 'string' || motif.trim().length > 1000)
  ) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Le motif ne doit pas dépasser 1000 caractères.'
    );
  }

  const session = await mongoose.startSession();

  let correspondence = null;
  let resolution = null;
  let side = null;
  let bothConfirmed = false;

  try {
    await session.withTransaction(
      async () => {
        // Recharger les données à l'intérieur de la transaction.
        correspondence = await loadCorrespondence(
          req.params.id,
          session
        );

        if (
          !correspondence ||
          !correspondence.declarationPerdueId ||
          !correspondence.declarationTrouveeId
        ) {
          throw new AppError(
            404,
            ERROR_CODES.RESOURCE_NOT_FOUND,
            m.notFound('Correspondance')
          );
        }

        side = ensureParticipant(correspondence, req.user, m);

        if (
          correspondence.statut !==
          StatutCorrespondance.EN_DISCUSSION
        ) {
          throw new AppError(
            409,
            ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
            'La décision finale est autorisée uniquement pendant la discussion.'
          );
        }

        if (
          correspondence.reponseDeclarantPerdu.statut !==
            StatutReponseCorrespondance.ACCEPTEE ||
          correspondence.reponseDeclarantTrouve.statut !==
            StatutReponseCorrespondance.ACCEPTEE
        ) {
          throw new AppError(
            409,
            ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
            'Les deux déclarants doivent avoir accepté la correspondance avant la décision finale.'
          );
        }

        const decisionField =
          side === 'Perdu'
            ? 'decisionFinaleDeclarantPerdu'
            : 'decisionFinaleDeclarantTrouve';

        const currentDecision = correspondence[decisionField];

        if (
          currentDecision.statut !==
          DecisionFinaleCorrespondance.EN_ATTENTE
        ) {
          throw new AppError(
            409,
            ERROR_CODES.CONFLICT,
            'Vous avez déjà soumis votre décision finale.'
          );
        }

        correspondence[decisionField] = {
          statut: decision,
          dateDecision: new Date(),
          motif: motif?.trim() || null
        };

        const lostDecision =
          side === 'Perdu'
            ? decision
            : correspondence.decisionFinaleDeclarantPerdu.statut;

        const foundDecision =
          side === 'Trouve'
            ? decision
            : correspondence.decisionFinaleDeclarantTrouve.statut;

        bothConfirmed =
          lostDecision === DecisionFinaleCorrespondance.CONFIRMEE &&
          foundDecision === DecisionFinaleCorrespondance.CONFIRMEE;

        if (bothConfirmed) {
          const lostDeclaration = correspondence.declarationPerdueId;
          const foundDeclaration = correspondence.declarationTrouveeId;

          // Vérifier que les deux déclarations sont encore actives.
          const activeDeclarations = await Declaration.countDocuments({
            _id: {
              $in: [
                lostDeclaration._id,
                foundDeclaration._id
              ]
            },
            statut: StatutDeclaration.ACTIVE,
            isDeleted: false
          }).session(session);

          if (activeDeclarations !== 2) {
            throw new AppError(
              409,
              ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
              'Les deux déclarations doivent être actives pour commencer la résolution.'
            );
          }

          correspondence.statut = StatutCorrespondance.VALIDEE;
          correspondence.valideeParId = req.user._id;
          correspondence.dateValidation = new Date();

          // Créer ou récupérer la résolution dans la transaction.
          resolution = await Resolution.findOneAndUpdate(
            {
              correspondanceId: correspondence._id
            },
            {
              $setOnInsert: {
                correspondanceId: correspondence._id,
                declarationPerdueId: lostDeclaration._id,
                declarationTrouveeId: foundDeclaration._id,
                proprietaireId: lostDeclaration.declarantId._id,
                statut: StatutResolution.EN_ATTENTE
              }
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
              session
            }
          );

          // Faire passer les deux déclarations en cours de résolution.
          const updateResult = await Declaration.updateMany(
            {
              _id: {
                $in: [
                  lostDeclaration._id,
                  foundDeclaration._id
                ]
              },
              statut: StatutDeclaration.ACTIVE,
              isDeleted: false
            },
            {
              $set: {
                statut: StatutDeclaration.RESOLUTION_IN_PROGRESS
              }
            },
            {
              session
            }
          );

          if (updateResult.modifiedCount !== 2) {
            throw new AppError(
              409,
              ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
              'Impossible de mettre à jour les statuts des deux déclarations.'
            );
          }
        } else if (
          lostDecision === DecisionFinaleCorrespondance.REJETEE &&
          foundDecision === DecisionFinaleCorrespondance.REJETEE
        ) {
          correspondence.statut = StatutCorrespondance.REJETEE;
        } else if (
          (
            lostDecision === DecisionFinaleCorrespondance.CONFIRMEE &&
            foundDecision === DecisionFinaleCorrespondance.REJETEE
          ) ||
          (
            lostDecision === DecisionFinaleCorrespondance.REJETEE &&
            foundDecision === DecisionFinaleCorrespondance.CONFIRMEE
          )
        ) {
          correspondence.statut = StatutCorrespondance.EN_CONFLIT;
        }

        // Enregistrer la correspondance dans la même transaction.
        await correspondence.save({ session });
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      }
    );
  } finally {
    await session.endSession();
  }

  // Les traitements secondaires sont exécutés après validation
  // de la transaction principale.
  if (correspondence.statut === StatutCorrespondance.EN_CONFLIT) {
    await registerUserDisagreement(correspondence._id);
  }

  await createAudit({
    userId: req.user._id,
    correspondenceId: correspondence._id,
    action: 'DECISION_FINALE_CORRESPONDANCE',
    details: {
      decision,
      motif: motif?.trim() || null,
      statut: correspondence.statut
    }
  });

  const lostOwner =
    correspondence.declarationPerdueId.declarantId._id;

  const foundOwner =
    correspondence.declarationTrouveeId.declarantId._id;

  await Promise.all([
    createNotification({
      recipientId: lostOwner,
      type: 'DECISION_FINALE_CORRESPONDANCE',
      title: 'Décision finale mise à jour',
      content: 'La décision finale concernant votre correspondance a été mise à jour.',
      correspondenceId: correspondence._id
    }),
    createNotification({
      recipientId: foundOwner,
      type: 'DECISION_FINALE_CORRESPONDANCE',
      title: 'Décision finale mise à jour',
      content: 'La décision finale concernant votre correspondance a été mise à jour.',
      correspondenceId: correspondence._id
    })
  ]);

  return sendSuccess(
    res,
    {
      correspondance,
      resolution,
      statut: correspondence.statut
    },
    'Votre décision finale a été enregistrée.'
  );
});
