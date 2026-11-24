
import { Router } from 'express';

import { authMiddleware } from '../middlewares/auth.js';

import {
  getConflicts,
  requestAdditionalInformation,
  respondToInformationRequest,
  relaunchConflict
} from '../controllers/matchingConflictController.js';

const matchingConflictRouter = Router();

matchingConflictRouter.use(authMiddleware);

matchingConflictRouter.get('/', getConflicts);

matchingConflictRouter.post(
  '/:id/request-info',
  requestAdditionalInformation
);

matchingConflictRouter.patch(
  '/:id/informations/:informationId/respond',
  respondToInformationRequest
);

matchingConflictRouter.post(
  '/:id/relaunch',
  relaunchConflict
);

export default matchingConflictRouter;
