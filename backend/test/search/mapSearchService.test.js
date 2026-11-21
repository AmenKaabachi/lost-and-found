// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import Declaration from '../../src/models/Declaration.js';
import { searchDeclarationsOnMap } from '../../src/services/search/declarationSearchService.js';

// 2. Test Helpers
const matchesMapFilter = (record, filter) => {
  if (record.statut !== filter.statut || record.isDeleted !== filter.isDeleted) return false;
  if (filter.type && record.type !== filter.type) return false;
  if (filter.categorieId && String(record.categorieId?._id || record.categorieId) !== String(filter.categorieId)) return false;

  const latitude = record.lieu?.latitude;
  const longitude = record.lieu?.longitude;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return false;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return false;

  return latitude >= filter['lieu.latitude'].$gte
    && latitude <= filter['lieu.latitude'].$lte
    && longitude >= filter['lieu.longitude'].$gte
    && longitude <= filter['lieu.longitude'].$lte;
};

// 3. Geographic Filtering Tests
test('Map search applies MongoDB bounding-box and status filters', async (t) => {
  const originalFind = Declaration.find;
  const records = [
    { _id: '1', type: 'PERDU', titre: 'Inside', categorieId: { _id: 'cat-1', nom: 'Objets' }, statut: 'ACTIVE', isDeleted: false, lieu: { latitude: 36.82, longitude: 10.19 }, dateEvenement: new Date(), photos: [] },
    { _id: '2', type: 'TROUVE', titre: 'Outside', categorieId: { _id: 'cat-2', nom: 'Objets' }, statut: 'ACTIVE', isDeleted: false, lieu: { latitude: 36.84, longitude: 10.19 }, dateEvenement: new Date(), photos: [] },
    { _id: '3', type: 'TROUVE', titre: 'Min latitude', categorieId: { _id: 'cat-1', nom: 'Objets' }, statut: 'ACTIVE', isDeleted: false, lieu: { latitude: 36.80, longitude: 10.18 }, dateEvenement: new Date(), photos: [] },
    { _id: '4', type: 'TROUVE', titre: 'Max latitude', categorieId: { _id: 'cat-1', nom: 'Objets' }, statut: 'ACTIVE', isDeleted: false, lieu: { latitude: 36.83, longitude: 10.18 }, dateEvenement: new Date(), photos: [] },
    { _id: '5', type: 'TROUVE', titre: 'Min longitude', categorieId: { _id: 'cat-1', nom: 'Objets' }, statut: 'ACTIVE', isDeleted: false, lieu: { latitude: 36.81, longitude: 10.17 }, dateEvenement: new Date(), photos: [] },
    { _id: '6', type: 'TROUVE', titre: 'Max longitude', categorieId: { _id: 'cat-1', nom: 'Objets' }, statut: 'ACTIVE', isDeleted: false, lieu: { latitude: 36.81, longitude: 10.20 }, dateEvenement: new Date(), photos: [] },
    { _id: '7', type: 'TROUVE', titre: 'Missing latitude', categorieId: 'cat-1', statut: 'ACTIVE', isDeleted: false, lieu: { longitude: 10.18 }, dateEvenement: new Date(), photos: [] },
    { _id: '8', type: 'TROUVE', titre: 'Missing longitude', categorieId: 'cat-1', statut: 'ACTIVE', isDeleted: false, lieu: { latitude: 36.81 }, dateEvenement: new Date(), photos: [] },
    { _id: '9', type: 'TROUVE', titre: 'Null coordinates', categorieId: 'cat-1', statut: 'ACTIVE', isDeleted: false, lieu: { latitude: null, longitude: null }, dateEvenement: new Date(), photos: [] },
    { _id: '10', type: 'TROUVE', titre: 'Invalid coordinates', categorieId: 'cat-1', statut: 'ACTIVE', isDeleted: false, lieu: { latitude: '36.81', longitude: '10.18' }, dateEvenement: new Date(), photos: [] },
    { _id: '11', type: 'TROUVE', titre: 'Inactive', categorieId: 'cat-1', statut: 'EN_ATTENTE', isDeleted: false, lieu: { latitude: 36.81, longitude: 10.18 }, dateEvenement: new Date(), photos: [] },
    { _id: '12', type: 'TROUVE', titre: 'Deleted', categorieId: 'cat-1', statut: 'ACTIVE', isDeleted: true, lieu: { latitude: 36.81, longitude: 10.18 }, dateEvenement: new Date(), photos: [] }
  ];
  let capturedFilter;
  let capturedLimit;

  Declaration.find = (filter) => {
    capturedFilter = filter;
    let limited = 100;
    const chain = {
      sort() { return this; },
      limit(value) { limited = value; capturedLimit = value; return this; },
      select() { return this; },
      populate() { return this; },
      lean: async () => records.filter((record) => matchesMapFilter(record, filter)).slice(0, limited)
    };
    return chain;
  };

  t.after(() => { Declaration.find = originalFind; });

  const result = await searchDeclarationsOnMap({
    minLat: 36.80,
    maxLat: 36.83,
    minLng: 10.17,
    maxLng: 10.20
  });

  assert.equal(capturedFilter.statut, 'ACTIVE');
  assert.equal(capturedFilter.isDeleted, false);
  assert.deepEqual(capturedFilter['lieu.latitude'], { $type: 'number', $gte: 36.80, $lte: 36.83 });
  assert.deepEqual(capturedFilter['lieu.longitude'], { $type: 'number', $gte: 10.17, $lte: 10.20 });
  assert.equal(capturedLimit, 100);
  assert.equal(result.length, 5);
  assert.equal(result.every((item) => item.lieu.latitude !== null && item.lieu.longitude !== null), true);
  assert.equal(JSON.stringify(result).includes('declarantId'), false);

  const empty = await searchDeclarationsOnMap({
    minLat: 35,
    maxLat: 35.1,
    minLng: 9,
    maxLng: 9.1
  });
  assert.deepEqual(empty, []);
});

