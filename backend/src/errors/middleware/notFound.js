import { AppError } from '../core/AppError.js';
import { ERROR_CODES } from '../core/errorCodes.js';

export function notFound(request, _response, next) {
  next(new AppError(`Route not found: ${request.method} ${request.originalUrl}`, 404, ERROR_CODES.RESOURCE_NOT_FOUND));
}
