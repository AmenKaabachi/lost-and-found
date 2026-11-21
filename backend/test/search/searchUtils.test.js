// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  lowercaseText,
  removeAccents,
  normalizeWhitespace,
  tokenizeQuery,
  escapeRegex,
  buildKeywordRegex,
  textMatchesKeywords,
  calculateRelevanceScore,
  haversineDistanceKm,
  isWithinRadius
} from '../../src/utils/search/searchUtils.js';

// 2. Text Utility Tests
test('lowercaseText converts text to lowercase', () => {
  assert.equal(lowercaseText('IPHONE Téléphone'), 'iphone téléphone');
});

test('removeAccents removes combining accents', () => {
  assert.equal(removeAccents('Éléphant déjà'), 'Elephant deja');
});

test('normalizeText lowercases, removes accents and whitespace', () => {
  assert.equal(normalizeText('  TÉLÉPHONE   Noir  '), 'telephone noir');
});

test('normalizeWhitespace trims and collapses whitespace', () => {
  assert.equal(normalizeWhitespace('  iPhone\t noir\n  '), 'iPhone noir');
});

test('tokenizeQuery handles normal and empty input', () => {
  assert.deepEqual(tokenizeQuery(' iPhone   noir '), ['iphone', 'noir']);
  assert.deepEqual(tokenizeQuery('   '), []);
  assert.deepEqual(tokenizeQuery(null), []);
});

test('escapeRegex escapes regular-expression characters', () => {
  assert.equal(escapeRegex('a+b.*?'), 'a\\+b\\.\\*\\?');
});

test('buildKeywordRegex matches accented variants and is anchored by input text', () => {
  const regex = buildKeywordRegex('eleve');
  assert.equal(regex.test('ÉLÈVE'), true);
  assert.equal(buildKeywordRegex('').test(''), true);
});

test('textMatchesKeywords matches all tokens', () => {
  assert.equal(textMatchesKeywords('Téléphone iPhone noir', 'iphone noir'), true);
  assert.equal(textMatchesKeywords('Téléphone iPhone noir', 'samsung noir'), false);
  assert.equal(textMatchesKeywords('', ''), true);
});

// 3. Relevance and Distance Tests
test('relevance ranks title matches above description-only matches', () => {
  const titleMatch = { titre: 'Sac Samsung', description: 'Objet', detailsObjet: {}, lieu: {} };
  const descriptionMatch = { titre: 'Objet', description: 'Sac Samsung', detailsObjet: {}, lieu: {} };
  assert.ok(calculateRelevanceScore(titleMatch, 'sac samsung') >
    calculateRelevanceScore(descriptionMatch, 'sac samsung'));
});

test('relevance considers multiple tokens and object or location fields', () => {
  const objectMatch = {
    titre: 'Objet',
    description: 'Objet',
    detailsObjet: { marque: 'Samsung', couleur: 'rouge' },
    lieu: { nomLieu: 'B12', zone: 'Bloc A' }
  };
  assert.equal(calculateRelevanceScore(objectMatch, 'samsung rouge'), 60);
  assert.ok(calculateRelevanceScore(objectMatch, 'b12') > 0);
  assert.ok(calculateRelevanceScore(objectMatch, 'samsung rouge') >
    calculateRelevanceScore(objectMatch, 'samsung'));
});

test('relevance matching remains accent-insensitive', () => {
  assert.ok(calculateRelevanceScore({
    titre: 'Éléphant',
    description: '',
    detailsObjet: {},
    lieu: {}
  }, 'elephant') > 0);
});

test('haversine distance calculates nearest coordinates', () => {
  const tunisToTunis = haversineDistanceKm(36.8065, 10.1815, 36.8065, 10.1815);
  const nearbyDistance = haversineDistanceKm(36.8065, 10.1815, 36.8500, 10.2000);
  assert.equal(tunisToTunis, 0);
  assert.ok(nearbyDistance > 0 && nearbyDistance < 10);
});

test('radius helper includes declarations inside the radius and excludes missing coordinates', () => {
  const sac = { lieu: { latitude: 36.8066, longitude: 10.1816 } };
  const trousse = { lieu: { latitude: 36.8100, longitude: 10.1850 } };
  const portefeuille = { lieu: { latitude: 36.82, longitude: 10.19 } };
  const missing = { lieu: { latitude: null, longitude: null } };

  assert.equal(isWithinRadius(sac, 36.8065, 10.1815, 500), true);
  assert.equal(isWithinRadius(trousse, 36.8065, 10.1815, 500), true);
  assert.equal(isWithinRadius(portefeuille, 36.8065, 10.1815, 500), false);
  assert.equal(isWithinRadius(missing, 36.8065, 10.1815, 500), false);
});
