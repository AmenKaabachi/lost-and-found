
import { Router } from 'express';

import { authMiddleware } from '../middlewares/auth.js';
import { matchingWriteLimiter } from '../middlewares/matchingRateLimiter.js';
import { validateRequest } from '../errors/validation/validateRequest.js';
import { z } from 'zod';

import {
  getConflicts,
  requestAdditionalInformation,
  respondToInformationRequest,
  relaunchConflict,
  resolveConflict
} from '../controllers/matchingConflictController.js';

const matchingConflictRouter = Router();

matchingConflictRouter.use(authMiddleware);

matchingConflictRouter.get('/', getConflicts);

matchingConflictRouter.post(
  '/:id/request-info',
  matchingWriteLimiter,
  validateRequest(z.object({
    destinataireId: z.string().regex(/^[a-f\d]{24}$/i),
    question: z.string().trim().min(1).max(1000)
  })),
  requestAdditionalInformation
);

matchingConflictRouter.patch(
  '/:id/informations/:informationId/respond',
  matchingWriteLimiter,
  validateRequest(z.object({
    reponse: z.string().trim().min(1).max(2000)
  })),
  respondToInformationRequest
);

matchingConflictRouter.post(
  '/:id/relaunch',
  matchingWriteLimiter,
  validateRequest(z.object({
    motif: z.string().trim().max(500).optional()
  })),
  relaunchConflict
);

matchingConflictRouter.patch(
  '/:id/resolve',
  matchingWriteLimiter,
  validateRequest(z.object({
    commentaire: z.string().trim().min(1).max(2000)
  })),
  resolveConflict
);

export default matchingConflictRouter;
