import { successResponse } from '../core/responseHelpers.js';
import { demoService } from './demo.service.js';

export const demoController = {
  health: (request, response) => successResponse(response, { status: 'ok' }, 200, request.t('demo.health')),
  list: (_request, response) => successResponse(response, demoService.list()),
  get: (request, response) => successResponse(response, demoService.get(request.params.id)),
  create: (request, response) => successResponse(
    response,
    demoService.create(request.body),
    201,
    request.t('demo.declarationCreated'),
  ),
  remove: (request, response) => {
    demoService.remove(request.params.id);
    return successResponse(response, null, 200, request.t('demo.declarationDeleted'));
  },
  testError: () => {
    throw new Error('Intentional internal diagnostic failure');
  },
};
