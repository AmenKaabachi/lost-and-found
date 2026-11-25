import { Router } from 'express';
import { z } from 'zod';

import * as systemController from '../controllers/admin/systemController.js';
import * as reportController from '../controllers/admin/reportController.js';
import * as moderationController from '../controllers/admin/moderationController.js';

import { authMiddleware } from '../middlewares/auth.js';
import { roleMiddleware } from '../middlewares/role.js';
import { validateRequest } from '../errors/validation/validateRequest.js';

import { Role, StatutSignalement, TypeDeclaration } from '../models/enums.js';
import { MotifSignalement } from '../modules/admin/reportConstants.js';


const router = Router();

// Toutes les routes /api/admin/* : il faut être connecté ET être ADMIN ou SUPER_ADMIN
router.use(authMiddleware);
router.use(roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]));

// Raccourci pour les routes réservées au SUPER_ADMIN
const superAdminOnly = roleMiddleware([Role.SUPER_ADMIN]);

// ─── Système (SUPER_ADMIN) ───────────────────────────────
router.get('/system/health', superAdminOnly, systemController.getSystemHealth);

// ─── Signalements (ADMIN / SUPER_ADMIN) ──────────────────
router.get('/reports', validateRequest(z.object({
  status: z.nativeEnum(StatutSignalement).optional(),
  type: z.nativeEnum(MotifSignalement).optional(),
  declarationId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}), 'query'), reportController.listReports);

router.get('/reports/:id', reportController.getReportById);

router.patch('/reports/:id', validateRequest(z.object({
  // REJETE passe par /dismiss, donc ici seulement EN_EXAMEN ou TRAITE
  status: z.enum([StatutSignalement.EN_EXAMEN, StatutSignalement.TRAITE]),
  resolutionNotes: z.string().trim().max(2000).optional()
})), reportController.updateReport);

router.post('/reports/:id/dismiss', validateRequest(z.object({
  justification: z.string().trim().min(3).max(2000)
})), reportController.dismissReport);

// ─── Modération des déclarations (ADMIN / SUPER_ADMIN) ───
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID invalide');

router.get('/declarations/flagged', validateRequest(z.object({
  minReports: z.coerce.number().int().min(1).default(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}), 'query'), moderationController.getFlaggedDeclarations);

router.get('/declarations/duplicates', validateRequest(z.object({
  type: z.nativeEnum(TypeDeclaration).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}), 'query'), moderationController.getDuplicateDeclarations);

router.post('/declarations/bulk-action', validateRequest(z.object({
  action: z.enum(['delete', 'hide']),
  ids: z.array(objectId).min(1).max(100).transform((ids) => [...new Set(ids)]),
  motif: z.string().trim().min(3).max(500).optional()
})), moderationController.bulkAction);

export default router;
