import { supportedLocales, defaultLocale } from './translation.js';

export const localeMiddleware = (req, res, next) => {
  let lang = req.headers['x-language'];
  if (!lang) {
    const accept = req.headers['accept-language'] || '';
    lang = accept.split(',')[0].split('-')[0].toLowerCase();
  }
  req.locale = supportedLocales.includes(lang) ? lang : defaultLocale;
  next();
};