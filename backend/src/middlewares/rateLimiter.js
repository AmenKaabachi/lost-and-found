import rateLimit from 'express-rate-limit';

const handler = (req, res) => {
  const msg = req.locale === 'fr' ? 'Trop de requêtes, réessayez plus tard'
    : req.locale === 'ar' ? 'طلبات كثيرة جداً، حاول لاحقاً'
    : 'Too many requests, try again later';
  res.status(429).json({
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: msg, details: null }
  });
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler,
  standardHeaders: true,
  legacyHeaders: false
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  handler
});