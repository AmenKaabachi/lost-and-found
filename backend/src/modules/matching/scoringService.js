
import { getSemanticSimilarity } from './nlpClient.js';
import { TypeDeclaration, MoyenTransport } from '../../models/enums.js';

const WEIGHTS = {
  semantic: 45,
  category: 15,
  attributes: 15,
  date: 10,
  location: 10,
  profile: 5
};

const CONFIDENCE_THRESHOLDS = {
  HIGH: 80,
  MEDIUM: 55
};

// Répartition interne du critère profil.
const PROFILE_WEIGHTS = {
  establishment: 40,
  residence: 40,
  transport: 20
};

const VALID_TRANSPORTS = new Set(
  Object.values(MoyenTransport).map(value => normalizeText(value))
);

function normalizeText(value) {
  if (typeof value !== 'string') return '';

  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function calculateTextSimilarity(valueA, valueB) {
  const a = normalizeText(valueA);
  const b = normalizeText(valueB);

  if (!a || !b) return null;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;

  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));

  const intersection = [...wordsA].filter(word => wordsB.has(word));
  const union = new Set([...wordsA, ...wordsB]);

  return Number(((intersection.length / union.size) * 100).toFixed(2));
}

function buildDeclarationText(declaration) {
  const details = declaration.detailsObjet || {};

  return [
    declaration.titre,
    declaration.description,
    details.marque ? `Marque : ${details.marque}` : '',
    details.couleur ? `Couleur : ${details.couleur}` : '',
    details.modele ? `Modèle : ${details.modele}` : '',
    details.signesDistinctifs
      ? `Signes distinctifs : ${details.signesDistinctifs}`
      : ''
  ].filter(Boolean).join('. ');
}

function calculateCategoryScore(lost, found) {
  if (!lost.categorieId || !found.categorieId) return null;

  return String(lost.categorieId) === String(found.categorieId)
    ? 100
    : 0;
}

function calculateAttributesScore(lost, found) {
  const fields = [
    'marque',
    'couleur',
    'modele',
    'numeroSerie',
    'signesDistinctifs'
  ];

  const detailsLost = lost.detailsObjet || {};
  const detailsFound = found.detailsObjet || {};

  const scores = [];

  for (const field of fields) {
    const valueLost = detailsLost[field];
    const valueFound = detailsFound[field];

    if (
      typeof valueLost !== 'string' ||
      typeof valueFound !== 'string' ||
      !valueLost.trim() ||
      !valueFound.trim()
    ) {
      continue;
    }

    if (field === 'numeroSerie') {
      scores.push(
        normalizeText(valueLost) === normalizeText(valueFound) ? 100 : 0
      );
      continue;
    }

    const score = calculateTextSimilarity(valueLost, valueFound);

    if (score !== null) {
      scores.push(score);
    }
  }

  if (scores.length === 0) return null;

  return Number(
    (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)
  );
}

