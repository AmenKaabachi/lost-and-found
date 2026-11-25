import mongoose from 'mongoose';

import Signalement from '../../models/Signalement.js';
import Declaration from '../../models/Declaration.js';
import JournalAudit from '../../models/JournalAudit.js';
import Notification from '../../models/Notification.js';

import { AppError } from '../../errors/core/AppError.js';
import { ERROR_CODES } from '../../errors/core/errorCodes.js';
import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { adminMessages } from '../../errors/localization/adminTranslations.js';

import { StatutSignalement } from '../../models/enums.js';

// Un signalement "fermé" ne peut plus être modifié
const STATUTS_FERMES = [StatutSignalement.TRAITE, StatutSignalement.REJETE];

// Champs affichés quand on "populate" un utilisateur (jamais le mot de passe)
const USER_FIELDS = 'nom prenom email role';

// ─── Petites fonctions utilitaires ───────────────────────

const checkObjectId = (id, m) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, m.invalidId);
  }
};

const logAudit = (acteurId, action, signalementId, details = {}) =>
  JournalAudit.create({
    acteurId,
    action,
    typeEntite: 'Signalement',
    entiteId: signalementId,
    details
  });

const notifyAuthor = (signalement, type, titre, contenu) =>
  Notification.create({
    destinataireId: signalement.auteurId,
    type,
    titre,
    contenu,
    referenceId: signalement._id,
    referenceType: 'Signalement'
  });

// Charge un signalement ou lance une erreur 404
const findReportOr404 = async (id, m) => {
  checkObjectId(id, m);
  const signalement = await Signalement.findById(id);
  if (!signalement) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.reportNotFound);
  }
  return signalement;
};

// ─── POST /api/declarations/:id/report (utilisateur connecté) ───
export const createReport = asyncHandler(async (req, res) => {
  const m = adminMessages(req);
  const declarationId = req.params.id;
  checkObjectId(declarationId, m);

  const declaration = await Declaration.findOne({ _id: declarationId, isDeleted: false });
  if (!declaration) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.declarationNotFound);
  }

  // On ne signale pas sa propre déclaration
  if (declaration.declarantId.equals(req.user._id)) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, m.cannotReportOwnDeclaration);
  }

  // Un seul signalement "ouvert" par utilisateur et par déclaration
  const dejaSignale = await Signalement.exists({
    auteurId: req.user._id,
    declarationId,
    statut: { $nin: STATUTS_FERMES }
  });
  if (dejaSignale) {
    throw new AppError(409, ERROR_CODES.CONFLICT, m.alreadyReported);
  }

  const signalement = await Signalement.create({
    auteurId: req.user._id,
    declarationId,
    motif: req.body.reason,
    description: req.body.description || null
  });

  await logAudit(req.user._id, 'REPORT_CREATE', signalement._id, {
    declarationId,
    motif: signalement.motif
  });

  sendSuccess(res, signalement, m.reportCreated, 201);
});

// ─── GET /api/admin/reports ──────────────────────────────
// Query : status, type, declarationId, page, limit
export const listReports = asyncHandler(async (req, res) => {
  const m = adminMessages(req);
  const { status, type, declarationId, page, limit } = req.query;

  const filter = {};
  if (status) filter.statut = status;
  if (type) filter.motif = type;
  if (declarationId) filter.declarationId = declarationId;

  const [reports, total] = await Promise.all([
    Signalement.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('auteurId', USER_FIELDS)
      .populate('declarationId', 'titre type statut')
      .populate('traiteParId', USER_FIELDS),
    Signalement.countDocuments(filter)
  ]);

  sendSuccess(res, { reports, total, page, limit, pages: Math.ceil(total / limit) }, m.reportsFetched);
});

// ─── GET /api/admin/reports/:id ──────────────────────────
export const getReportById = asyncHandler(async (req, res) => {
  const m = adminMessages(req);
  checkObjectId(req.params.id, m);

  const signalement = await Signalement.findById(req.params.id)
    .populate('auteurId', USER_FIELDS)
    .populate('declarationId')
    .populate('traiteParId', USER_FIELDS);

  if (!signalement) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.reportNotFound);
  }

  // Bonus utile pour l'admin : combien de signalements a reçu cette déclaration ?
  const totalSignalementsDeclaration = await Signalement.countDocuments({
    declarationId: signalement.declarationId?._id
  });

  sendSuccess(res, { report: signalement, totalSignalementsDeclaration }, m.reportFetched);
});

// ─── PATCH /api/admin/reports/:id ────────────────────────
// Body : { status: EN_EXAMEN | TRAITE, resolutionNotes? }
export const updateReport = asyncHandler(async (req, res) => {
  const m = adminMessages(req);
  const signalement = await findReportOr404(req.params.id, m);

  if (STATUTS_FERMES.includes(signalement.statut)) {
    throw new AppError(409, ERROR_CODES.CONFLICT, m.reportAlreadyClosed);
  }

  const ancienStatut = signalement.statut;
  signalement.statut = req.body.status;
  if (req.body.resolutionNotes !== undefined) {
    signalement.notesResolution = req.body.resolutionNotes;
  }
  if (req.body.status === StatutSignalement.TRAITE) {
    signalement.traiteParId = req.user._id;
    signalement.traiteAt = new Date();
  }
  await signalement.save();

  await logAudit(req.user._id, 'REPORT_UPDATE', signalement._id, {
    ancienStatut,
    nouveauStatut: signalement.statut,
    notesResolution: signalement.notesResolution
  });

  if (signalement.statut === StatutSignalement.TRAITE) {
    await notifyAuthor(signalement, 'SIGNALEMENT_TRAITE', m.notifReportTreatedTitle, m.notifReportTreatedBody);
  }

  sendSuccess(res, signalement, m.reportUpdated);
});

// ─── POST /api/admin/reports/:id/dismiss ─────────────────
// Body : { justification }
export const dismissReport = asyncHandler(async (req, res) => {
  const m = adminMessages(req);
  const signalement = await findReportOr404(req.params.id, m);

  if (STATUTS_FERMES.includes(signalement.statut)) {
    throw new AppError(409, ERROR_CODES.CONFLICT, m.reportAlreadyClosed);
  }

  const ancienStatut = signalement.statut;
  signalement.statut = StatutSignalement.REJETE;
  signalement.notesResolution = req.body.justification;
  signalement.traiteParId = req.user._id;
  signalement.traiteAt = new Date();
  await signalement.save();

  await logAudit(req.user._id, 'REPORT_DISMISS', signalement._id, {
    ancienStatut,
    justification: req.body.justification
  });

  await notifyAuthor(signalement, 'SIGNALEMENT_REJETE', m.notifReportDismissedTitle, m.notifReportDismissedBody);

  sendSuccess(res, signalement, m.reportDismissed);
});
