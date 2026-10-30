import { AppError } from '../core/AppError.js';
import { ERROR_CODES } from '../core/errorCodes.js';
import { demoRepository } from './demo.repository.js';

function requireDeclaration(id) {
  const declaration = demoRepository.findById(id);
  if (!declaration) throw new AppError('Declaration not found', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
  return declaration;
}

export const demoService = {
  list: () => demoRepository.list(),
  get: (id) => requireDeclaration(id),
  create: (input) => {
    const duplicate = demoRepository.list().some((item) => item.title.toLowerCase() === input.title.toLowerCase());
    if (duplicate) throw new AppError('Duplicate declaration', 409, ERROR_CODES.DUPLICATE_RESOURCE);
    return demoRepository.create(input);
  },
  remove: (id) => {
    requireDeclaration(id);
    demoRepository.remove(id);
  },
};
