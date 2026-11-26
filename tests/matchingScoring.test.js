import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateMatchScore } from '../backend/src/modules/matching/scoringService.js';
import { DEFAULT_MATCHING_SETTINGS } from '../backend/src/modules/matching/settingsService.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('scores other available criteria when NLP service is unavailable', async () => {
  globalThis.fetch = async () => {
    throw new Error('NLP service unavailable');
  };

  const sharedProfile = {
    nomEtablissement: 'ISAMM',
    lieuResidence: 'Manouba',
    moyenTransport: 'BUS'
  };
  const lost = {
    type: 'PERDU',
    titre: 'Sac bleu',
    description: 'Sac à dos perdu près de la bibliothèque',
    categorieId: 'category-1',
    detailsObjet: { couleur: 'bleu', marque: 'Test' },
    dateEvenement: new Date('2026-01-01'),
    lieu: { nomLieu: 'Bibliothèque', zone: 'Campus' },
    declarantId: sharedProfile
  };
  const found = {
    ...lost,
    type: 'TROUVE',
    declarantId: { ...sharedProfile }
  };

  const result = await calculateMatchScore(
    lost,
    found,
    DEFAULT_MATCHING_SETTINGS
  );

  assert.equal(result.score, 100);
  assert.equal(result.breakdown.semantic.available, false);
  assert.equal(result.availableWeight, 55);
  assert.deepEqual(result.degradedCriteria, ['semantic']);
});
