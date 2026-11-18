import jwt from 'jsonwebtoken';
import Utilisateur from '../models/Utilisateur.js';
import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';
import { StatutUtilisateur } from '../models/enums.js';

export const authMiddleware = asyncHandler(async (req, res, next) => {
  const m = translations[req.locale];
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, m.unauthorized);
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findById(decoded.id);
    if (!utilisateur) throw new AppError(401, ERROR_CODES.UNAUTHORIZED, m.unauthorized);
    if (utilisateur.statut === StatutUtilisateur.SUSPENDU) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN, m.accountSuspended);
    }
    if (!utilisateur.emailVerifie) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN, m.emailNotVerified);
    }
    req.user = utilisateur;
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, m.unauthorized);
  }
});