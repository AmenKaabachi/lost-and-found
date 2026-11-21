import { z } from 'zod';
import {
  buildZodErrorMap,
  resolveLocale,
  translateValidationMessage,
  translations
} from '../localization/translation.js';
import { AppError } from '../core/AppError.js';
import { ERROR_CODES } from '../core/errorCodes.js';

export const validateRequest = (schema, source = 'body') => (req, res, next) => {
  const locale = resolveLocale(req.locale);
  const result = schema.safeParse(req[source], {
    errorMap: buildZodErrorMap(locale),
  });

  if (!result.success) {
    const flatErrors = result.error.flatten().fieldErrors;
    const fieldErrors = Object.fromEntries(
      Object.entries(flatErrors).map(([field, messages]) => [
        field,
        messages.map((message) => translateValidationMessage(locale, message))
      ])
    );
    return next(
      new AppError(400, ERROR_CODES.VALIDATION_ERROR, translations[locale].validationError, fieldErrors)
    );
  }

  req[source] = result.data;
  next();
};