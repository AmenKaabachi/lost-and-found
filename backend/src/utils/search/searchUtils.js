// 1. Constants
const ACCENT_VARIANTS = {
  a: '[aA\u00e0\u00c0\u00e1\u00c1\u00e2\u00c2\u00e3\u00c3\u00e4\u00c4\u00e5\u00c5]',
  c: '[cC\u00e7\u00c7]',
  e: '[eE\u00e8\u00c8\u00e9\u00c9\u00ea\u00ca\u00eb\u00cb]',
  i: '[iI\u00ec\u00cc\u00ed\u00cd\u00ee\u00ce\u00ef\u00cf]',
  n: '[nN\u00f1\u00d1]',
  o: '[oO\u00f2\u00d2\u00f3\u00d3\u00f4\u00d4\u00f5\u00d5\u00f6\u00d6]',
  u: '[uU\u00f9\u00d9\u00fa\u00da\u00fb\u00db\u00fc\u00dc]',
  y: '[yY\u00fd\u00dd\u00ff]'
};

// 2. Text Normalization
export const normalizeText = (text) => String(text ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

export const lowercaseText = (text) => String(text ?? '').toLowerCase();

export const removeAccents = (text) => String(text ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

// 3. Text Whitespace
export const normalizeWhitespace = (text) => String(text ?? '')
  .replace(/\s+/g, ' ')
  .trim();

// 4. Query Tokenization
export const tokenizeQuery = (query) => {
  const normalized = normalizeText(query);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
};

// 5. Regex Helpers
export const escapeRegex = (text) => String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildKeywordRegex = (text) => {
  const normalized = normalizeText(text);
  const pattern = [...normalized]
    .map((character) => ACCENT_VARIANTS[character] || escapeRegex(character))
    .join('');

  return new RegExp(pattern, 'i');
};

export const buildPartialMatchRegex = (text) => buildKeywordRegex(text);

// 6. Search Matching
export const textMatchesKeywords = (text, query) => {
  const normalizedText = normalizeText(text);
  return tokenizeQuery(query).every((token) =>
    buildKeywordRegex(token).test(normalizedText)
  );
};

// 7. Relevance Helpers
const RELEVANCE_WEIGHTS = {
  title: 50,
  description: 20,
  object: 30,
  location: 25
};

export const calculateRelevanceScore = (declaration, query) => {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return 0;

  const details = declaration.detailsObjet || {};
  const location = declaration.lieu || {};
  let score = 0;

  for (const token of tokens) {
    const matcher = buildKeywordRegex(token);
    if (matcher.test(normalizeText(declaration.titre))) score += RELEVANCE_WEIGHTS.title;
    if (matcher.test(normalizeText(declaration.description))) score += RELEVANCE_WEIGHTS.description;

    const objectFields = [
      details.marque,
      details.modele,
      details.couleur,
      details.signesDistinctifs
    ];
    if (objectFields.some((field) => matcher.test(normalizeText(field)))) {
      score += RELEVANCE_WEIGHTS.object;
    }

    const locationFields = [location.nomLieu, location.zone];
    if (locationFields.some((field) => matcher.test(normalizeText(field)))) {
      score += RELEVANCE_WEIGHTS.location;
    }
  }

  return score;
};

// 8. Distance Helpers
export const haversineDistanceKm = (latitude1, longitude1, latitude2, longitude2) => {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const firstLatitude = toRadians(latitude1);
  const secondLatitude = toRadians(latitude2);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

// 9. Radius Helpers
export const isWithinRadius = (declaration, latitude, longitude, radiusMeters) => {
  const declarationLatitude = declaration?.lieu?.latitude;
  const declarationLongitude = declaration?.lieu?.longitude;

  if (!Number.isFinite(declarationLatitude)
    || !Number.isFinite(declarationLongitude)
    || declarationLatitude < -90
    || declarationLatitude > 90
    || declarationLongitude < -180
    || declarationLongitude > 180) {
    return false;
  }

  const distanceMeters = haversineDistanceKm(
    latitude,
    longitude,
    declarationLatitude,
    declarationLongitude
  ) * 1000;

  return distanceMeters <= radiusMeters;
};
