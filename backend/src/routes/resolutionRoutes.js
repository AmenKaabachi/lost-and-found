import { Router } from 'express';
import { z } from 'zod';

import * as resolutionController from '../controllers/resolutionController.js';

import { authMiddleware } from '../middlewares/auth.js';
import { roleMiddleware } from '../middlewares/role.js';
import { validateRequest } from '../errors/validation/validateRequest.js';

import { Role } from '../models/enums.js';

const router = Router();

router.use(authMiddleware);

// Consultation des résolutions accessibles à l'utilisateur.
router.get('/', resolutionController.getResolutions);
router.get('/:id', resolutionController.getResolutionById);

// Actions réservées aux administrateurs.
const adminOnly = roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]);


router.patch(
  '/:id/handover',
  adminOnly,
  validateRequest(z.object({
    notes: z.string().max(2000).optional()
  })),
  resolutionController.confirmHandover
);

export default router;