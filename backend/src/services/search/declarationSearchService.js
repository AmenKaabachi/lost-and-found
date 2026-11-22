// 1. Imports
import Declaration from '../../models/Declaration.js';
import Categorie from '../../models/Categorie.js';
import { StatutDeclaration } from '../../models/enums.js';
import {
  buildKeywordRegex,
  buildPartialMatchRegex,
  calculateRelevanceScore,
  haversineDistanceKm,
  isWithinRadius,
  normalizeText,
  tokenizeQuery
} from '../../utils/search/searchUtils.js';

// 2. Constants
const PRIVATE_FIELDS_EXCLUSION = {
  declarantId: 0,
  numeroInventaire: 0,
  aiModerationReason: 0,
  aiModerationSource: 0,
  motifRefus: 0,
  isDeleted: 0,
  archivedAt: 0,
  'lieu.description': 0,
  'detailsObjet.numeroSerie': 0
};


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

const buildRadiusExpression = (latitude, longitude, radiusMeters) => {
  const radiansPerDegree = Math.PI / 180;
  const declarationLatitude = '$lieu.latitude';
  const declarationLongitude = '$lieu.longitude';

  return {
    $lte: [
      {
        $multiply: [
          6371000,
          2,
          {
            $atan2: [
              {
                $sqrt: {
                  $let: {
                    vars: {
                      latitudeDelta: {
                        $multiply: [
                          { $subtract: [declarationLatitude, latitude] },
                          radiansPerDegree
                        ]
                      },
                      longitudeDelta: {
                        $multiply: [
                          { $subtract: [declarationLongitude, longitude] },
                          radiansPerDegree
                        ]
                      },
                      referenceLatitude: { $multiply: [latitude, radiansPerDegree] },
                      declarationLatitude: { $multiply: [declarationLatitude, radiansPerDegree] }
                    },
                    in: {
                      $add: [
                        { $multiply: [{ $sin: { $divide: ['$$latitudeDelta', 2] } }, { $sin: { $divide: ['$$latitudeDelta', 2] } }] },
                        {
                          $multiply: [
                            { $cos: '$$referenceLatitude' },
                            { $cos: '$$declarationLatitude' },
                            { $multiply: [{ $sin: { $divide: ['$$longitudeDelta', 2] } }, { $sin: { $divide: ['$$longitudeDelta', 2] } }] }
                          ]
                        }
                      ]
                    }
                  }
                }
              },
              {
                $sqrt: {
                  $subtract: [
                    1,
                    {
                      $let: {
                        vars: {
                          latitudeDelta: {
                            $multiply: [
                              { $subtract: [declarationLatitude, latitude] },
                              radiansPerDegree
                            ]
                          },
                          longitudeDelta: {
                            $multiply: [
                              { $subtract: [declarationLongitude, longitude] },
                              radiansPerDegree
                            ]
                          },
                          referenceLatitude: { $multiply: [latitude, radiansPerDegree] },
                          declarationLatitude: { $multiply: [declarationLatitude, radiansPerDegree] }
                        },
                        in: {
                          $add: [
                            { $multiply: [{ $sin: { $divide: ['$$latitudeDelta', 2] } }, { $sin: { $divide: ['$$latitudeDelta', 2] } }] },
                            {
                              $multiply: [
                                { $cos: '$$referenceLatitude' },
                                { $cos: '$$declarationLatitude' },
                                { $multiply: [{ $sin: { $divide: ['$$longitudeDelta', 2] } }, { $sin: { $divide: ['$$longitudeDelta', 2] } }] }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      },
      radiusMeters
    ]
  };
};

const buildMongoFilter = ({ q, type, categorie, couleur, marque, lieu, zoneCampus, dateDebut, dateFin, lat, lng, radius }) => {
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

  if (radius !== undefined && lat !== undefined && lng !== undefined) {
    mongoFilter['lieu.latitude'] = {
      $type: 'number',
      $gte: -90,
      $lte: 90
    };
    mongoFilter['lieu.longitude'] = {
      $type: 'number',
      $gte: -180,
      $lte: 180
    };
    mongoFilter.$expr = buildRadiusExpression(Number(lat), Number(lng), Number(radius));
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

// 6. Sorting Helpers
const compareIdsDescending = (first, second) => {
  const firstId = String(first._id ?? '');
  const secondId = String(second._id ?? '');
  return secondId.localeCompare(firstId);
};

const compareDatesDescending = (first, second) => {
  const firstDate = new Date(first.dateEvenement).getTime();
  const secondDate = new Date(second.dateEvenement).getTime();
  const validFirstDate = Number.isFinite(firstDate) ? firstDate : 0;
  const validSecondDate = Number.isFinite(secondDate) ? secondDate : 0;

  return validSecondDate - validFirstDate || compareIdsDescending(first, second);
};

const hasValidCoordinates = (declaration) => {
  const latitude = declaration.lieu?.latitude;
  const longitude = declaration.lieu?.longitude;

  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
};

const sortByRelevance = (declarations, query) => declarations.sort((first, second) => {
  const scoreDifference =
    calculateRelevanceScore(second, query) - calculateRelevanceScore(first, query);

  return scoreDifference || compareDatesDescending(first, second);
});

const sortByDistance = (declarations, latitude, longitude) => declarations.sort((first, second) => {
  const firstHasCoordinates = hasValidCoordinates(first);
  const secondHasCoordinates = hasValidCoordinates(second);

  if (!firstHasCoordinates && !secondHasCoordinates) return compareIdsDescending(first, second);
  if (!firstHasCoordinates) return 1;
  if (!secondHasCoordinates) return -1;

  const firstDistance = haversineDistanceKm(
    latitude,
    longitude,
    first.lieu.latitude,
    first.lieu.longitude
  );
  const secondDistance = haversineDistanceKm(
    latitude,
    longitude,
    second.lieu.latitude,
    second.lieu.longitude
  );
  const distanceDifference = firstDistance - secondDistance;

  return distanceDifference || compareIdsDescending(first, second);
});

// 7. Search Execution
export const searchDeclarations = async (query = {}) => {
  const normalizedQuery = typeof query === 'string' ? { q: query } : query;
  const {
    page: requestedPage,
    limit: requestedLimit,
    sort = 'date',
    lat,
    lng,
    radius,
    ...filters
  } = normalizedQuery || {};
  const page = Number(requestedPage ?? 1);
  const limit = Number(requestedLimit ?? 10);
  const skip = (page - 1) * limit;
  const mongoFilter = buildMongoFilter({
    ...filters,
    lat,
    lng,
    radius
  });

  const findQuery = Declaration.find(mongoFilter);

  if (sort === 'date' && radius === undefined) {
    findQuery.sort({ dateEvenement: -1, _id: -1 }).skip(skip).limit(limit);
  } else if (sort === 'pertinence' && normalizedQuery.q) {
    findQuery.sort({ dateEvenement: -1, _id: -1 });
  } else if (sort === 'distance' || radius !== undefined) {
    findQuery.sort({ dateEvenement: -1, _id: -1 });
  } else {
    findQuery.sort({ dateEvenement: -1, _id: -1 }).skip(skip).limit(limit);
  }

  const [totalResults, declarations] = await Promise.all([
    Declaration.countDocuments(mongoFilter),
    findQuery
    .select(PRIVATE_FIELDS_EXCLUSION)
    .populate('categorieId', 'nom')
    .lean()
  ]);

  let orderedDeclarations = declarations;

  if (radius !== undefined) {
    orderedDeclarations = declarations.filter((declaration) =>
      isWithinRadius(declaration, Number(lat), Number(lng), Number(radius))
    );
  }

  if (sort === 'pertinence' && normalizedQuery.q) {
    orderedDeclarations = sortByRelevance(orderedDeclarations, normalizedQuery.q);
  } else if (sort === 'distance') {
    orderedDeclarations = sortByDistance(orderedDeclarations, Number(lat), Number(lng));
  }

  const paginatedDeclarations = (
    sort === 'pertinence' && normalizedQuery.q
    || sort === 'distance'
    || radius !== undefined
  )
    ? orderedDeclarations.slice(skip, skip + limit)
    : orderedDeclarations;
  const exactTotalResults = radius !== undefined
    ? orderedDeclarations.length
    : totalResults;

  return {
    declarations: paginatedDeclarations.map(toPublicDeclaration),
    pagination: buildPagination(page, limit, exactTotalResults)
  };
};

// 8. Map Search
const toMapDeclaration = (declaration) => {
  const lieu = declaration.lieu || {};
  const categorie = declaration.categorieId;

  return {
    _id: declaration._id,
    type: declaration.type,
    titre: declaration.titre,
    categorie: categorie && typeof categorie === 'object'
      ? { _id: categorie._id, nom: categorie.nom }
      : categorie,
    lieu: {
      nomLieu: lieu.nomLieu ?? null,
      zone: lieu.zone ?? null,
      latitude: lieu.latitude,
      longitude: lieu.longitude
    },
    dateEvenement: declaration.dateEvenement,
    photos: declaration.photos || []
  };
};

export const searchDeclarationsOnMap = async (query = {}) => {
  const normalizedQuery = query || {};
  const limit = Number(normalizedQuery.limit ?? 100);
  const mongoFilter = {
    statut: StatutDeclaration.ACTIVE,
    isDeleted: false,
    'lieu.latitude': {
      $type: 'number',
      $gte: Number(normalizedQuery.minLat),
      $lte: Number(normalizedQuery.maxLat)
    },
    'lieu.longitude': {
      $type: 'number',
      $gte: Number(normalizedQuery.minLng),
      $lte: Number(normalizedQuery.maxLng)
    }
  };

  if (normalizedQuery.type) mongoFilter.type = normalizedQuery.type;
  if (normalizedQuery.categorie) mongoFilter.categorieId = normalizedQuery.categorie;

  const declarations = await Declaration.find(mongoFilter)
    .sort({ dateEvenement: -1, _id: -1 })
    .limit(limit)
    .select({
      declarantId: 0,
      description: 0,
      detailsObjet: 0,
      declarant: 0,
      statut: 0,
      statutGarde: 0,
      isDeleted: 0,
      archivedAt: 0,
      aiModerationReason: 0,
      aiModerationSource: 0,
      motifRefus: 0,
      numeroInventaire: 0,
      contactVisible: 0,
      createdAt: 0,
      updatedAt: 0,
      'lieu.description': 0
    })
    .populate('categorieId', 'nom')
    .lean();

  return declarations.map(toMapDeclaration);
};
 

// 9. Suggestions
const SUGGESTION_CANDIDATES_LIMIT = 50;

export const searchSuggestions = async ({ q, limit = 10 }) => {
  const matcher = buildKeywordRegex(q);
  const normalizedQuery = normalizeText(q);

  const [categories, declarations] = await Promise.all([
    Categorie.find({ active: true, nom: matcher })
      .sort({ nom: 1 })
      .limit(limit)
      .select({ nom: 1 })
      .lean(),
    Declaration.find({
      statut: StatutDeclaration.ACTIVE,
      isDeleted: false,
      archivedAt: null,
      titre: matcher
    })
      .sort({ dateEvenement: -1, _id: -1 })
      .limit(SUGGESTION_CANDIDATES_LIMIT)
      .select({ titre: 1 })
      .lean()
  ]);

  const seenTitles = new Set();
  const titles = [];

  for (const { titre } of declarations) {
    const title = String(titre ?? '').trim();
    const key = normalizeText(title);

    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
    titles.push(title);
  }

  const startsWithQuery = (title) => normalizeText(title).startsWith(normalizedQuery);
  titles.sort((first, second) => Number(startsWithQuery(second)) - Number(startsWithQuery(first)));

  return [
    ...categories.map((categorie) => ({ type: 'categorie', valeur: categorie.nom })),
    ...titles.map((title) => ({ type: 'titre', valeur: title }))
  ].slice(0, limit);
};


// 10. Recent Declarations
export const getRecentDeclarations = async ({ type, limit = 10 } = {}) => {
  const declarations = await Declaration.find(buildMongoFilter({ type }))
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .select(PRIVATE_FIELDS_EXCLUSION)
    .populate('categorieId', 'nom')
    .lean();

  return declarations.map(toPublicDeclaration);
};