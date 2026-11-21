import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Utilisateur from '../models/Utilisateur.js';
import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';
import { Role, StatutUtilisateur, TypeMembre } from '../models/enums.js';
import { sendVerificationCodeEmail, sendResetPasswordEmail } from '../services/email.js';
import logger from '../errors/logging/logger.js';

// ─── Constantes ────────────────────────────────
const CODE_TTL_MS = 10 * 60 * 1000;   // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 secondes
const MAX_ATTEMPTS = 5;

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── POST /api/auth/register ───────────────────
export const register = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const { email } = req.body;

  const existing = await Utilisateur.findOne({ email });
  if (existing) throw new AppError(409, ERROR_CODES.CONFLICT, m.conflict(m.emailField));

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const code = generateCode();

  const utilisateur = await Utilisateur.create({
    nom: req.body.nom,
    prenom: req.body.prenom,
    email,
    passwordHash,
    telephone: req.body.telephone || null,
    role: Role.MEMBRE,
    typeMembre: TypeMembre.ETUDIANT,
    statut: StatutUtilisateur.EN_ATTENTE_VERIFICATION,
    emailVerifie: false,
    verificationCode: code,
    verificationCodeExpires: new Date(Date.now() + CODE_TTL_MS),
    verificationAttempts: 0,
    lastVerificationSentAt: new Date()
  });

  try {
  await sendVerificationCodeEmail({
    to: utilisateur.email,
    name: utilisateur.prenom,
    code: code,
    locale: req.locale
  });  } catch (err) {
    // On ne bloque pas l'inscription si l'email échoue :
    // l'utilisateur pourra demander un renvoi via /resend-verification-code
    logger.error({ err, email }, 'Failed to send verification email');
  }

  sendSuccess(res, { email: utilisateur.email }, m.accountCreated, 201);
});

// ─── POST /api/auth/verify-email ───────────────
export const verifyEmail = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const { email, code } = req.body;

  const utilisateur = await Utilisateur.findOne({ email });
  if (!utilisateur) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound(m.user));

  // Idempotence : si déjà vérifié, on renvoie succès sans rien faire
  if (utilisateur.emailVerifie) {
    return sendSuccess(res, null, m.emailAlreadyVerified);
  }

  // Code expiré ou absent
  if (!utilisateur.verificationCode || !utilisateur.verificationCodeExpires) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, m.codeExpired);
  }
  if (utilisateur.verificationCodeExpires < new Date()) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, m.codeExpired);
  }

  // Trop d'essais
  if (utilisateur.verificationAttempts >= MAX_ATTEMPTS) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, m.tooManyAttempts);
  }

  // Code incorrect
  if (utilisateur.verificationCode !== code) {
    utilisateur.verificationAttempts += 1;
    await utilisateur.save();
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, m.codeInvalid);
  }

  // ✅ Succès
  utilisateur.statut = StatutUtilisateur.ACTIF;
  utilisateur.emailVerifie = true;
  utilisateur.verificationCode = null;
  utilisateur.verificationCodeExpires = null;
  utilisateur.verificationAttempts = 0;
  await utilisateur.save();

  sendSuccess(res, null, m.emailVerified);
});

// ─── POST /api/auth/resend-verification-code ───
export const resendVerificationCode = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const { email } = req.body;

  const utilisateur = await Utilisateur.findOne({ email });

  // Anti-énumération : réponse identique que le compte existe ou non
  const GENERIC_RESPONSE = m.verificationCodeResent;

  if (!utilisateur || utilisateur.emailVerifie) {
    return sendSuccess(res, null, GENERIC_RESPONSE);
  }

  // Cooldown 60 s
  if (utilisateur.lastVerificationSentAt) {
    const elapsed = Date.now() - new Date(utilisateur.lastVerificationSentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      const msg = m.waitBeforeVerificationCode(waitSec);
      throw new AppError(429, ERROR_CODES.TOO_MANY_REQUESTS, msg);
    }
  }

  // Nouveau code (invalide l'ancien)
  const newCode = generateCode();
  utilisateur.verificationCode = newCode;
  utilisateur.verificationCodeExpires = new Date(Date.now() + CODE_TTL_MS);
  utilisateur.verificationAttempts = 0; // reset les essais
  utilisateur.lastVerificationSentAt = new Date();
  await utilisateur.save();

  try {
  await sendVerificationCodeEmail({
    to: utilisateur.email,
    name: utilisateur.prenom,
    code: newCode,
    locale: req.locale
  });  } catch (err) {
    logger.error({ err, email }, 'Failed to resend verification email');
  }

  sendSuccess(res, null, GENERIC_RESPONSE);
});

// ─── POST /api/auth/login ──────────────────────
export const login = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const { email, password } = req.body;

  const utilisateur = await Utilisateur.findOne({ email });
  if (!utilisateur || !(await bcrypt.compare(password, utilisateur.passwordHash))) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, m.invalidCredentials);
  }
  if (!utilisateur.emailVerifie) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, m.accountNotVerified);
  }
  if (utilisateur.statut === StatutUtilisateur.SUSPENDU) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, m.accountSuspended);
  }

  const accessToken = jwt.sign(
    { id: utilisateur._id, role: utilisateur.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign(
    { id: utilisateur._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  sendSuccess(res, { accessToken, refreshToken, user: utilisateur.toJSON() }, m.loggedIn);
});

// ─── GET /api/auth/me ──────────────────────────
export const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, req.user.toJSON());
});

// ─── PUT /api/auth/change-password ─────────────
export const changePassword = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const { oldPassword, newPassword } = req.body;

  const utilisateur = await Utilisateur.findById(req.user._id);
  if (!(await bcrypt.compare(oldPassword, utilisateur.passwordHash))) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, m.invalidCredentials);
  }
  utilisateur.passwordHash = await bcrypt.hash(newPassword, 10);
  await utilisateur.save();

  sendSuccess(res, null, m.passwordChanged);
});

// ─── POST /api/auth/logout ─────────────────────
export const logout = asyncHandler(async (req, res) => {
  // Le client supprime le token ; si vous voulez une blacklist, ajoutez-la ici
  sendSuccess(res, null, m.loggedOut);
});

// ─── POST /api/auth/forgot-password ────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const utilisateur = await Utilisateur.findOne({ email: req.body.email });

  const GENERIC = m.resetLinkSent;

  if (!utilisateur) return sendSuccess(res, null, GENERIC);

  const resetToken = crypto.randomBytes(32).toString('hex');
  utilisateur.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  utilisateur.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
  await utilisateur.save();

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

  try {
  await sendResetPasswordEmail({
    to: utilisateur.email,
    name: utilisateur.prenom,
    resetUrl,
    locale: req.locale
  });
  } catch (err) {
    logger.error({ err, email: utilisateur.email }, 'Failed to send reset password email');
  }

  sendSuccess(res, null, GENERIC);
});

// ─── POST /api/auth/reset-password ─────────────
export const resetPassword = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const hashedToken = crypto.createHash('sha256').update(req.body.token).digest('hex');
  const utilisateur = await Utilisateur.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!utilisateur) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, m.resetTokenInvalid);
  }

  utilisateur.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  utilisateur.resetPasswordToken = null;
  utilisateur.resetPasswordExpires = null;
  await utilisateur.save();

  sendSuccess(res, null, m.passwordReset);
});