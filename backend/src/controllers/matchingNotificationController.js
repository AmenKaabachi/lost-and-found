import mongoose from 'mongoose';

import Notification from '../models/Notification.js';
import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';

export const getMatchNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
    100
  );
  const filter = {
    destinataireId: req.user._id,
    referenceType: 'Correspondance'
  };

  if (req.query.lue !== undefined) {
    if (!['true', 'false'].includes(req.query.lue)) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Le filtre lue doit être true ou false.'
      );
    }

    filter.lue = req.query.lue === 'true';
  }

  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({
      destinataireId: req.user._id,
      referenceType: 'Correspondance',
      lue: false
    })
  ]);

  return sendSuccess(res, {
    notifications,
    total,
    unread,
    page,
    limit,
    pages: Math.ceil(total / limit)
  });
});

export const markMatchNotificationRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Identifiant de notification invalide.'
    );
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      destinataireId: req.user._id,
      referenceType: 'Correspondance'
    },
    { $set: { lue: true } },
    { new: true }
  );

  if (!notification) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      'Notification introuvable.'
    );
  }

  return sendSuccess(res, notification, 'Notification marquée comme lue.');
});

export const markAllMatchNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    {
      destinataireId: req.user._id,
      referenceType: 'Correspondance',
      lue: false
    },
    { $set: { lue: true } }
  );

  return sendSuccess(res, {
    modifiedCount: result.modifiedCount
  }, 'Toutes les notifications ont été marquées comme lues.');
});
