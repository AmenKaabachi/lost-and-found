import { describe, expect, it } from 'vitest';
import { AppError } from '../../core/AppError.js';

describe('AppError', () => {
  it('contains standardized metadata', () => {
    const error = new AppError('Nope', 404, 'RESOURCE_NOT_FOUND', { id: 'x' });
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.isOperational).toBe(true);
    expect(error.stack).toContain('AppError');
  });
});
