import { Router } from 'express';
import { z } from 'zod';
import * as userController from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/auth.js';
import { roleMiddleware } from '../middlewares/role.js';
import { validateRequest } from '../errors/validation/validateRequest.js';
import { Role, StatutUtilisateur, MoyenTransport } from '../models/enums.js';

const router = Router();
router.use(authMiddleware);

// ─── Self ────────────────────────────────
router.get('/me', userController.getMyProfile);
router.put('/me', validateRequest(z.object({
  nom: z.string().min(2).optional(),
  prenom: z.string().min(2).optional(),
  telephone: z.string().optional(),
  avatar: z.string().optional(),
  notificationsEmail: z.boolean().optional(),
  moyenTransport: z.nativeEnum(MoyenTransport).nullable().optional(),
  lieuResidence: z.string().trim().max(100).nullable().optional(),
  nomEtablissement: z.string().trim().max(150).nullable().optional()
}).refine(d => Object.keys(d).length > 0, { message: 'Au moins un champ requis' })), userController.updateMyProfile);
router.delete('/me', validateRequest(z.object({ password: z.string() })), userController.deleteMyAccount);
router.get('/me/declarations', userController.getMyDeclarations);

// ─── Admin ───────────────────────────────
router.get('/', roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]), userController.listUsers);
router.post('/admins', roleMiddleware([Role.SUPER_ADMIN]), validateRequest(z.object({
  nom: z.string().min(2),
  prenom: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
})), userController.createAdmin);

router.get('/:id', userController.getUserById);
router.get('/:id/declarations', roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]), userController.getUserDeclarations);
router.put('/:id', roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]), validateRequest(z.object({
  nom: z.string().min(2).optional(),
  prenom: z.string().min(2).optional(),
  telephone: z.string().optional(),
  moyenTransport: z.nativeEnum(MoyenTransport).nullable().optional(),
  lieuResidence: z.string().trim().max(100).nullable().optional(),
  nomEtablissement: z.string().trim().max(150).nullable().optional()
}).refine(d => Object.keys(d).length > 0, { message: 'Au moins un champ requis' })), userController.updateUserByAdmin);
router.patch('/:id/status', roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]), validateRequest(z.object({
  statut: z.enum([StatutUtilisateur.ACTIF, StatutUtilisateur.SUSPENDU]),
  motif: z.string().optional()
})), userController.updateUserStatus);
router.patch('/:id/role', roleMiddleware([Role.SUPER_ADMIN]), validateRequest(z.object({
  role: z.enum([Role.MEMBRE, Role.ADMIN, Role.SUPER_ADMIN])
})), userController.updateUserRole);
router.delete('/:id', roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]), userController.deleteUserByAdmin);

export default router;