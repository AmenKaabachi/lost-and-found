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