import { z } from 'zod';
import { buildZodErrorMap, translations } from '../localization/translation.js';
import { AppError } from '../core/AppError.js';
import { ERROR_CODES } from '../core/errorCodes.js';

export const validateRequest = (schema, source = 'body') => (req, res, next) => {
  const locale = req.locale || 'en';
  const result = schema.safeParse(req[source], {
    errorMap: buildZodErrorMap(locale),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return next(
      new AppError(400, ERROR_CODES.VALIDATION_ERROR, translations[locale].validationError, fieldErrors)
    );
  }

  req[source] = result.data;
  next();
};