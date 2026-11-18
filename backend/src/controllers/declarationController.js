import Declaration from '../models/Declaration.js';
import Categorie from '../models/Categorie.js';
import JournalAudit from '../models/JournalAudit.js';
import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';
import { Role, StatutDeclaration, StatutGarde, TypeDeclaration } from '../models/enums.js';

const logAction = async (acteurId, action, entiteId, details = {}) => {
  await JournalAudit.create({
    acteurId,
    action,
    typeEntite: 'Declaration',
    entiteId,
    details
  });
};

export const createDeclaration = asyncHandler(async (req, res) => {
  const photos = req.files ? req.files.map(f => f.path) : [];

  const categorieName = (req.body.categorie || '').trim();
  if (!categorieName) throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Catégorie requise');

  let categorieDoc = await Categorie.findOne({ nom: categorieName, active: true });
  if (!categorieDoc) categorieDoc = await Categorie.create({ nom: categorieName });

  const statut = req.moderationResult.statut === 'ACTIVE'
    ? StatutDeclaration.ACTIVE
    : StatutDeclaration.EN_ATTENTE;

  const declaration = await Declaration.create({
    declarantId: req.user._id,
    type: req.body.type,
    titre: req.body.titre,
    description: req.body.description,
    categorieId: categorieDoc._id,
    dateEvenement: req.body.dateEvenement,
    lieu: {
      nomLieu: req.body.lieuNom || null,
      zone: req.body.zoneCampus || null,
      latitude: req.body.latitude ? Number(req.body.latitude) : null,
      longitude: req.body.longitude ? Number(req.body.longitude) : null
    },
    detailsObjet: {
      couleur: req.body.couleur || null,
      marque: req.body.marque || null
    },
    photos,
    contactVisible: req.body.contactVisible === 'true' || req.body.contactVisible === true,
    statut,
    aiModerationReason: req.moderationResult.reason,
    aiModerationSource: req.moderationResult.source,
    statutGarde: req.body.type === TypeDeclaration.TROUVE ? StatutGarde.WITH_FINDER : StatutGarde.UNKNOWN
  });

  await logAction(req.user._id, 'CREATE', declaration._id, { statut, type: declaration.type });
  sendSuccess(res, declaration, `Declaration created with status ${statut}`, 201);
});

export const getDeclarationById = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const declaration = await Declaration.findOne({ _id: req.params.id, isDeleted: false })
    .populate('declarantId', 'nom prenom email telephone avatar')
    .populate('categorieId', 'nom');

  if (!declaration) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound('Déclaration'));

  const isOwner = declaration.declarantId._id.toString() === req.user._id.toString();
  const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN].includes(req.user.role);

  if (declaration.statut !== StatutDeclaration.ACTIVE && !isOwner && !isAdmin) {
    throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound('Déclaration'));
  }

  const data = declaration.toJSON();
  if (!isOwner && !isAdmin) {
    delete data.numeroInventaire;
    if (!data.contactVisible && data.declarantId) delete data.declarantId.telephone;
  }
  sendSuccess(res, data);
});

export const updateDeclaration = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const declaration = req.declaration;

  if ([StatutDeclaration.MASQUEE, StatutDeclaration.ANNULEE, StatutDeclaration.RESTITUEE].includes(declaration.statut)) {
    throw new AppError(409, ERROR_CODES.STATUS_TRANSITION_FORBIDDEN, m.statusTransitionForbidden);
  }

  const isOwner = req.user._id.toString() === declaration.declarantId.toString();

  if (req.body.titre) declaration.titre = req.body.titre;
  if (req.body.description) declaration.description = req.body.description;
  if (req.body.categorie) {
    let catDoc = await Categorie.findOne({ nom: req.body.categorie.trim(), active: true });
    if (!catDoc) catDoc = await Categorie.create({ nom: req.body.categorie.trim() });
    declaration.categorieId = catDoc._id;
  }
  if (req.body.dateEvenement) declaration.dateEvenement = req.body.dateEvenement;
  if (req.body.zoneCampus !== undefined || req.body.lieuNom !== undefined ||
      req.body.latitude !== undefined || req.body.longitude !== undefined) {
    declaration.lieu = {
      nomLieu: req.body.lieuNom !== undefined ? req.body.lieuNom : declaration.lieu.nomLieu,
      zone: req.body.zoneCampus !== undefined ? req.body.zoneCampus : declaration.lieu.zone,
      latitude: req.body.latitude !== undefined ? Number(req.body.latitude) : declaration.lieu.latitude,
      longitude: req.body.longitude !== undefined ? Number(req.body.longitude) : declaration.lieu.longitude
    };
  }
  if (req.body.couleur !== undefined) declaration.detailsObjet.couleur = req.body.couleur;
  if (req.body.marque !== undefined) declaration.detailsObjet.marque = req.body.marque;
  if (req.body.contactVisible !== undefined) {
    declaration.contactVisible = req.body.contactVisible === 'true' || req.body.contactVisible === true;
  }
  if (req.files && req.files.length > 0) declaration.photos = req.files.map(f => f.path);

  if (isOwner && req.moderationResult) {
    const oldStatut = declaration.statut;
    declaration.statut = req.moderationResult.statut === 'ACTIVE'
      ? StatutDeclaration.ACTIVE
      : StatutDeclaration.EN_ATTENTE;
    declaration.aiModerationReason = req.moderationResult.reason;
    declaration.aiModerationSource = req.moderationResult.source;

    if (oldStatut !== declaration.statut) {
      await logAction(req.user._id, 'STATUS_CHANGE', declaration._id, {
        ancienStatut: oldStatut,
        nouveauStatut: declaration.statut,
        raison: 'Re-analyse IA après modification'
      });
    }
  }

  await declaration.save();
  sendSuccess(res, declaration, 'Declaration updated');
});

