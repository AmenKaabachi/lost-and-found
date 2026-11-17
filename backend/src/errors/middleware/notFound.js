import { AppError } from '../core/AppError.js';
import { ERROR_CODES } from '../core/errorCodes.js';
import { translations } from '../localization/translation.js';

export const notFoundHandler = (req, res, next) => {
  next(new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, translations[req.locale || 'en'].notFound('Route')));
};