import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { searchDeclarations as searchDeclarationsService } from '../../services/search/declarationSearchService.js';

export const searchDeclarations = asyncHandler(async (req, res) => {
  const declarations = await searchDeclarationsService(req.query.q);
  sendSuccess(res, declarations, 'Declarations found');
});
