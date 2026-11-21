import { resolveLocale } from './translation.js';

export const localeMiddleware = (req, res, next) => {
  let lang = req.headers['x-language'];
  if (Array.isArray(lang)) lang = lang[0];
  if (!lang) {
    const accept = req.headers['accept-language'] || '';
    lang = accept.split(',')[0].split('-')[0];
  }
  req.locale = resolveLocale(String(lang || '').trim().toLowerCase());
  next();
};