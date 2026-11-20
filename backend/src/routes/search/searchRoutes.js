import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/auth.js';
import { validateRequest } from '../../errors/validation/validateRequest.js';
import * as declarationSearchController from '../../controllers/search/declarationSearchController.js';

const router = Router();

const declarationSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional()
});

router.use(authMiddleware);
router.get(
  '/declarations',
  validateRequest(declarationSearchQuerySchema, 'query'),
  declarationSearchController.searchDeclarations
);

export default router;
