import Declaration from '../models/Declaration.js';
import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { resolveLocale, translations } from '../errors/localization/translation.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';
import { Role } from '../models/enums.js';

export const ownerOrAdmin = asyncHandler(async (req, res, next) => {
  const m = translations[resolveLocale(req.locale)];
  const declaration = await Declaration.findOne({ _id: req.params.id, isDeleted: false });
  if (!declaration) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound(m.declaration));
  }
  const isOwner = declaration.declarantId.toString() === req.user._id.toString();
  const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN].includes(req.user.role);
  if (!isOwner && !isAdmin) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, m.forbidden);
  }
  req.declaration = declaration;
  next();
});