import { Router } from 'express';
import { z } from 'zod';
import * as declarationController from '../controllers/declarationController.js';
import { authMiddleware } from '../middlewares/auth.js';
import { roleMiddleware } from '../middlewares/role.js';
import { ownerOrAdmin } from '../middlewares/ownerOrAdmin.js';
import { checkStatusTransition } from '../middlewares/checkStatusTransition.js';
import { validateRequest } from '../errors/validation/validateRequest.js';
import { aiModeration } from '../middlewares/aiModeration.js';
import { Role, TypeDeclaration, StatutDeclaration } from '../models/enums.js';

const router = Router();

// Les déclarations sont envoyées en JSON ou en urlencoded (plus de multipart / photos) :
// contactVisible accepte donc aussi un booléen JSON en plus de la chaîne.
const booleen = z.union([z.string(), z.boolean()]);
router.use(authMiddleware);

// ── Moderation : DOIT être avant /:id ────────
router.get('/moderation', roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]), declarationController.getModerationQueue);

// ── Création ─────────────────────────────────
router.post('/', validateRequest(z.object({
  type: z.enum([TypeDeclaration.PERDU, TypeDeclaration.TROUVE]),
  titre: z.string().min(3),
  description: z.string().min(10),
  categorie: z.string().min(1),
  dateEvenement: z.string().transform(v => new Date(v)),
  zoneCampus: z.string().optional(),
  lieuNom: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  couleur: z.string().optional(),
  marque: z.string().optional(),
  contactVisible: booleen.optional()
})), aiModeration, declarationController.createDeclaration);

// ── Validation / Refus (Admin) ───────────────
router.patch('/:id/validate', roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]), ownerOrAdmin, declarationController.validateDeclaration);
router.patch('/:id/reject', roleMiddleware([Role.ADMIN, Role.SUPER_ADMIN]), ownerOrAdmin, validateRequest(z.object({
  motif: z.string().min(3)
})), declarationController.rejectDeclaration);

// ── Changement de statut ─────────────────────
router.patch('/:id/status', ownerOrAdmin, validateRequest(z.object({
  statut: z.enum([
    StatutDeclaration.ACTIVE,
    StatutDeclaration.ANNULEE,
    StatutDeclaration.RESTITUEE,
    StatutDeclaration.MASQUEE
  ]),
  motif: z.string().optional()
}).refine(d => d.statut !== StatutDeclaration.MASQUEE || d.motif, {
  message: 'Motif obligatoire pour MASQUEE'
})), checkStatusTransition, declarationController.updateDeclarationStatus);

// ── Historique ───────────────────────────────
router.get('/:id/history', ownerOrAdmin, declarationController.getDeclarationHistory);

// ── CRUD ─────────────────────────────────────
router.get('/:id', declarationController.getDeclarationById);
router.put('/:id', ownerOrAdmin, validateRequest(z.object({
  titre: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  categorie: z.string().optional(),
  dateEvenement: z.string().transform(v => new Date(v)).optional(),
  zoneCampus: z.string().optional(),
  lieuNom: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  couleur: z.string().optional(),
  marque: z.string().optional(),
  contactVisible: booleen.optional()
})), aiModeration, declarationController.updateDeclaration);
router.delete('/:id', ownerOrAdmin, declarationController.deleteDeclaration);

export default router;