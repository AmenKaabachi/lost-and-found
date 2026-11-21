// 1. Imports
import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { searchDeclarations as searchDeclarationsService } from '../../services/search/declarationSearchService.js';

// 2. Controller Functions
export const searchDeclarations = asyncHandler(async (req, res) => {
  const { declarations, pagination } = await searchDeclarationsService(req.query);

  // 3. Response Handling
  const message = declarations.length > 0
    ? 'Declarations found'
    : 'No declarations match your search';

  sendSuccess(res, declarations, message, 200, { pagination });
});
