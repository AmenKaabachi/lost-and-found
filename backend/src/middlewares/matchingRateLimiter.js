import rateLimit from 'express-rate-limit';

export const matchingWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const message = req.locale === 'fr'
      ? 'Trop de requêtes de matching, réessayez plus tard.'
      : 'Too many matching requests, try again later.';
    res.status(429).json({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message, details: null }
    });
  }
});
