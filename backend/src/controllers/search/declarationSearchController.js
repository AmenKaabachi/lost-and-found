// 1. Imports
import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { translations } from '../../errors/localization/translation.js';
import {
  searchDeclarations as searchDeclarationsService,
  searchDeclarationsOnMap as searchDeclarationsOnMapService,
  searchSuggestions as searchSuggestionsService,
  getRecentDeclarations as getRecentDeclarationsService,
  getSearchFilters as getSearchFiltersService
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