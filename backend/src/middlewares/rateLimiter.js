import rateLimit from 'express-rate-limit';
import { translations } from '../errors/localization/translation.js';

export const rateLimitHandler = (req, res) => {
  const msg = translations[req.locale]?.tooManyRequests
    || translations.en.tooManyRequests;
  res.status(429).json({
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: msg, details: null }
  });
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  handler: rateLimitHandler
});


// Search limiters
const createSearchLimiter = (max) => rateLimit({
  windowMs: 60 * 1000,
  max,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id ?? req.ip),
  skip: () => process.env.NODE_ENV === 'test'
});

export const declarationsSearchLimiter = createSearchLimiter(60);
export const mapSearchLimiter = createSearchLimiter(30);
export const suggestionsLimiter = createSearchLimiter(30);
export const recentSearchLimiter = createSearchLimiter(30);
export const filtersSearchLimiter = createSearchLimiter(30);
export const savedSearchReadLimiter = createSearchLimiter(30);
export const savedSearchWriteLimiter = createSearchLimiter(10);
export const notificationsReadLimiter = createSearchLimiter(30);
export const notificationsWriteLimiter = createSearchLimiter(30);