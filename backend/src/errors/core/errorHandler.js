import { ZodError } from 'zod';
import { AppError } from './AppError.js';
import { ERROR_CODES } from './errorCodes.js';
import { logger } from '../logging/logger.js';

export function errorHandler(error, request, response, _next) {
  const normalized = error instanceof AppError
    ? error
    : error instanceof ZodError
      ? new AppError('Request validation failed', 400, ERROR_CODES.VALIDATION_ERROR, error.issues)
      : new AppError('Unexpected server failure', 500, ERROR_CODES.INTERNAL_SERVER_ERROR);

  const level = normalized.statusCode >= 500 ? 'error' : 'warn';
  logger[level]({
    err: error,
    code: normalized.code,
    statusCode: normalized.statusCode,
    method: request.method,
    path: request.originalUrl,
    locale: request.locale,
  }, normalized.isOperational ? 'Request failed' : 'Unexpected request failure');

  const details = normalized.details?.map((detail) => ({
    ...detail,
    message: request.t(detail.messageKey, detail),
  }));
  return response.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: request.t(`errors.${normalized.code}`),
      ...(details ? { details } : {}),
    },
  });
}
