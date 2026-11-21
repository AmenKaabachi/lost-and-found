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
  textMatchesKeywords
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