export const updateDeclarationStatus = asyncHandler(async (req, res) => {
  const declaration = req.declaration;
  const ancienStatut = declaration.statut;

  declaration.statut = req.body.statut;
  if (req.body.motif && req.body.statut === StatutDeclaration.MASQUEE) {
    declaration.motifRefus = req.body.motif;
  }
  await declaration.save();

  await logAction(req.user._id, 'STATUS_CHANGE', declaration._id, {
    ancienStatut,
    nouveauStatut: req.body.statut,
    motif: req.body.motif
  });

  sendSuccess(res, declaration, 'Status updated');
});

export const deleteDeclaration = asyncHandler(async (req, res) => {
  req.declaration.isDeleted = true;
  await req.declaration.save();
  await logAction(req.user._id, 'DELETE', req.declaration._id, {});
  sendSuccess(res, null, 'Declaration deleted');
});

export const getDeclarationHistory = asyncHandler(async (req, res) => {
  const history = await JournalAudit.find({
    entiteId: req.params.id,
    typeEntite: 'Declaration'
  })
    .sort({ createdAt: 1 })
    .populate('acteurId', 'nom prenom email');
  sendSuccess(res, history);
});

export const getModerationQueue = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, source, dateDebut, dateFin, sort } = req.query;
  const query = { statut: StatutDeclaration.EN_ATTENTE, isDeleted: false };
  if (type) query.type = type;
  if (source) query.aiModerationSource = source;
  if (dateDebut || dateFin) {
    query.createdAt = {};
    if (dateDebut) query.createdAt.$gte = new Date(dateDebut);
    if (dateFin) query.createdAt.$lte = new Date(dateFin);
  }

  const sortOrder = sort === 'desc' ? -1 : 1;
  const declarations = await Declaration.find(query)
    .sort({ createdAt: sortOrder })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('declarantId', 'nom prenom email');

  const total = await Declaration.countDocuments(query);
  sendSuccess(res, { declarations, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

export const validateDeclaration = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const declaration = req.declaration;
  if (declaration.statut !== StatutDeclaration.EN_ATTENTE) {
    throw new AppError(409, ERROR_CODES.STATUS_TRANSITION_FORBIDDEN, m.declarationNotPending);
  }

  const ancienStatut = declaration.statut;
  declaration.statut = StatutDeclaration.ACTIVE;
  await declaration.save();

  await logAction(req.user._id, 'VALIDATE', declaration._id, {
    ancienStatut,
    nouveauStatut: declaration.statut
  });

  sendSuccess(res, declaration, 'Declaration validated and published');
});

export const rejectDeclaration = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const declaration = req.declaration;
  if (declaration.statut !== StatutDeclaration.EN_ATTENTE) {
    throw new AppError(409, ERROR_CODES.STATUS_TRANSITION_FORBIDDEN, m.declarationNotPending);
  }

  const ancienStatut = declaration.statut;
  declaration.statut = StatutDeclaration.REFUSEE;
  declaration.motifRefus = req.body.motif;
  await declaration.save();

  await logAction(req.user._id, 'REJECT', declaration._id, {
    ancienStatut,
    nouveauStatut: declaration.statut,
    motif: req.body.motif
  });

  sendSuccess(res, declaration, 'Declaration rejected');
});