// 4. Optional Filters and Limits
test('Map search combines type and category and respects limits', async (t) => {
  const originalFind = Declaration.find;
  let capturedFilter;
  let capturedLimit;
  const records = Array.from({ length: 150 }, (_, index) => ({
    _id: String(index),
    type: index % 2 === 0 ? 'PERDU' : 'TROUVE',
    titre: `Item ${index}`,
    categorieId: { _id: 'cat-a', nom: 'Objets' },
    statut: 'ACTIVE',
    isDeleted: false,
    lieu: { latitude: 36.81, longitude: 10.18 },
    dateEvenement: new Date(),
    photos: []
  }));

  Declaration.find = (filter) => {
    capturedFilter = filter;
    let limit = 100;
    const chain = {
      sort() { return this; },
      limit(value) { limit = value; capturedLimit = value; return this; },
      select() { return this; },
      populate() { return this; },
      lean: async () => records.filter((record) => matchesMapFilter(record, filter)).slice(0, limit)
    };
    return chain;
  };

  t.after(() => { Declaration.find = originalFind; });

  await searchDeclarationsOnMap({
    minLat: 36.80, maxLat: 36.83, minLng: 10.17, maxLng: 10.20, type: 'PERDU'
  });
  assert.equal(capturedFilter.type, 'PERDU');
  assert.equal(capturedLimit, 100);

  await searchDeclarationsOnMap({
    minLat: 36.80, maxLat: 36.83, minLng: 10.17, maxLng: 10.20, type: 'TROUVE'
  });
  assert.equal(capturedFilter.type, 'TROUVE');

  await searchDeclarationsOnMap({
    minLat: 36.80, maxLat: 36.83, minLng: 10.17, maxLng: 10.20, categorie: 'cat-a'
  });
  assert.equal(capturedFilter.categorieId, 'cat-a');

  await searchDeclarationsOnMap({
    minLat: 36.80, maxLat: 36.83, minLng: 10.17, maxLng: 10.20,
    type: 'PERDU', categorie: 'cat-a', limit: 1
  });
  assert.equal(capturedFilter.type, 'PERDU');
  assert.equal(capturedFilter.categorieId, 'cat-a');
  assert.equal(capturedLimit, 1);

  const capped = await searchDeclarationsOnMap({
    minLat: 36.80, maxLat: 36.83, minLng: 10.17, maxLng: 10.20,
    limit: 100
  });
  assert.equal(capped.length, 100);
});
