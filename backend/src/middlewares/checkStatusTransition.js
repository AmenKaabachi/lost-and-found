import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';
import { Role, StatutDeclaration } from '../models/enums.js';

const AUTHOR_TRANSITIONS = {
  [StatutDeclaration.ACTIVE]: [StatutDeclaration.ANNULEE, StatutDeclaration.RESTITUEE],
  [StatutDeclaration.REFUSEE]: [StatutDeclaration.ANNULEE],
  [StatutDeclaration.EN_ATTENTE]: [StatutDeclaration.ANNULEE],
  [StatutDeclaration.MASQUEE]: [],
  [StatutDeclaration.ANNULEE]: [],
  [StatutDeclaration.RESTITUEE]: []
};

export const checkStatusTransition = (req, res, next) => {
  const m = translations[req.locale];
  const newStatus = req.body.statut;
  const currentStatus = req.declaration.statut;
  const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN].includes(req.user.role);

  // Ces transitions passent UNIQUEMENT par /validate ou /reject
  if (currentStatus === StatutDeclaration.EN_ATTENTE &&
      [StatutDeclaration.ACTIVE, StatutDeclaration.REFUSEE].includes(newStatus)) {
    throw new AppError(409, ERROR_CODES.STATUS_TRANSITION_FORBIDDEN, m.statusTransitionForbidden);
  }

  if (isAdmin) return next();

  const allowed = AUTHOR_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(409, ERROR_CODES.STATUS_TRANSITION_FORBIDDEN, m.statusTransitionForbidden);
  }
  next();
};