import { describe, expect, it } from 'vitest';
import { translate } from '../../localization/translation.js';

describe('translations', () => {
  it('falls back to English and interpolates values', () => {
    expect(translate('xx', 'errors.RESOURCE_NOT_FOUND')).toBe('Resource not found');
    expect(translate('fr', 'validation.tooShort', { minimum: 10 })).toContain('10');
  });
});
