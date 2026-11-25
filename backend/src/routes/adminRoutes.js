import { Router } from 'express';
import { z } from 'zod';

import * as systemController from '../controllers/admin/systemController.js';
import * as reportController from '../controllers/admin/reportController.js';
import * as moderationController from '../controllers/admin/moderationController.js';
import * as statsController from '../controllers/admin/statsController.js';
import * as logController from '../controllers/admin/logController.js';
import * as adminNotificationController from '../controllers/admin/adminNotificationController.js';

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

// ─── Statistiques et export (ADMIN / SUPER_ADMIN) ────────
const periodeSchema = {
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
};
const periodeValide = (q) => !q.startDate || !q.endDate || q.startDate <= q.endDate;
const messagePeriode = { message: 'startDate doit être avant endDate', path: ['startDate'] };

router.get('/stats/overview', validateRequest(
  z.object(periodeSchema).refine(periodeValide, messagePeriode), 'query'
), statsController.getOverview);

router.get('/stats/categories', validateRequest(
  z.object(periodeSchema).refine(periodeValide, messagePeriode), 'query'
), statsController.getCategories);

router.get('/stats/evolution', validateRequest(
  z.object({ ...periodeSchema, interval: z.enum(['daily', 'monthly']).default('daily') })
    .refine(periodeValide, messagePeriode), 'query'
), statsController.getEvolution);

router.get('/export/stats', validateRequest(
  z.object({
    ...periodeSchema,
    format: z.enum(['csv', 'pdf']).default('csv'),
    interval: z.enum(['daily', 'monthly']).default('monthly')
  }).refine(periodeValide, messagePeriode), 'query'
), statsController.exportStats);
// ─── Journal d'audit (SUPER_ADMIN) ───────────────────────
router.get('/logs', superAdminOnly, validateRequest(z.object({
  adminId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID invalide').optional(),
  action: z.string().trim().optional(),
  typeEntite: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}), 'query'), logController.getLogs);

router.delete('/logs', superAdminOnly, validateRequest(z.object({
  olderThanDays: z.coerce.number().int().min(1).max(3650)
}), 'query'), logController.purgeLogs);

// ─── Notifications ───────────────────────────────────────
router.get('/notifications', validateRequest(z.object({
  targetAudience: z.enum(['users', 'admins', 'all', 'user', 'system']).optional(),
  type: z.string().trim().optional(),
  archived: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}), 'query'), adminNotificationController.listNotifications);

router.post('/notifications/send', superAdminOnly, validateRequest(z.object({
  targetAudience: z.enum(['users', 'admins', 'all', 'user']),
  recipientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID invalide').optional(),
  title: z.string().trim().min(3).max(150),
  message: z.string().trim().min(3).max(2000),
  type: z.string().trim().min(2).max(50).default('ANNONCE')
}).refine((b) => b.targetAudience !== 'user' || b.recipientId, {
  message: 'recipientId est obligatoire quand targetAudience = user',
  path: ['recipientId']
})), adminNotificationController.sendNotification);

router.patch('/notifications/:id/archive', superAdminOnly, adminNotificationController.archiveNotification);
export default router;
