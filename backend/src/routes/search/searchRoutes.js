// 1. Imports
import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authMiddleware } from '../../middlewares/auth.js';
import { validateRequest } from '../../errors/validation/validateRequest.js';
import * as declarationSearchController from '../../controllers/search/declarationSearchController.js';
import { TypeDeclaration } from '../../models/enums.js';

// 2. Router Initialization
const router = Router();

// 3. Validation Schemas
const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateValue = (value) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  return calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day
    && !Number.isNaN(Date.parse(value));
};

const dateQuery = z.union([
  z.string().regex(isoDateOnly),
  z.string().datetime({ offset: true })
]).refine(isValidDateValue, {
  message: 'Date ISO invalide'
});

const declarationSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  type: z.enum(Object.values(TypeDeclaration)).optional(),
  categorie: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Identifiant de catégorie invalide'
  }).optional(),
  couleur: z.string().trim().min(1).max(100).optional(),
  marque: z.string().trim().min(1).max(100).optional(),
  lieu: z.string().trim().min(1).max(100).optional(),
  zoneCampus: z.string().trim().min(1).max(100).optional(),
  dateDebut: dateQuery.optional(),
  dateFin: dateQuery.optional(),
  page: z.string().regex(/^\d+$/, 'page doit être un entier positif')
    .transform(Number)
    .pipe(z.number().int().positive().safe())
    .optional()
    .default('1')
    .transform((value) => typeof value === 'number' ? value : Number(value)),
  limit: z.string().regex(/^\d+$/, 'limit doit être un entier positif')
    .transform(Number)
    .pipe(z.number().int().positive().max(50).safe())
    .optional()
    .default('10')
    .transform((value) => typeof value === 'number' ? value : Number(value))
}).superRefine((query, context) => {
  if (query.dateDebut && query.dateFin && Date.parse(query.dateDebut) > Date.parse(query.dateFin)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dateFin'],
      message: 'dateFin doit être postérieure ou égale à dateDebut'
    });
  }
});

// 4. Middleware
router.use(authMiddleware);

// 5. Route Definitions
router.get(
  '/declarations',
  validateRequest(declarationSearchQuerySchema, 'query'),
  declarationSearchController.searchDeclarations
);

// 6. Exports
export default router;
