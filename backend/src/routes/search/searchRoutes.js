// 1. Imports
import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authMiddleware } from '../../middlewares/auth.js';
import { validateRequest } from '../../errors/validation/validateRequest.js';
import {
  declarationsSearchLimiter,
  mapSearchLimiter,
  suggestionsLimiter,
  recentSearchLimiter,
  filtersSearchLimiter,
  savedSearchReadLimiter,
  savedSearchWriteLimiter,
  notificationsReadLimiter,
  notificationsWriteLimiter
} from '../../middlewares/rateLimiter.js';
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

const latitudeQuery = z.string()
  .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/, 'Latitude invalide')
  .transform(Number)
  .pipe(z.number().finite().min(-90).max(90));

const longitudeQuery = z.string()
  .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/, 'Longitude invalide')
  .transform(Number)
  .pipe(z.number().finite().min(-180).max(180));

const radiusQuery = z.string()
  .regex(/^(?:\d+(?:\.\d*)?|\.\d+)$/, 'Radius invalide')
  .transform(Number)
  .pipe(z.number().finite().positive().max(2000));

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
  sort: z.enum(['date', 'pertinence', 'distance']).optional().default('date'),
  lat: latitudeQuery.optional(),
  lng: longitudeQuery.optional(),
  radius: radiusQuery.optional(),
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
  if (query.sort === 'distance') {
    if (query.lat === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lat'],
        message: 'lat est obligatoire pour le tri par distance'
      });
    }
    if (query.lng === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lng'],
        message: 'lng est obligatoire pour le tri par distance'
      });
    }
  }
  if (query.radius !== undefined) {
    if (query.lat === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lat'],
        message: 'lat est obligatoire pour le filtre radius'
      });
    }
    if (query.lng === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lng'],
        message: 'lng est obligatoire pour le filtre radius'
      });
    }
  }
});

const mapSearchQuerySchema = z.object({
  minLat: latitudeQuery,
  maxLat: latitudeQuery,
  minLng: longitudeQuery,
  maxLng: longitudeQuery,
  type: z.enum(Object.values(TypeDeclaration)).optional(),
  categorie: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Identifiant de catégorie invalide'
  }).optional(),
  limit: z.string().regex(/^\d+$/, 'limit doit être un entier positif')
    .transform(Number)
    .pipe(z.number().int().positive().max(100).safe())
    .optional()
    .default('100')
}).superRefine((query, context) => {
  if (query.minLat >= query.maxLat) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxLat'],
      message: 'maxLat doit être supérieur à minLat'
    });
  }
  if (query.minLng >= query.maxLng) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxLng'],
      message: 'maxLng doit être supérieur à minLng'
    });
  }
});

const suggestionsQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.string().regex(/^\d+$/, 'limit doit être un entier positif')
    .transform(Number)
    .pipe(z.number().int().positive().max(10).safe())
    .optional()
    .default('10')
});

const recentQuerySchema = z.object({
  type: z.enum(Object.values(TypeDeclaration)).optional(),
  limit: z.string().regex(/^\d+$/, 'limit doit être un entier positif')
    .transform(Number)
    .pipe(z.number().int().positive().max(20).safe())
    .optional()
    .default('10')
});

const filtersQuerySchema = z.object({
  type: z.enum(Object.values(TypeDeclaration)).optional()
});

const savedSearchFiltersSchema = z.preprocess(
  (value) => (value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, typeof item === 'number' ? String(item) : item])
    )
    : value),
  declarationSearchQuerySchema
).transform(({ page, limit, ...filters }) => filters);

const createSavedSearchSchema = z.object({
  nom: z.string().trim().min(3).max(50),
  filtres: savedSearchFiltersSchema,
  alerteEmail: z.boolean().optional().default(false)
});

const savedSearchIdParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant invalide')
});

const notificationsQuerySchema = z.object({
  lue: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  limit: z.string().regex(/^\d+$/, 'limit doit être un entier positif')
    .transform(Number)
    .pipe(z.number().int().positive().max(50).safe())
    .optional()
    .default('20')
});

const notificationIdParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant invalide')
});

// 4. Middleware
router.use(authMiddleware);

// 5. Route Definitions
router.get(
  '/declarations',
  declarationsSearchLimiter,
  validateRequest(declarationSearchQuerySchema, 'query'),
  declarationSearchController.searchDeclarations
);
router.get(
  '/map',
  mapSearchLimiter,
  validateRequest(mapSearchQuerySchema, 'query'),
  declarationSearchController.searchMap
);
router.get(
  '/suggestions',
  suggestionsLimiter,
  validateRequest(suggestionsQuerySchema, 'query'),
  declarationSearchController.getSuggestions
);
router.get(
  '/recent',
  recentSearchLimiter,
  validateRequest(recentQuerySchema, 'query'),
  declarationSearchController.getRecentDeclarations
);
router.get(
  '/filters',
  filtersSearchLimiter,
  validateRequest(filtersQuerySchema, 'query'),
  declarationSearchController.getSearchFilters
);
router.post(
  '/saved',
  savedSearchWriteLimiter,
  validateRequest(createSavedSearchSchema),
  declarationSearchController.createSavedSearch
);
router.get(
  '/saved',
  savedSearchReadLimiter,
  declarationSearchController.listSavedSearches
);
router.delete(
  '/saved/:id',
  savedSearchWriteLimiter,
  validateRequest(savedSearchIdParamsSchema, 'params'),
  declarationSearchController.deleteSavedSearch
);
router.get(
  '/notifications',
  notificationsReadLimiter,
  validateRequest(notificationsQuerySchema, 'query'),
  declarationSearchController.listNotifications
);
router.patch(
  '/notifications/read-all',
  notificationsWriteLimiter,
  declarationSearchController.markAllNotificationsRead
);
router.patch(
  '/notifications/:id/read',
  notificationsWriteLimiter,
  validateRequest(notificationIdParamsSchema, 'params'),
  declarationSearchController.markNotificationRead
);

// 6. Exports
export default router;
