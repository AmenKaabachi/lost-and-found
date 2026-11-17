import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/authController.js';
import { validateRequest } from '../errors/validation/validateRequest.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();
const INSTITUTIONAL_DOMAIN = '';

router.post('/register', authLimiter, validateRequest(z.object({
  nom: z.string().min(2),
  prenom: z.string().min(2),
  email: z.string().email().refine(v => v.endsWith(INSTITUTIONAL_DOMAIN), { message: 'Email institutionnel requis' }),
  password: z.string().min(8),
  telephone: z.string().optional()
})), authController.register);

router.post('/verify-email', authLimiter, validateRequest(z.object({
  email: z.string().email(),
  code: z.string().length(6)
})), authController.verifyEmail);

router.post('/resend-verification-code', authLimiter, validateRequest(z.object({
  email: z.string().email()
})), authController.resendVerificationCode);

router.post('/login', authLimiter, validateRequest(z.object({
  email: z.string().email().refine(v => v.endsWith(INSTITUTIONAL_DOMAIN), { message: 'Email institutionnel requis' }),
  password: z.string()
})), authController.login);

router.post('/forgot-password', authLimiter, validateRequest(z.object({
  email: z.string().email()
})), authController.forgotPassword);

router.post('/reset-password', authLimiter, validateRequest(z.object({
  token: z.string(),
  newPassword: z.string().min(8)
})), authController.resetPassword);

// ─── Protégées ──────────────────────────
router.use(authMiddleware);
router.get('/me', authController.getMe);
router.put('/change-password', validateRequest(z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(8)
})), authController.changePassword);
router.post('/logout', authController.logout);

export default router;