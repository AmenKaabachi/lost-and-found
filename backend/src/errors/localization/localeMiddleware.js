import { SUPPORTED_LOCALES } from './translation.js';

function baseLocale(value) {
  const normalized = value.trim().toLowerCase().replace('_', '-');
  const base = normalized.split('-')[0];
  return SUPPORTED_LOCALES.includes(base) ? base : null;
}

function negotiate(value) {
  return value
    .split(',')
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().split(';');
      const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const weight = quality ? Number.parseFloat(quality.trim().slice(2)) : 1;
      return { locale: baseLocale(tag), weight: Number.isNaN(weight) ? 0 : weight, index };
    })
    .filter((entry) => entry.locale && entry.weight > 0)
    .sort((left, right) => right.weight - left.weight || left.index - right.index)[0]?.locale;
}

export function localeMiddleware(request, _response, next) {
  request.locale = baseLocale(request.get('X-Language') ?? '')
    ?? negotiate(request.get('Accept-Language') ?? '')
    ?? 'en';
  request.t = (key, variables) => request.app.locals.translate(request.locale, key, variables);
  next();
}
