import { Router } from 'express';

import * as systemController from '../controllers/admin/systemController.js';

import { authMiddleware } from '../middlewares/auth.js';
import { roleMiddleware } from '../middlewares/role.js';

import { Role } from '../models/enums.js';

const router = Router();

// Toutes les routes /api/admin/* : il faut être connecté ET être ADMIN ou SUPER_ADMIN
router.use(authMiddleware);
router.use(roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]));

// Raccourci pour les routes réservées au SUPER_ADMIN
const superAdminOnly = roleMiddleware([Role.SUPER_ADMIN]);

// ─── Système (SUPER_ADMIN) ───────────────────────────────
router.get('/system/health', superAdminOnly, systemController.getSystemHealth);

export default router;
