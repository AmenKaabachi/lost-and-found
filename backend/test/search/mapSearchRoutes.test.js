// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import searchRoutes from '../../src/routes/search/searchRoutes.js';
import Utilisateur from '../../src/models/Utilisateur.js';
import Declaration from '../../src/models/Declaration.js';
import { errorHandler } from '../../src/errors/core/errorHandler.js';
import { localeMiddleware } from '../../src/errors/localization/localeMiddleware.js';

// 2. Test Setup
const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

// 3. Route Validation Tests
test('Map route validates inputs and returns success', async (t) => {
  process.env.JWT_SECRET = 'map-search-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalFind = Declaration.find;

  Utilisateur.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE'
  });

  Declaration.find = () => ({
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    populate() { return this; },
    lean: async () => [{
      _id: '507f191e810c19729de860ea',
      type: 'PERDU',
      titre: 'Portefeuille vert perdu',
      categorieId: { _id: '507f1f77bcf86cd799439012', nom: 'Objets' },
      lieu: { nomLieu: 'Bibliotheque', zone: 'Bloc C', latitude: 36.82, longitude: 10.19 },
      dateEvenement: new Date('2026-11-10'),
      photos: []
    }]
  });

  const app = express();
  app.use(express.json());
  app.use(localeMiddleware);
  app.use('/api/search', searchRoutes);
  app.use(errorHandler);

  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Utilisateur.findById = originalFindById;
    Declaration.find = originalFind;
  });

  const base = '?minLat=36.80&maxLat=36.83&minLng=10.17&maxLng=10.20';

  for (const suffix of [
    '?maxLat=36.83&minLng=10.17&maxLng=10.20',
    '?minLat=36.80&minLng=10.17&maxLng=10.20',
    '?minLat=36.80&maxLat=36.83&maxLng=10.20',
    '?minLat=36.80&maxLat=36.83&minLng=10.17',
    '?minLat=abc&maxLat=36.83&minLng=10.17&maxLng=10.20',
    '?minLat=-91&maxLat=36.83&minLng=10.17&maxLng=10.20',
    '?minLat=36.80&maxLat=91&minLng=10.17&maxLng=10.20',
    '?minLat=36.80&maxLat=36.83&minLng=-181&maxLng=10.20',
    '?minLat=36.80&maxLat=36.83&minLng=181&maxLng=10.20',
    '?minLat=36.83&maxLat=36.83&minLng=10.17&maxLng=10.20',
    '?minLat=36.84&maxLat=36.83&minLng=10.17&maxLng=10.20',
    '?minLat=36.80&maxLat=36.83&minLng=10.20&maxLng=10.20',
    '?minLat=36.80&maxLat=36.83&minLng=10.21&maxLng=10.20',
    '?minLat=36.80&maxLat=36.83&minLng=10.17&maxLng=10.20&type=PERDUE',
    '?minLat=36.80&maxLat=36.83&minLng=10.17&maxLng=10.20&categorie=bad',
    '?minLat=36.80&maxLat=36.83&minLng=10.17&maxLng=10.20&limit=0',
    '?minLat=36.80&maxLat=36.83&minLng=10.17&maxLng=10.20&limit=101',
    '?minLat=NaN&maxLat=36.83&minLng=10.17&maxLng=10.20'
  ]) {
    const response = await fetch(`${baseUrl}/api/search/map${suffix}`, { headers });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  }

  for (const [language, expectedMessage] of [
    ['fr', 'Latitude invalide'],
    ['ar', 'خط العرض غير صالح'],
    ['xx', 'Invalid latitude']
  ]) {
    const response = await fetch(
      `${baseUrl}/api/search/map?minLat=abc&maxLat=36.83&minLng=10.17&maxLng=10.20`,
      { headers: { ...headers, 'X-Language': language } }
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.details.minLat[0], expectedMessage);
  }

  for (const suffix of [
    base,
    `${base}&type=PERDU`,
    `${base}&type=TROUVE`,
    `${base}&categorie=507f1f77bcf86cd799439012`,
    `${base}&type=PERDU&categorie=507f1f77bcf86cd799439012`,
    `${base}&limit=1`
  ]) {
    const response = await fetch(`${baseUrl}/api/search/map${suffix}`, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data[0].lieu.latitude, 36.82);
    assert.equal(body.data[0].lieu.longitude, 10.19);
    assert.equal(Object.prototype.hasOwnProperty.call(body.data[0], 'declarantId'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body.data[0], 'aiModerationReason'), false);
  }

  const noAuth = await fetch(`${baseUrl}/api/search/map${base}`);
  assert.equal(noAuth.status, 401);
});
