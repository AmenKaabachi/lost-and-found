import { Router } from 'express';

import * as matchingAdminController from '../controllers/matchingAdminController.js';
import { authMiddleware } from '../middlewares/auth.js';
import { matchingWriteLimiter } from '../middlewares/matchingRateLimiter.js';
import { roleMiddleware } from '../middlewares/role.js';
import { Role } from '../models/enums.js';

const router = Router();
const adminOnly = roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]);

router.use(authMiddleware, adminOnly);

router.post(
  '/run',
  matchingWriteLimiter,
  matchingAdminController.queueAllActiveMatching
);
router.post(
  '/run/:declarationId',
  matchingWriteLimiter,
  matchingAdminController.queueDeclarationMatchingById
);
router.get('/conflicts', matchingAdminController.getAdminConflicts);
router.get('/', matchingAdminController.getAdminMatches);

export default router;
