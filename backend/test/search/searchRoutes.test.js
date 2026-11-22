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


// 5. Recent Declarations Tests
test('Recent route requires authentication and validates query parameters', async (t) => {
  process.env.JWT_SECRET = 'search-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalDeclarationFind = Declaration.find;

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
    lean: async () => []
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
  });

  const noAuth = await fetch(`${baseUrl}/api/search/recent`);
  assert.equal(noAuth.status, 401);

  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  for (const suffix of [
    '?limit=0',
    '?limit=21',
    '?limit=abc',
    '?limit=-1',
    '?type=XYZ',
    '?type=PERDU&type=TROUVE'
  ]) {
    const response = await fetch(`${baseUrl}/api/search/recent${suffix}`, { headers });
    assert.equal(response.status, 400, suffix);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  }

  for (const suffix of ['', '?type=PERDU', '?type=TROUVE&limit=20', '?limit=1']) {
    const response = await fetch(`${baseUrl}/api/search/recent${suffix}`, { headers });
    assert.equal(response.status, 200, suffix);
  }
});

test('Recent returns the latest eligible declarations without private data', async (t) => {
  process.env.JWT_SECRET = 'search-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalDeclarationFind = Declaration.find;
  let declarationFilter;
  let sortArgument;
  let limitArgument;
  let selectArgument;
  let declarations = [
    {
      _id: 'd1',
      type: 'PERDU',
      titre: 'Green wallet',
      declarantId: 'secret-user',
      detailsObjet: { couleur: 'vert', numeroSerie: 'SN-1' },
      lieu: { nomLieu: 'Library', zone: 'A', latitude: 36.8, longitude: 10.1 },
      createdAt: '2026-11-21T10:00:00.000Z'
    },
    {
      _id: 'd2',
      type: 'TROUVE',
      titre: 'Red bag',
      createdAt: '2026-11-20T10:00:00.000Z'
    }
  ];

  Utilisateur.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE'
  });
  Declaration.find = (filter) => {
    declarationFilter = filter;
    return {
      sort(argument) { sortArgument = argument; return this; },
      limit(argument) { limitArgument = argument; return this; },
      select(argument) { selectArgument = argument; return this; },
      populate() { return this; },
      lean: async () => declarations
    };
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
  });

  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  const response = await fetch(`${baseUrl}/api/search/recent`, { headers });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.message, 'Declarations found');
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].titre, 'Green wallet');
  assert.equal(body.data[0].declarantId, undefined);
  assert.equal(body.data[0].detailsObjet.numeroSerie, undefined);
  assert.equal(body.data[0].lieu.latitude, undefined);

  assert.equal(declarationFilter.statut, 'ACTIVE');
  assert.equal(declarationFilter.isDeleted, false);
  assert.equal(declarationFilter.archivedAt, null);
  assert.equal(declarationFilter.type, undefined);
  assert.deepEqual(sortArgument, { createdAt: -1, _id: -1 });
  assert.equal(limitArgument, 10);
  assert.equal(selectArgument.declarantId, 0);

  await fetch(`${baseUrl}/api/search/recent?type=TROUVE&limit=5`, { headers });
  assert.equal(declarationFilter.type, 'TROUVE');
  assert.equal(limitArgument, 5);

  declarations = [];
  const empty = await fetch(`${baseUrl}/api/search/recent`, { headers });
  assert.equal(empty.status, 200);
  const emptyBody = await empty.json();
  assert.deepEqual(emptyBody.data, []);
  assert.equal(emptyBody.message, 'No declarations match your search');
});