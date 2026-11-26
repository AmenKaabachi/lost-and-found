
import { Router } from 'express';

import * as matchController from '../controllers/matchController.js';
import * as matchingActionController from '../controllers/matchingActionController.js';
import * as matchingMessageController from '../controllers/matchingMessageController.js';
import * as matchingNotificationController from '../controllers/matchingNotificationController.js';

import { authMiddleware } from '../middlewares/auth.js';
import { matchingWriteLimiter } from '../middlewares/matchingRateLimiter.js';
import { roleMiddleware } from '../middlewares/role.js';
import { validateRequest } from '../errors/validation/validateRequest.js';
import { z } from 'zod';
import * as matchingAdminController from '../controllers/matchingAdminController.js';
import {
  DecisionFinaleCorrespondance,
  Role,
  StatutCorrespondance,
  StatutReponseCorrespondance
} from '../models/enums.js';

const matchRouter = Router();
const adminOnly = roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]);
const responseSchema = z.object({
  reponse: z.enum(
    Object.values(StatutReponseCorrespondance)
      .filter((value) => value !== StatutReponseCorrespondance.EN_ATTENTE)
  ),
  motif: z.string().max(1000).nullable().optional()
});
const finalDecisionSchema = z.object({
  decision: z.enum(
    Object.values(DecisionFinaleCorrespondance)
      .filter((value) => value !== DecisionFinaleCorrespondance.EN_ATTENTE)
  ),
  motif: z.string().max(1000).nullable().optional()
});
const messageSchema = z.object({
  contenu: z.string().trim().min(1).max(5000)
});
const editableMatchStatuses = Object.values(StatutCorrespondance)
  .filter((status) => status !== StatutCorrespondance.VALIDEE);
const matchStatusSchema = z.object({
  statut: z.enum(editableMatchStatuses)
});

matchRouter.use(authMiddleware);

// Keep fixed notification paths before /:id so "notifications" is not treated as an id.
matchRouter.get(
  '/notifications',
  matchingNotificationController.getMatchNotifications
);
matchRouter.put(
  '/notifications/read-all',
  matchingWriteLimiter,
  matchingNotificationController.markAllMatchNotificationsRead
);
matchRouter.put(
  '/notifications/:id/read',
  matchingWriteLimiter,
  matchingNotificationController.markMatchNotificationRead
);

matchRouter.get('/settings', adminOnly, matchingAdminController.getMatchingSettingsController);
matchRouter.put(
  '/settings',
  adminOnly,
  matchingWriteLimiter,
  validateRequest(z.object({
    minimumMatchScore: z.number().min(0).max(100),
    highConfidenceThreshold: z.number().min(0).max(100),
    weights: z.object({
      semantic: z.number().min(0).max(100),
      category: z.number().min(0).max(100),
      attributes: z.number().min(0).max(100),
      date: z.number().min(0).max(100),
      location: z.number().min(0).max(100),
      profile: z.number().min(0).max(100)
    })
  }).superRefine((settings, context) => {
    const weightTotal = Object.values(settings.weights)
      .reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(weightTotal - 100) > 0.001) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weights'],
        message: 'La somme des poids doit être égale à 100.'
      });
    }
    if (settings.highConfidenceThreshold < settings.minimumMatchScore) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['highConfidenceThreshold'],
        message: 'Le seuil de confiance élevée doit être supérieur ou égal au seuil minimal.'
      });
    }
  })),
  matchingAdminController.updateMatchingSettingsController
);
matchRouter.get('/stats', adminOnly, matchingAdminController.getMatchingStats);

// GET /api/matches
matchRouter.get(
  '/',
  matchController.getMatches
);

// GET /api/matches/:id/history
matchRouter.get(
  '/:id/history',
  matchController.getMatchHistory
);

// GET /api/matches/:id/conversation
matchRouter.get(
  '/:id/conversation',
  matchingActionController.getMatchConversation
);

// POST /api/matches/:id/messages
matchRouter.post(
  '/:id/messages',
  matchingWriteLimiter,
  validateRequest(messageSchema),
  matchingMessageController.sendMatchMessage
);

// PATCH /api/matches/:id/response
matchRouter.patch(
  '/:id/response',
  matchingWriteLimiter,
  validateRequest(responseSchema),
  matchingActionController.respondToMatch
);

// PATCH /api/matches/:id/final-decision
matchRouter.patch(
  '/:id/final-decision',
  matchingWriteLimiter,
  validateRequest(finalDecisionSchema),
  matchingActionController.submitFinalDecision
);

matchRouter.put(
  '/:id/status',
  adminOnly,
  matchingWriteLimiter,
  validateRequest(z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }), 'params'),
  validateRequest(matchStatusSchema),
  matchingAdminController.updateMatchStatus
);
matchRouter.post(
  '/:id/archive',
  adminOnly,
  matchingWriteLimiter,
  validateRequest(z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }), 'params'),
  matchingAdminController.archiveMatch
);

// GET /api/matches/:id
matchRouter.get(
  '/:id',
  matchController.getMatchById
);

export default matchRouter;
