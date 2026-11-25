import { Router } from 'express';
import { z } from 'zod';

import * as reportController from '../controllers/admin/reportController.js';

import { authMiddleware } from '../middlewares/auth.js';
import { validateRequest } from '../errors/validation/validateRequest.js';

import { MotifSignalement } from '../modules/admin/reportConstants.js';

const router = Router();

// POST /api/declarations/:id/report : n'importe quel utilisateur connecté
router.post('/:id/report', authMiddleware, validateRequest(z.object({
  reason: z.nativeEnum(MotifSignalement),
  description: z.string().trim().max(1000).optional()
})), reportController.createReport);

export default router;