function calculateDateScore(lost, found) {
  const dateLost = new Date(lost.dateEvenement);
  const dateFound = new Date(found.dateEvenement);

  if (
    Number.isNaN(dateLost.getTime()) ||
    Number.isNaN(dateFound.getTime())
  ) {
    return null;
  }

  const differenceDays = Math.abs(
    dateLost.getTime() - dateFound.getTime()
  ) / (1000 * 60 * 60 * 24);

  if (differenceDays <= 7) return 100;
  if (differenceDays >= 30) return 0;

  return Number((100 * (30 - differenceDays) / 23).toFixed(2));
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371;
  const toRadians = value => value * Math.PI / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function distanceToScore(distance) {
  if (distance <= 0.1) return 100;
  if (distance <= 0.5) return 90;
  if (distance <= 1) return 80;
  if (distance <= 5) return 60;
  if (distance <= 10) return 40;
  if (distance <= 20) return 20;

  return 0;
}

function calculateLocationScore(lost, found) {
  const locationLost = lost.lieu || {};
  const locationFound = found.lieu || {};

  const coordinatesAvailable =
    Number.isFinite(locationLost.latitude) &&
    Number.isFinite(locationLost.longitude) &&
    Number.isFinite(locationFound.latitude) &&
    Number.isFinite(locationFound.longitude);

  if (coordinatesAvailable) {
    const distance = calculateDistanceKm(
      locationLost.latitude,
      locationLost.longitude,
      locationFound.latitude,
      locationFound.longitude
    );

    return distanceToScore(distance);
  }

  const textLost = [
    locationLost.nomLieu,
    locationLost.zone
  ].filter(Boolean).join(' ');

  const textFound = [
    locationFound.nomLieu,
    locationFound.zone
  ].filter(Boolean).join(' ');

  return calculateTextSimilarity(textLost, textFound);
}

/**
 * Compare les profils des deux déclarants.
 * declarantId doit être un document Utilisateur peuplé avec populate().
 */
function calculateProfileScore(lost, found) {
  const profileLost = lost.declarantId;
  const profileFound = found.declarantId;

  if (
    !profileLost ||
    !profileFound ||
    typeof profileLost !== 'object' ||
    typeof profileFound !== 'object'
  ) {
    return null;
  }

  const availableScores = [];

  // Comparaison de l'établissement.
  const establishmentScore = calculateTextSimilarity(
    profileLost.nomEtablissement,
    profileFound.nomEtablissement
  );

  if (establishmentScore !== null) {
    availableScores.push({
      score: establishmentScore,
      weight: PROFILE_WEIGHTS.establishment
    });
  }

  // Comparaison du lieu de résidence.
  const residenceScore = calculateTextSimilarity(
    profileLost.lieuResidence,
    profileFound.lieuResidence
  );

  if (residenceScore !== null) {
    availableScores.push({
      score: residenceScore,
      weight: PROFILE_WEIGHTS.residence
    });
  }

  // Comparaison du moyen de transport.
  const transportLost = normalizeText(profileLost.moyenTransport);
  const transportFound = normalizeText(profileFound.moyenTransport);

  if (
    transportLost &&
    transportFound &&
    VALID_TRANSPORTS.has(transportLost) &&
    VALID_TRANSPORTS.has(transportFound)
  ) {
    availableScores.push({
      score: transportLost === transportFound ? 100 : 0,
      weight: PROFILE_WEIGHTS.transport
    });
  }

  if (availableScores.length === 0) {
    return null;
  }

  const totalWeight = availableScores.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  const weightedSum = availableScores.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  );

  return Number((weightedSum / totalWeight).toFixed(2));
}

function getConfidenceLevel(score) {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'MEDIUM';

  return 'LOW';
}

export async function calculateMatchScore(declarationA, declarationB) {
  if (!declarationA || !declarationB) {
    throw new Error('Deux déclarations sont nécessaires.');
  }

  let lost;
  let found;

  if (
    declarationA.type === TypeDeclaration.PERDU &&
    declarationB.type === TypeDeclaration.TROUVE
  ) {
    lost = declarationA;
    found = declarationB;
  } else if (
    declarationB.type === TypeDeclaration.PERDU &&
    declarationA.type === TypeDeclaration.TROUVE
  ) {
    lost = declarationB;
    found = declarationA;
  } else {
    throw new Error(
      'La comparaison nécessite une déclaration PERDU et une déclaration TROUVE.'
    );
  }

  const semanticResult = await getSemanticSimilarity(
    buildDeclarationText(lost),
    buildDeclarationText(found)
  );

  const criteria = {
    semantic: semanticResult.percentage,
    category: calculateCategoryScore(lost, found),
    attributes: calculateAttributesScore(lost, found),
    date: calculateDateScore(lost, found),
    location: calculateLocationScore(lost, found),
    profile: calculateProfileScore(lost, found)
  };

  const availableCriteria = Object.entries(criteria).filter(
    ([, score]) => typeof score === 'number' && Number.isFinite(score)
  );

  const availableWeight = availableCriteria.reduce(
    (sum, [criterion]) => sum + WEIGHTS[criterion],
    0
  );

  if (availableWeight === 0) {
    throw new Error('Aucun critère disponible pour le calcul du score.');
  }

  const weightedSum = availableCriteria.reduce(
    (sum, [criterion, score]) => sum + score * WEIGHTS[criterion],
    0
  );

  const globalScore = Number(
    (weightedSum / availableWeight).toFixed(2)
  );

  const breakdown = {};

  for (const [criterion, score] of Object.entries(criteria)) {
    const weight = WEIGHTS[criterion];

    breakdown[criterion] = {
      score,
      initialWeight: weight,
      available: score !== null,
      contribution: score === null
        ? null
        : Number(
            (score * weight / availableWeight).toFixed(2)
          )
    };
  }

  return {
    score: globalScore,
    confidence: getConfidenceLevel(globalScore),
    method: 'AUTO_NLP',
    model: semanticResult.model,
    availableWeight,
    breakdown
  };
}
