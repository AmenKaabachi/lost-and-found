
import { Router } from 'express';

import * as matchController from '../controllers/matchController.js';
import * as matchingActionController from '../controllers/matchingActionController.js';
import * as matchingMessageController from '../controllers/matchingMessageController.js';

import { authMiddleware } from '../middlewares/auth.js';

const matchRouter = Router();

matchRouter.use(authMiddleware);

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
  matchingMessageController.sendMatchMessage
);

// PATCH /api/matches/:id/response
matchRouter.patch(
  '/:id/response',
  matchingActionController.respondToMatch
);

// PATCH /api/matches/:id/final-decision
matchRouter.patch(
  '/:id/final-decision',
  matchingActionController.submitFinalDecision
);

// GET /api/matches/:id
matchRouter.get(
  '/:id',
  matchController.getMatchById
);

export default matchRouter;
