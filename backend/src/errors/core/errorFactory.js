import { AppError } from './AppError.js';
import { ERROR_CODES } from './errorCodes.js';

export function createError(code, statusCode, message, details) {
  return new AppError({ code, statusCode, message, details });
}

export const errors = {
  validation: (details) => createError(ERROR_CODES.VALIDATION_ERROR, 400, 'Request validation failed', details),
  notFound: (message = 'Resource not found', details) =>
    createError(ERROR_CODES.RESOURCE_NOT_FOUND, 404, message, details),
  duplicate: (message = 'Duplicate resource', details) =>
    createError(ERROR_CODES.DUPLICATE_RESOURCE, 409, message, details),
};
