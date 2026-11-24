
import mongoose from 'mongoose';

import Correspondance from '../models/Correspondance.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import JournalAudit from '../models/JournalAudit.js';

import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';

/**
 * POST /api/matches/:id/messages
 *
 * Body :
 * {
 *   "contenu": "Bonjour, pouvez-vous me donner plus de détails ?"
 * }
 */
export const sendMatchMessage = asyncHandler(async (req, res) => {
  const matchId = req.params.id;
  const userId = req.user._id;

  // 1. Vérifier l'identifiant de la correspondance.
  if (!mongoose.isValidObjectId(matchId)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Identifiant de correspondance invalide'
    );
  }

  // 2. Vérifier que la correspondance existe.
  const match = await Correspondance.findById(matchId)
    .populate('declarationPerdueId', 'declarantId isDeleted')
    .populate('declarationTrouveeId', 'declarantId isDeleted');

  if (
    !match ||
    !match.declarationPerdueId ||
    !match.declarationTrouveeId ||
    match.declarationPerdueId.isDeleted ||
    match.declarationTrouveeId.isDeleted
  ) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      'Correspondance introuvable'
    );
  }

  // 3. Vérifier que les deux déclarants ont accepté la correspondance.
  if (match.statut !== 'EN_DISCUSSION') {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      'La messagerie est accessible uniquement après acceptation des deux déclarants'
    );
  }

  // 4. Vérifier que l'utilisateur est l'un des deux déclarants.
  const lostOwnerId = match.declarationPerdueId.declarantId?.toString();
  const foundOwnerId = match.declarationTrouveeId.declarantId?.toString();
  const currentUserId = userId.toString();

  const isParticipant =
    currentUserId === lostOwnerId ||
    currentUserId === foundOwnerId;

  if (!isParticipant) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Vous ne participez pas à cette correspondance'
    );
  }

  // 5. Vérifier le contenu du message.
  const { contenu } = req.body || {};

  if (typeof contenu !== 'string' || !contenu.trim()) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Le contenu du message est obligatoire'
    );
  }

  const cleanContent = contenu.trim();

  if (cleanContent.length > 5000) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Le message ne doit pas dépasser 5000 caractères'
    );
  }

  // 6. Vérifier que la conversation existe.
  const conversation = await Conversation.findOne({
    correspondanceId: match._id
  });

  if (!conversation) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      'Aucune conversation n’est ouverte pour cette correspondance'
    );
  }

  // 7. Vérifier que l'utilisateur appartient à la conversation.
  const belongsToConversation = conversation.participantIds.some(
    (participantId) => participantId.toString() === currentUserId
  );

  if (!belongsToConversation) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Vous ne participez pas à cette conversation'
    );
  }

  // 8. Vérifier que la conversation n'est pas archivée.
  if (conversation.archivee) {
    throw new AppError(
      409,
      ERROR_CODES.STATUS_TRANSITION_FORBIDDEN,
      'Cette conversation est archivée'
    );
  }

  // 9. Enregistrer le message.
  const message = await Message.create({
    conversationId: conversation._id,
    expediteurId: userId,
    contenu: cleanContent
  });

  // 10. Mettre à jour la date du dernier message.
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  // 11. Enregistrer l'action dans le journal d'audit.
  await JournalAudit.create({
    acteurId: userId,
    action: 'ENVOI_MESSAGE_CORRESPONDANCE',
    typeEntite: 'Correspondance',
    entiteId: match._id,
    details: {
      conversationId: conversation._id,
      messageId: message._id
    }
  });

  // 12. Retourner le message créé.
  return sendSuccess(
    res,
    {
      message
    },
    'Message envoyé',
    201
  );
});
