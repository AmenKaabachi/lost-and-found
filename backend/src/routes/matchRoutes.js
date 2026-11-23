
import { Router } from 'express';

import * as matchController from '../controllers/matchController.js';
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

// GET /api/matches/:id
matchRouter.get(
  '/:id',
  matchController.getMatchById
);

export default matchRouter;
