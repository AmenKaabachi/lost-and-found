import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { resolveLocale, translations } from '../errors/localization/translation.js';

export const roleMiddleware = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    const locale = resolveLocale(req.locale);
    throw new AppError(403, ERROR_CODES.FORBIDDEN, translations[locale].forbidden);
  }
  next();
};