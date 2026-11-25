import mongoose from 'mongoose';

import Notification from '../../models/Notification.js';
import Utilisateur from '../../models/Utilisateur.js';
import JournalAudit from '../../models/JournalAudit.js';

import { AppError } from '../../errors/core/AppError.js';
import { ERROR_CODES } from '../../errors/core/errorCodes.js';
import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { superAdminMessages } from '../../errors/localization/superAdminTranslations.js';

import { Role, StatutUtilisateur } from '../../models/enums.js';

// 'users' → 'USERS' (valeur enregistrée dans le champ audience)
const toAudience = (targetAudience) => targetAudience.toUpperCase();

// ─── GET /api/admin/notifications (ADMIN) ────────────────
// Historique de toutes les notifications de la plateforme.
// Query : targetAudience (users|admins|all|user|system), type, archived, page, limit
//   system = notifications automatiques (créées par le code, ex. matching)
export const listNotifications = asyncHandler(async (req, res) => {
  const m = superAdminMessages(req);
  const { targetAudience, type, archived, page, limit } = req.query;

  const filter = {};
  if (targetAudience === 'system') filter.audience = null;
  else if (targetAudience) filter.audience = toAudience(targetAudience);
  if (type) filter.type = type;
  if (archived === 'true') filter.archivedAt = { $ne: null };
  if (archived === 'false') filter.archivedAt = null;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('destinataireId', 'nom prenom email role')
      .populate('emetteurId', 'nom prenom email'),
    Notification.countDocuments(filter)
  ]);

  sendSuccess(res, { notifications, total, page, limit, pages: Math.ceil(total / limit) }, m.notificationsFetched);
});

// ─── POST /api/admin/notifications/send (SUPER_ADMIN) ────
// Body : { targetAudience: users|admins|all|user, recipientId?, title, message, type? }
//   users  = tous les membres actifs
//   admins = tous les ADMIN et SUPER_ADMIN actifs
//   all    = tous les utilisateurs actifs
//   user   = un seul utilisateur (recipientId obligatoire)
export const sendNotification = asyncHandler(async (req, res) => {
  const m = superAdminMessages(req);
  const { targetAudience, recipientId, title, message, type } = req.body;

  // 1. Trouver les destinataires
  let destinataires;
  if (targetAudience === 'user') {
    const user = await Utilisateur.findById(recipientId, { _id: 1 });
    if (!user) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.recipientNotFound);
    destinataires = [user];
  } else {
    const filter = { statut: StatutUtilisateur.ACTIF };
    if (targetAudience === 'users') filter.role = Role.MEMBRE;
    if (targetAudience === 'admins') filter.role = { $in: [Role.ADMIN, Role.SUPER_ADMIN] };
    destinataires = await Utilisateur.find(filter, { _id: 1 });
  }

  if (destinataires.length === 0) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.noRecipients);
  }

  // 2. Une notification par destinataire (c'est comme ça que le modèle fonctionne)
  const audience = toAudience(targetAudience);
  const notifications = await Notification.insertMany(
    destinataires.map((u) => ({
      destinataireId: u._id,
      type,
      titre: title,
      contenu: message,
      emetteurId: req.user._id,
      audience
    }))
  );

  // 3. Audit
  await JournalAudit.create({
    acteurId: req.user._id,
    action: 'NOTIFICATION_SEND',
    typeEntite: 'Notification',
    entiteId: notifications[0]._id,
    details: { audience, type, titre: title, nbDestinataires: notifications.length }
  });

  sendSuccess(
    res,
    { envoyees: notifications.length, audience, type },
    m.notificationsSent(notifications.length),
    201
  );
});

// ─── PATCH /api/admin/notifications/:id/archive (SUPER_ADMIN) ─
export const archiveNotification = asyncHandler(async (req, res) => {
  const m = superAdminMessages(req);
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, m.invalidId);
  }

  const notification = await Notification.findById(id);
  if (!notification) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notificationNotFound);
  }
  if (notification.archivedAt) {
    throw new AppError(409, ERROR_CODES.CONFLICT, m.notificationAlreadyArchived);
  }

  notification.archivedAt = new Date();
  await notification.save();

  await JournalAudit.create({
    acteurId: req.user._id,
    action: 'NOTIFICATION_ARCHIVE',
    typeEntite: 'Notification',
    entiteId: notification._id,
    details: { titre: notification.titre }
  });

  sendSuccess(res, notification, m.notificationArchived);
});
