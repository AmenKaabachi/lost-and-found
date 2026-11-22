// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import searchRoutes from '../../src/routes/search/searchRoutes.js';
import Utilisateur from '../../src/models/Utilisateur.js';
import Declaration from '../../src/models/Declaration.js';
import Categorie from '../../src/models/Categorie.js';
import { errorHandler } from '../../src/errors/core/errorHandler.js';

// 2. Test Setup
const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

// 3. Authentication and Validation Tests
test('Search route authentication, validation and controller flow', async (t) => {
  process.env.JWT_SECRET = 'search-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalFind = Declaration.find;
  const originalCountDocuments = Declaration.countDocuments;

  Utilisateur.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE'
  });

  Declaration.find = (query) => ({
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    select() { return this; },
    populate() { return this; },
    lean: async () => [{
      _id: '507f191e810c19729de860ea',
      type: 'PERDU',
      titre: 'iPhone',
      description: 'Phone',
      statut: 'ACTIVE',
      isDeleted: false,
      archivedAt: null,
      detailsObjet: {},
      lieu: {},
      photos: []
    }]
  });
  Declaration.countDocuments = async () => 1;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.locale = 'en';
    next();
  });
  app.use('/api/search', searchRoutes);
  app.use(errorHandler);

  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Utilisateur.findById = originalFindById;
    Declaration.find = originalFind;
    Declaration.countDocuments = originalCountDocuments;
  });

  const noAuth = await fetch(`${baseUrl}/api/search/declarations?q=iphone`);
  assert.equal(noAuth.status, 401);
  assert.equal((await noAuth.json()).success, false);

  const badAuth = await fetch(`${baseUrl}/api/search/declarations?q=iphone`, {
    headers: { Authorization: 'Bearer invalid-token' }
  });
  assert.equal(badAuth.status, 401);

  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  for (const [suffix, status] of [
    ['?q=', 400],
    ['?q=%20%20%20', 400],
    [`?q=${'a'.repeat(101)}`, 400],
    ['?q=a&q=b', 400],
    ['?sort=distance', 400],
    ['?sort=distance&lat=abc&lng=10', 400],
    ['?sort=distance&lat=91&lng=10', 400],
    ['?sort=distance&lat=36&lng=181', 400],
    ['?sort=unsupported', 400],
    ['?lat=36.8065&lng=10.1815&radius=0', 400],
    ['?lat=36.8065&lng=10.1815&radius=-1', 400],
    ['?lat=36.8065&lng=10.1815&radius=2001', 400],
    ['?radius=500', 400],
    ['?lat=36.8065&radius=500', 400],
    ['?lng=10.1815&radius=500', 400]
  ]) {
    const response = await fetch(`${baseUrl}/api/search/declarations${suffix}`, { headers });
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  }

  for (const suffix of ['', '?q=iphone', '?q=']) {
    const response = await fetch(`${baseUrl}/api/search/declarations${suffix}`, { headers });
    if (suffix === '?q=') {
      assert.equal(response.status, 400);
    } else {
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.message, 'Declarations found');
    }
  }

  Declaration.find = () => ({
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    select() { return this; },
    populate() { return this; },
    lean: async () => []
  });
  Declaration.countDocuments = async () => 0;

  const noMatches = await fetch(`${baseUrl}/api/search/declarations?q=missing`, { headers });
  assert.equal(noMatches.status, 200);
  const noMatchesBody = await noMatches.json();
  assert.equal(noMatchesBody.success, true);
  assert.deepEqual(noMatchesBody.data, []);
  assert.equal(noMatchesBody.message, 'No declarations match your search');
});


// 4. Suggestions Tests
test('Suggestions route requires authentication and validates query parameters', async (t) => {
  process.env.JWT_SECRET = 'search-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalDeclarationFind = Declaration.find;
  const originalCategorieFind = Categorie.find;

  Utilisateur.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE'
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.locale = 'en';
    next();
  });
  app.use('/api/search', searchRoutes);
  app.use(errorHandler);

  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Utilisateur.findById = originalFindById;
    Declaration.find = originalDeclarationFind;
    Categorie.find = originalCategorieFind;
  });

  const noAuth = await fetch(`${baseUrl}/api/search/suggestions?q=wal`);
  assert.equal(noAuth.status, 401);

  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  for (const suffix of [
    '',
    '?q=',
    '?q=a',
    '?q=%20a%20',
    `?q=${'a'.repeat(101)}`,
    '?q=ab&q=cd',
    '?q=ab&limit=0',
    '?q=ab&limit=11',
    '?q=ab&limit=abc',
    '?q=ab&limit=-1'
  ]) {
    const response = await fetch(`${baseUrl}/api/search/suggestions${suffix}`, { headers });
    assert.equal(response.status, 400, suffix);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  }
});

test('Suggestions return distinct eligible suggestions within the limit', async (t) => {
  process.env.JWT_SECRET = 'search-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalDeclarationFind = Declaration.find;
  const originalCategorieFind = Categorie.find;
  let declarationFilter;

  const chain = (result) => ({
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    lean: async () => result
  });
  let categories = [{ _id: 'c1', nom: 'Wallet' }];
  let declarations = [
    { _id: 'd1', titre: 'Green wallet' },
    { _id: 'd2', titre: 'Wallet black' },
    { _id: 'd3', titre: 'wallet black' }
  ];

  Utilisateur.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE'
  });
  Categorie.find = () => chain(categories);
  Declaration.find = (filter) => {
    declarationFilter = filter;
    return chain(declarations);
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.locale = 'en';
    next();
  });
  app.use('/api/search', searchRoutes);
  app.use(errorHandler);

  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Utilisateur.findById = originalFindById;
    Declaration.find = originalDeclarationFind;
    Categorie.find = originalCategorieFind;
  });

  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  const response = await fetch(`${baseUrl}/api/search/suggestions?q=wal&limit=5`, { headers });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.data, [
    { type: 'categorie', valeur: 'Wallet' },
    { type: 'titre', valeur: 'Wallet black' },
    { type: 'titre', valeur: 'Green wallet' }
  ]);

  assert.equal(declarationFilter.statut, 'ACTIVE');
  assert.equal(declarationFilter.isDeleted, false);
  assert.equal(declarationFilter.archivedAt, null);

  await fetch(`${baseUrl}/api/search/suggestions?q=etui`, { headers });
  assert.ok(declarationFilter.titre.test('Étui rouge'));

  const limited = await fetch(`${baseUrl}/api/search/suggestions?q=wal&limit=2`, { headers });
  assert.equal((await limited.json()).data.length, 2);

  categories = [];
  declarations = Array.from({ length: 12 }, (_, index) => ({ _id: `d${index}`, titre: `Wallet ${index}` }));
  const defaultLimit = await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers });
  assert.equal((await defaultLimit.json()).data.length, 10);

  declarations = [];
  const empty = await fetch(`${baseUrl}/api/search/suggestions?q=nothing`, { headers });
  assert.equal(empty.status, 200);
  const emptyBody = await empty.json();
  assert.equal(emptyBody.success, true);
  assert.deepEqual(emptyBody.data, []);
});