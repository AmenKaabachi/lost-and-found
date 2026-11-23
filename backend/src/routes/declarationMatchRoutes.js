
import { Router } from 'express';

import * as matchController from '../controllers/matchController.js';
import { authMiddleware } from '../middlewares/auth.js';

const declarationMatchRouter = Router();

declarationMatchRouter.use(authMiddleware);

// GET /api/declarations/:id/matches
declarationMatchRouter.get(
  '/:id/matches',
  matchController.getDeclarationMatches
);

export default declarationMatchRouter;
