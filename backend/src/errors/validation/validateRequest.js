import { AppError } from '../core/AppError.js';
import { ERROR_CODES } from '../core/errorCodes.js';

export function validateRequest(schema, source = 'body') {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        messageKey: issue.code === 'too_small'
          ? 'validation.tooShort'
          : issue.code === 'too_big'
            ? 'validation.tooLong'
            : issue.code === 'invalid_type' && issue.received === 'undefined'
              ? 'validation.required'
              : issue.code === 'invalid_enum_value'
                ? 'validation.invalidEnum'
                : 'validation.invalidType',
        minimum: issue.minimum,
        maximum: issue.maximum,
      }));
      return next(new AppError('Request validation failed', 400, ERROR_CODES.VALIDATION_ERROR, details));
    }
    request[source] = result.data;
    next();
  };
}
