// 1. Imports
import Declaration from '../../models/Declaration.js';
import { StatutDeclaration } from '../../models/enums.js';
import {
  buildKeywordRegex,
  buildPartialMatchRegex,
  tokenizeQuery
} from '../../utils/search/searchUtils.js';

// 2. Constants
const SEARCHABLE_FIELDS = [
  'titre',
  'description',
  'detailsObjet.marque',
  'detailsObjet.modele',
  'detailsObjet.couleur',
  'detailsObjet.signesDistinctifs',
  'lieu.nomLieu',
  'lieu.zone'
];

// 3. Data Transformation
const toPublicDeclaration = (declaration) => {
  const detailsObjet = declaration.detailsObjet || {};
  const lieu = declaration.lieu || {};
  const categorie = declaration.categorieId;

  return {
    _id: declaration._id,
    type: declaration.type,
    titre: declaration.titre,
    description: declaration.description,
    categorie: categorie && typeof categorie === 'object'
      ? { _id: categorie._id, nom: categorie.nom }
      : categorie,
    detailsObjet: {
      marque: detailsObjet.marque ?? null,
      modele: detailsObjet.modele ?? null,
      couleur: detailsObjet.couleur ?? null,
      signesDistinctifs: detailsObjet.signesDistinctifs ?? null
    },
    lieu: {
      nomLieu: lieu.nomLieu ?? null,
      zone: lieu.zone ?? null
    },
    dateEvenement: declaration.dateEvenement,
    photos: declaration.photos || [],
    statut: declaration.statut,
    statutGarde: declaration.statutGarde,
    contactVisible: declaration.contactVisible ?? true,
    createdAt: declaration.createdAt,
    updatedAt: declaration.updatedAt
  };
};

// 4. Filter Helpers
const endOfDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);

  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

const buildMongoFilter = ({ q, type, categorie, couleur, marque, lieu, zoneCampus, dateDebut, dateFin }) => {
  const mongoFilter = {
    statut: StatutDeclaration.ACTIVE,
    isDeleted: false,
    archivedAt: null
  };
  const tokens = tokenizeQuery(q);

  if (type) mongoFilter.type = type;
  if (categorie) mongoFilter.categorieId = categorie;
  if (couleur) mongoFilter['detailsObjet.couleur'] = buildPartialMatchRegex(couleur);
  if (marque) mongoFilter['detailsObjet.marque'] = buildPartialMatchRegex(marque);
  if (zoneCampus) mongoFilter['lieu.zone'] = buildPartialMatchRegex(zoneCampus);
  if (dateDebut || dateFin) {
    mongoFilter.dateEvenement = {};
    if (dateDebut) mongoFilter.dateEvenement.$gte = new Date(dateDebut);
    if (dateFin) mongoFilter.dateEvenement.$lte = endOfDateOnly(dateFin);
  }

  if (tokens.length > 0) {
    mongoFilter.$and = tokens.map((token) => ({
      $or: SEARCHABLE_FIELDS.map((field) => ({
        [field]: buildKeywordRegex(token)
      }))
    }));
  }

  if (lieu) {
    mongoFilter.$or = [
      { 'lieu.nomLieu': buildPartialMatchRegex(lieu) },
      { 'lieu.zone': buildPartialMatchRegex(lieu) }
    ];
  }

  return mongoFilter;
};

// 5. Pagination Helpers
const buildPagination = (page, limit, totalResults) => {
  const totalPages = Math.ceil(totalResults / limit);

  return {
    currentPage: page,
    limit,
    totalResults,
    totalPages,
    hasNextPage: totalResults > 0 && page < totalPages,
    hasPreviousPage: totalResults > 0 && page > 1
  };
};

// 6. Search Execution
export const searchDeclarations = async (query = {}) => {
  const normalizedQuery = typeof query === 'string' ? { q: query } : query;
  const {
    page: requestedPage,
    limit: requestedLimit,
    ...filters
  } = normalizedQuery || {};
  const page = Number(requestedPage ?? 1);
  const limit = Number(requestedLimit ?? 10);
  const skip = (page - 1) * limit;
  const mongoFilter = buildMongoFilter(filters);

  const [totalResults, declarations] = await Promise.all([
    Declaration.countDocuments(mongoFilter),
    Declaration.find(mongoFilter)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .select({
      declarantId: 0,
      numeroInventaire: 0,
      aiModerationReason: 0,
      aiModerationSource: 0,
      motifRefus: 0,
      isDeleted: 0,
      archivedAt: 0,
      'lieu.latitude': 0,
      'lieu.longitude': 0,
      'lieu.description': 0,
      'detailsObjet.numeroSerie': 0
    })
    .populate('categorieId', 'nom')
    .lean()
  ]);

  const paginatedDeclarations = declarations.map(toPublicDeclaration);

  return {
    declarations: paginatedDeclarations,
    pagination: buildPagination(page, limit, totalResults)
  };
};
