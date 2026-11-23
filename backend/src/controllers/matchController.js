
import mongoose from 'mongoose';

import Correspondance from '../models/Correspondance.js';
import Declaration from '../models/Declaration.js';
import JournalAudit from '../models/JournalAudit.js';

import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';

import { asyncHandler } from '../errors/middleware/asyncHandler.js';
import { Role } from '../models/enums.js';

const isAdmin = (user) =>
  [Role.ADMIN, Role.SUPER_ADMIN].includes(user.role);

const checkDeclarationAccess = (declaration, user, m) => {
  if (!declaration) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      m.notFound('Déclaration')
    );
  }

  const isOwner =
    declaration.declarantId.toString() === user._id.toString();

  if (!isOwner && !isAdmin(user)) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      m.forbidden
    );
  }
};

const validateObjectId = (id, m, resource = 'Ressource') => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Identifiant ${resource} invalide`
    );
  }
};

const populateCorrespondance = (query) => {
  return query
    .populate({
      path: 'declarationPerdueId',
      select: 'titre description type dateEvenement lieu detailsObjet photos statut categorieId declarantId isDeleted',
      populate: {
        path: 'categorieId',
        select: 'nom'
      }
    })
    .populate({
      path: 'declarationTrouveeId',
      select: 'titre description type dateEvenement lieu detailsObjet photos statut categorieId declarantId isDeleted',
      populate: {
        path: 'categorieId',
        select: 'nom'
      }
    })
    .populate('valideeParId', 'nom prenom');
};

// GET /api/matches
export const getMatches = asyncHandler(async (req, res) => {
  const m = translations[req.locale];

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 20, 1),
    100
  );

  const filter = {};

  if (req.query.statut) {
    filter.statut = req.query.statut;
  }

  if (req.query.minScore !== undefined) {
    const minScore = Number(req.query.minScore);

    if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Le score minimum doit être compris entre 0 et 100'
      );
    }

    filter.score = { ...filter.score, $gte: minScore };
  }

  if (req.query.maxScore !== undefined) {
    const maxScore = Number(req.query.maxScore);

    if (!Number.isFinite(maxScore) || maxScore < 0 || maxScore > 100) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Le score maximum doit être compris entre 0 et 100'
      );
    }

    filter.score = { ...filter.score, $lte: maxScore };
  }

  if (
    filter.score?.$gte !== undefined &&
    filter.score?.$lte !== undefined &&
    filter.score.$gte > filter.score.$lte
  ) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Le score minimum ne peut pas dépasser le score maximum'
    );
  }

  // Un administrateur peut consulter toutes les correspondances
  // liées à des déclarations non supprimées.
  // Un membre ne voit que les correspondances de ses déclarations.
  const declarationFilter = { isDeleted: false };

  if (!isAdmin(req.user)) {
    declarationFilter.declarantId = req.user._id;
  }

  const declarations = await Declaration.find(declarationFilter)
    .select('_id')
    .lean();

  const declarationIds = declarations.map((declaration) => declaration._id);

  if (declarationIds.length === 0) {
    return sendSuccess(res, {
      matches: [],
      total: 0,
      page,
      limit,
      pages: 0
    });
  }

  filter.$or = [
    { declarationPerdueId: { $in: declarationIds } },
    { declarationTrouveeId: { $in: declarationIds } }
  ];

  const [matches, total] = await Promise.all([
    populateCorrespondance(
      Correspondance.find(filter)
        .sort({ score: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ),
    Correspondance.countDocuments(filter)
  ]);

  // Ne pas afficher une correspondance si l'autre déclaration
  // a été supprimée.
  const visibleMatches = matches.filter(
    (match) =>
      match.declarationPerdueId &&
      match.declarationTrouveeId &&
      !match.declarationPerdueId.isDeleted &&
      !match.declarationTrouveeId.isDeleted
  );

  sendSuccess(res, {
    matches: visibleMatches,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  });
});

// GET /api/matches/:id
export const getMatchById = asyncHandler(async (req, res) => {
  const m = translations[req.locale];

  validateObjectId(req.params.id, m, 'correspondance');

  const match = await populateCorrespondance(
    Correspondance.findById(req.params.id)
  );

  if (
    !match ||
    !match.declarationPerdueId ||
    !match.declarationTrouveeId ||
    match.declarationPerdueId.isDeleted ||
    match.declarationTrouveeId.isDeleted
  ) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      m.notFound('Correspondance')
    );
  }

  checkDeclarationAccess(match.declarationPerdueId, req.user, m);
  checkDeclarationAccess(match.declarationTrouveeId, req.user, m);

  sendSuccess(res, match);
});

// GET /api/matches/:id/history
export const getMatchHistory = asyncHandler(async (req, res) => {
  const m = translations[req.locale];

  validateObjectId(req.params.id, m, 'correspondance');

  const match = await Correspondance.findById(req.params.id)
    .populate('declarationPerdueId', 'declarantId isDeleted')
    .populate('declarationTrouveeId', 'declarantId isDeleted');

  if (
    !match ||
    !match.declarationPerdueId ||
    !match.declarationTrouveeId ||
    match.declarationPerdueId.isDeleted ||
    match.declarationTrouveeId.isDeleted
  ) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      m.notFound('Correspondance')
    );
  }

  checkDeclarationAccess(match.declarationPerdueId, req.user, m);
  checkDeclarationAccess(match.declarationTrouveeId, req.user, m);

  const history = await JournalAudit.find({
    entiteId: match._id,
    typeEntite: 'Correspondance'
  })
    .sort({ createdAt: 1 })
    .populate('acteurId', 'nom prenom');

  sendSuccess(res, history);
});

// GET /api/declarations/:id/matches
export const getDeclarationMatches = asyncHandler(async (req, res) => {
  const m = translations[req.locale];

  validateObjectId(req.params.id, m, 'déclaration');

  const declaration = await Declaration.findOne({
    _id: req.params.id,
    isDeleted: false
  });

  checkDeclarationAccess(declaration, req.user, m);

  const filter = {
    $or: [
      { declarationPerdueId: declaration._id },
      { declarationTrouveeId: declaration._id }
    ]
  };

  if (req.query.statut) {
    filter.statut = req.query.statut;
  }

  const matches = await populateCorrespondance(
    Correspondance.find(filter).sort({
      score: -1,
      createdAt: -1
    })
  );

  const visibleMatches = matches.filter(
    (match) =>
      match.declarationPerdueId &&
      match.declarationTrouveeId &&
      !match.declarationPerdueId.isDeleted &&
      !match.declarationTrouveeId.isDeleted
  );

  sendSuccess(res, visibleMatches);
});
