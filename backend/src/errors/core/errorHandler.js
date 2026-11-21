import { AppError } from './AppError.js';
import { ERROR_CODES } from './errorCodes.js';
import { resolveLocale, translations } from '../localization/translation.js';
import logger from '../logging/logger.js';

export const errorHandler = (err, req, res, next) => {
  const locale = resolveLocale(req.locale);
  
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error(err);
    
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  logger.error({ message: err.message, stack: err.stack });
  
  return res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: translations[locale].internalError,
      details: null
    }
  });
};