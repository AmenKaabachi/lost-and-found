// 1. Imports
import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { translations } from '../../errors/localization/translation.js';
import { AppError } from '../../errors/core/AppError.js';
import { ERROR_CODES } from '../../errors/core/errorCodes.js';
import {
  searchDeclarations as searchDeclarationsService,
  searchDeclarationsOnMap as searchDeclarationsOnMapService,
  searchSuggestions as searchSuggestionsService,
  getRecentDeclarations as getRecentDeclarationsService,
  getSearchFilters as getSearchFiltersService,
  createSavedSearch as createSavedSearchService,
  listSavedSearches as listSavedSearchesService,
  deleteSavedSearch as deleteSavedSearchService
} from '../../services/search/declarationSearchService.js';
// 2. Controller Functions
export const searchDeclarations = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const { declarations, pagination } = await searchDeclarationsService(req.query);

  // 3. Response Handling
  const message = declarations.length > 0
    ? m.declarationsFound
    : m.noDeclarationsFound;

  sendSuccess(res, declarations, message, 200, { pagination });
});

export const searchMap = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const declarations = await searchDeclarationsOnMapService(req.query);

  // 3. Response Handling
  const message = declarations.length > 0
    ? m.declarationsFound
    : m.noMapDeclarationsFound;

  sendSuccess(res, declarations, message, 200);
});


export const getSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await searchSuggestionsService(req.query);

  // 3. Response Handling
  sendSuccess(res, suggestions);
});


export const getRecentDeclarations = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const declarations = await getRecentDeclarationsService(req.query);

  // 3. Response Handling
  const message = declarations.length > 0
    ? m.declarationsFound
    : m.noDeclarationsFound;

  sendSuccess(res, declarations, message, 200);
});


export const getSearchFilters = asyncHandler(async (req, res) => {
  const filters = await getSearchFiltersService(req.query);

  // 3. Response Handling
  sendSuccess(res, filters);
});


export const createSavedSearch = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const { nom, filtres, alerteEmail } = req.body;

  if (alerteEmail && req.user.notificationsEmail === false) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, m.validationError, {
      alerteEmail: [m.alertEmailDisabled]
    });
  }

  const savedSearch = await createSavedSearchService({
    userId: req.user._id,
    nom,
    filtres,
    alerteEmail
  });

  // 3. Response Handling
  sendSuccess(res, savedSearch, m.savedSearchCreated, 201);
});

export const listSavedSearches = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const savedSearches = await listSavedSearchesService(req.user._id);

  // 3. Response Handling
  sendSuccess(res, savedSearches, m.savedSearchesFound);
});

export const deleteSavedSearch = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const deleted = await deleteSavedSearchService({
    userId: req.user._id,
    id: req.params.id
  });

  if (!deleted) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound(m.savedSearch));
  }

  // 3. Response Handling
  sendSuccess(res, { _id: req.params.id }, m.savedSearchDeleted);
});