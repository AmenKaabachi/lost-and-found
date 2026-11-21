import { AppError } from '../core/AppError.js';
import { ERROR_CODES } from '../core/errorCodes.js';
import { resolveLocale, translations } from '../localization/translation.js';

export const notFoundHandler = (req, res, next) => {
  const m = translations[resolveLocale(req.locale)];
  next(new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.routeNotFound));
};