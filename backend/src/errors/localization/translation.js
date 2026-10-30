import en from './translations/en.json' with { type: 'json' };
import fr from './translations/fr.json' with { type: 'json' };
import ar from './translations/ar.json' with { type: 'json' };

export const SUPPORTED_LOCALES = ['en', 'fr', 'ar'];
const dictionaries = { en, fr, ar };

export function translate(locale, key, variables = {}) {
  const dictionary = dictionaries[SUPPORTED_LOCALES.includes(locale) ? locale : 'en'];
  const value = key.split('.').reduce((result, part) => result?.[part], dictionary);
  if (typeof value !== 'string') return key;
  return value.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(variables[name] ?? ''));
}
