// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import searchRoutes from '../../src/routes/search/searchRoutes.js';
import Utilisateur from '../../src/models/Utilisateur.js';
import Declaration from '../../src/models/Declaration.js';
import Categorie from '../../src/models/Categorie.js';
import RechercheEnregistree from '../../src/models/RechercheEnregistree.js';
import { errorHandler } from '../../src/errors/core/errorHandler.js';
import { localeMiddleware } from '../../src/errors/localization/localeMiddleware.js';

// 2. Test Setup
process.env.NODE_ENV = 'test';
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


// 6. Search Filters Tests
test('Filters route requires authentication and validates query parameters', async (t) => {
  process.env.JWT_SECRET = 'search-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalAggregate = Declaration.aggregate;
  const originalCategorieFind = Categorie.find;

  Utilisateur.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE'
  });
  Declaration.aggregate = async () => [{ categories: [], couleurs: [], zones: [], lieux: [] }];
  Categorie.find = () => ({
    sort() { return this; },
    select() { return this; },
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
    Declaration.aggregate = originalAggregate;
    Categorie.find = originalCategorieFind;
  });

  const noAuth = await fetch(`${baseUrl}/api/search/filters`);
  assert.equal(noAuth.status, 401);

  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  for (const suffix of ['?type=XYZ', '?type=perdu', '?type=PERDU&type=TROUVE']) {
    const response = await fetch(`${baseUrl}/api/search/filters${suffix}`, { headers });
    assert.equal(response.status, 400, suffix);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  }

  for (const suffix of ['', '?type=PERDU', '?type=TROUVE']) {
    const response = await fetch(`${baseUrl}/api/search/filters${suffix}`, { headers });
    assert.equal(response.status, 200, suffix);
  }
});

test('Filters return categories and deduplicated values with counts', async (t) => {
  process.env.JWT_SECRET = 'search-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalAggregate = Declaration.aggregate;
  const originalCategorieFind = Categorie.find;
  let pipeline;
  let facets = {
    categories: [{ _id: 'c1', total: 4 }],
    couleurs: [
      { _id: 'vert', valeur: 'Vert', total: 2 },
      { _id: 'rouge', valeur: 'Rouge', total: 1 }
    ],
    zones: [{ _id: 'bloc c', valeur: 'Bloc C', total: 3 }],
    lieux: [
      { _id: 'bibliotheque', valeur: 'Bibliotheque', total: 1 },
      { _id: 'bibliothèque', valeur: 'Bibliothèque', total: 1 },
      { _id: 'salle b12', valeur: 'Salle B12', total: 1 }
    ]
  };

  Utilisateur.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE'
  });
  Declaration.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [facets];
  };
  Categorie.find = () => ({
    sort() { return this; },
    select() { return this; },
    lean: async () => [
      { _id: 'c1', nom: 'Autres' },
      { _id: 'c2', nom: 'Clés' }
    ]
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
    Declaration.aggregate = originalAggregate;
    Categorie.find = originalCategorieFind;
  });

  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  const response = await fetch(`${baseUrl}/api/search/filters`, { headers });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.data.categories, [
    { _id: 'c1', nom: 'Autres', total: 4 },
    { _id: 'c2', nom: 'Clés', total: 0 }
  ]);
  assert.deepEqual(body.data.couleurs, [
    { valeur: 'Vert', total: 2 },
    { valeur: 'Rouge', total: 1 }
  ]);
  assert.deepEqual(body.data.zones, [{ valeur: 'Bloc C', total: 3 }]);
  assert.deepEqual(body.data.lieux, [
    { valeur: 'Bibliotheque', total: 2 },
    { valeur: 'Salle B12', total: 1 }
  ]);

  assert.equal(pipeline[0].$match.statut, 'ACTIVE');
  assert.equal(pipeline[0].$match.isDeleted, false);
  assert.equal(pipeline[0].$match.archivedAt, null);
  assert.equal(pipeline[0].$match.type, undefined);

  await fetch(`${baseUrl}/api/search/filters?type=TROUVE`, { headers });
  assert.equal(pipeline[0].$match.type, 'TROUVE');

  facets = { categories: [], couleurs: [], zones: [], lieux: [] };
  const empty = await fetch(`${baseUrl}/api/search/filters`, { headers });
  assert.equal(empty.status, 200);
  const emptyBody = await empty.json();
  assert.deepEqual(emptyBody.data.couleurs, []);
  assert.deepEqual(emptyBody.data.zones, []);
  assert.deepEqual(emptyBody.data.lieux, []);
  assert.equal(emptyBody.data.categories.length, 2);
});


// 7. Saved Searches Tests
const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';

const startSavedSearchApp = async ({ notificationsEmail = true } = {}) => {
  process.env.JWT_SECRET = 'search-test-secret';

  const originals = {
    findById: Utilisateur.findById,
    create: RechercheEnregistree.create,
    find: RechercheEnregistree.find,
    findOneAndDelete: RechercheEnregistree.findOneAndDelete
  };

  Utilisateur.findById = async () => ({
    _id: OWNER_ID,
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE',
    notificationsEmail
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
  const token = jwt.sign({ id: OWNER_ID }, process.env.JWT_SECRET);

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      Utilisateur.findById = originals.findById;
      RechercheEnregistree.create = originals.create;
      RechercheEnregistree.find = originals.find;
      RechercheEnregistree.findOneAndDelete = originals.findOneAndDelete;
    }
  };
};

test('Saved search routes require authentication and validate input', async (t) => {
  const { baseUrl, headers, close } = await startSavedSearchApp();
  t.after(close);

  RechercheEnregistree.create = async () => {
    throw new Error('create must not be called for invalid input');
  };
  RechercheEnregistree.findOneAndDelete = async () => {
    throw new Error('delete must not be called for an invalid id');
  };

  assert.equal((await fetch(`${baseUrl}/api/search/saved`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/search/saved`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/search/saved/${OWNER_ID}`, { method: 'DELETE' })).status, 401);

  const invalidBodies = [
    {},
    { nom: 'Mes clés' },
    { filtres: { q: 'clés' } },
    { nom: 'ab', filtres: { q: 'clés' } },
    { nom: 'a'.repeat(51), filtres: { q: 'clés' } },
    { nom: 'Mes clés', filtres: [] },
    { nom: 'Mes clés', filtres: 'clés' },
    { nom: 'Mes clés', filtres: { type: 'XYZ' } },
    { nom: 'Mes clés', filtres: { categorie: 'abc' } },
    { nom: 'Mes clés', filtres: { lat: 'abc', lng: 10 } },
    { nom: 'Mes clés', filtres: { radius: 100 } },
    { nom: 'Mes clés', filtres: { radius: 5000, lat: 36.8, lng: 10.1 } },
    { nom: 'Mes clés', filtres: { sort: 'distance' } },
    { nom: 'Mes clés', filtres: { dateDebut: '2026-12-01', dateFin: '2026-11-01' } },
    { nom: 'Mes clés', filtres: { q: 'clés' }, alerteEmail: 'yes' }
  ];

  for (const payload of invalidBodies) {
    const response = await fetch(`${baseUrl}/api/search/saved`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    assert.equal(response.status, 400, JSON.stringify(payload));
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  }

  for (const id of ['123', 'zzzzzzzzzzzzzzzzzzzzzzzz', 'abcdefghijkl']) {
    const response = await fetch(`${baseUrl}/api/search/saved/${id}`, { method: 'DELETE', headers });
    assert.equal(response.status, 400, id);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  }
});

test('Saved search creation uses the authenticated owner and clean filters', async (t) => {
  const { baseUrl, headers, close } = await startSavedSearchApp();
  t.after(close);
  let created;

  RechercheEnregistree.create = async (payload) => {
    created = payload;
    return {
      toObject: () => ({
        _id: 'saved-1',
        ...payload,
        createdAt: '2026-11-22T10:00:00.000Z',
        updatedAt: '2026-11-22T10:00:00.000Z',
        __v: 0
      })
    };
  };

  const response = await fetch(`${baseUrl}/api/search/saved`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      utilisateurId: OTHER_ID,
      nom: '  Mes clés  ',
      filtres: { q: 'clés', type: 'PERDU', lat: 36.8, lng: 10.18, radius: 500, page: 3, limit: 50 },
      alerteEmail: false
    })
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.message, 'Saved search created');
  assert.equal(body.data._id, 'saved-1');
  assert.equal(body.data.nom, 'Mes clés');
  assert.equal(body.data.__v, undefined);
  assert.equal(body.data.utilisateurId, undefined);

  assert.equal(created.utilisateurId, OWNER_ID);
  assert.equal(created.nom, 'Mes clés');
  assert.equal(created.alerteEmail, false);
  assert.equal(created.filtres.q, 'clés');
  assert.equal(created.filtres.type, 'PERDU');
  assert.equal(created.filtres.lat, 36.8);
  assert.equal(created.filtres.lng, 10.18);
  assert.equal(created.filtres.radius, 500);
  assert.equal(created.filtres.page, undefined);
  assert.equal(created.filtres.limit, undefined);

  const defaultAlert = await fetch(`${baseUrl}/api/search/saved`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ nom: 'Sans alerte', filtres: { couleur: 'vert' } })
  });
  assert.equal(defaultAlert.status, 201);
  assert.equal(created.alerteEmail, false);
});

test('Saved search alert requires email notifications to be enabled', async (t) => {
  const disabled = await startSavedSearchApp({ notificationsEmail: false });
  t.after(disabled.close);
  let createdCount = 0;

  RechercheEnregistree.create = async (payload) => {
    createdCount += 1;
    return { toObject: () => ({ _id: `saved-${createdCount}`, ...payload }) };
  };

  const rejected = await fetch(`${disabled.baseUrl}/api/search/saved`, {
    method: 'POST',
    headers: disabled.headers,
    body: JSON.stringify({ nom: 'Avec alerte', filtres: { q: 'clés' }, alerteEmail: true })
  });
  assert.equal(rejected.status, 400);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.error.code, 'VALIDATION_ERROR');
  assert.deepEqual(rejectedBody.error.details.alerteEmail, ['Email notifications are disabled in your profile']);
  assert.equal(createdCount, 0);

  const withoutAlert = await fetch(`${disabled.baseUrl}/api/search/saved`, {
    method: 'POST',
    headers: disabled.headers,
    body: JSON.stringify({ nom: 'Sans alerte', filtres: { q: 'clés' } })
  });
  assert.equal(withoutAlert.status, 201);
  assert.equal(createdCount, 1);
});

test('Saved search list and delete are limited to the authenticated owner', async (t) => {
  const { baseUrl, headers, close } = await startSavedSearchApp();
  t.after(close);
  let findFilter;
  let deleteFilter;
  let stored = [
    { _id: 's2', nom: 'Deuxième', filtres: { q: 'sac' }, alerteEmail: true, createdAt: '2026-11-21', updatedAt: '2026-11-21', utilisateurId: OWNER_ID, __v: 0 },
    { _id: 's1', nom: 'Première', filtres: { q: 'clés' }, alerteEmail: false, createdAt: '2026-11-20', updatedAt: '2026-11-20', utilisateurId: OWNER_ID, __v: 0 }
  ];

  RechercheEnregistree.find = (filter) => {
    findFilter = filter;
    return { sort() { return this; }, lean: async () => stored };
  };
  RechercheEnregistree.findOneAndDelete = async (filter) => {
    deleteFilter = filter;
    return filter._id === 'aaaaaaaaaaaaaaaaaaaaaaaa' && filter.utilisateurId === OWNER_ID
      ? { _id: filter._id }
      : null;
  };

  const list = await fetch(`${baseUrl}/api/search/saved`, { headers });
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.equal(listBody.message, 'Saved searches retrieved');
  assert.deepEqual(listBody.data.map((item) => item._id), ['s2', 's1']);
  assert.equal(listBody.data[0].utilisateurId, undefined);
  assert.equal(listBody.data[0].__v, undefined);
  assert.deepEqual(findFilter, { utilisateurId: OWNER_ID });

  stored = [];
  const empty = await fetch(`${baseUrl}/api/search/saved`, { headers });
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).data, []);

  const removed = await fetch(`${baseUrl}/api/search/saved/aaaaaaaaaaaaaaaaaaaaaaaa`, { method: 'DELETE', headers });
  assert.equal(removed.status, 200);
  const removedBody = await removed.json();
  assert.equal(removedBody.message, 'Saved search deleted');
  assert.deepEqual(removedBody.data, { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' });
  assert.deepEqual(deleteFilter, { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', utilisateurId: OWNER_ID });

  const missing = await fetch(`${baseUrl}/api/search/saved/bbbbbbbbbbbbbbbbbbbbbbbb`, { method: 'DELETE', headers });
  assert.equal(missing.status, 404);
  const missingBody = await missing.json();
  assert.equal(missingBody.error.code, 'RESOURCE_NOT_FOUND');
  assert.equal(missingBody.error.message, 'Saved search not found');
  assert.deepEqual(deleteFilter, { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', utilisateurId: OWNER_ID });
});


// 8. Rate Limiter Tests
const startRateLimitApp = async () => {
  process.env.JWT_SECRET = 'search-test-secret';
  process.env.NODE_ENV = 'development';

  const originals = {
    findById: Utilisateur.findById,
    find: Declaration.find,
    aggregate: Declaration.aggregate,
    findCategories: Categorie.find,
    findSaved: RechercheEnregistree.find,
    create: RechercheEnregistree.create
  };

  Utilisateur.findById = async (id) => ({
    _id: String(id),
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE',
    notificationsEmail: true
  });
  const chain = (result) => ({
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    populate() { return this; },
    lean: async () => result
  });
  Declaration.find = () => chain([]);
  Declaration.aggregate = async () => [{ categories: [], couleurs: [], zones: [], lieux: [] }];
  Categorie.find = () => chain([]);
  RechercheEnregistree.find = () => chain([]);
  RechercheEnregistree.create = async (payload) => ({ toObject: () => ({ _id: 'saved-1', ...payload }) });

  const app = express();
  app.use(express.json());
  app.use(localeMiddleware);
  app.use('/api/search', searchRoutes);
  app.use(errorHandler);

  const server = await listen(app);

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    headersFor: (userId, extra = {}) => ({
      Authorization: `Bearer ${jwt.sign({ id: userId }, process.env.JWT_SECRET)}`,
      'Content-Type': 'application/json',
      ...extra
    }),
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      process.env.NODE_ENV = 'test';
      Utilisateur.findById = originals.findById;
      Declaration.find = originals.find;
      Declaration.aggregate = originals.aggregate;
      Categorie.find = originals.findCategories;
      RechercheEnregistree.find = originals.findSaved;
      RechercheEnregistree.create = originals.create;
    }
  };
};

test('Suggestions limiter returns a standard 429 above the limit and keeps headers', async (t) => {
  const { baseUrl, headersFor, close } = await startRateLimitApp();
  t.after(close);
  const headers = headersFor('607f1f77bcf86cd799439001');

  const first = await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('ratelimit-limit'), '30');
  assert.equal(first.headers.get('ratelimit-remaining'), '29');
  assert.ok(first.headers.get('ratelimit-reset'));
  assert.equal(first.headers.get('x-ratelimit-limit'), null);

  for (let index = 2; index <= 30; index += 1) {
    const response = await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers });
    assert.equal(response.status, 200, `request ${index}`);
  }

  const limited = await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
  assert.equal(limited.headers.get('ratelimit-remaining'), '0');
  const body = await limited.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'TOO_MANY_REQUESTS');
  assert.equal(body.error.message, 'Too many requests, try again later');
  assert.equal(body.error.details, null);
});

test('Limiters are separate per endpoint and per user', async (t) => {
  const { baseUrl, headersFor, close } = await startRateLimitApp();
  t.after(close);
  const userA = headersFor('607f1f77bcf86cd799439002');
  const userB = headersFor('607f1f77bcf86cd799439003');

  for (let index = 1; index <= 30; index += 1) {
    await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers: userA });
  }
  assert.equal((await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers: userA })).status, 429);

  assert.equal((await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers: userB })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/search/recent`, { headers: userA })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/search/filters`, { headers: userA })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/search/saved`, { headers: userA })).status, 200);
});

test('Saved search writes are limited to 10 per minute and reads stay available', async (t) => {
  const { baseUrl, headersFor, close } = await startRateLimitApp();
  t.after(close);
  const headers = headersFor('607f1f77bcf86cd799439004');
  const payload = JSON.stringify({ nom: 'Mes clés', filtres: { q: 'clés' } });

  for (let index = 1; index <= 10; index += 1) {
    const response = await fetch(`${baseUrl}/api/search/saved`, { method: 'POST', headers, body: payload });
    assert.equal(response.status, 201, `write ${index}`);
  }

  const limited = await fetch(`${baseUrl}/api/search/saved`, { method: 'POST', headers, body: payload });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, 'TOO_MANY_REQUESTS');

  const deleteLimited = await fetch(`${baseUrl}/api/search/saved/aaaaaaaaaaaaaaaaaaaaaaaa`, { method: 'DELETE', headers });
  assert.equal(deleteLimited.status, 429);

  assert.equal((await fetch(`${baseUrl}/api/search/saved`, { headers })).status, 200);
});

test('Limiter message follows the request language', async (t) => {
  const { baseUrl, headersFor, close } = await startRateLimitApp();
  t.after(close);

  const expected = {
    fr: 'Trop de requêtes, réessayez plus tard',
    ar: 'طلبات كثيرة جداً، حاول لاحقاً',
    es: 'Too many requests, try again later'
  };

  let index = 0;
  for (const [language, message] of Object.entries(expected)) {
    index += 1;
    const headers = headersFor(`607f1f77bcf86cd79943900${index + 4}`, { 'X-Language': language });
    for (let call = 1; call <= 30; call += 1) {
      await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers });
    }
    const limited = await fetch(`${baseUrl}/api/search/suggestions?q=wal`, { headers });
    assert.equal(limited.status, 429, language);
    assert.equal((await limited.json()).error.message, message, language);
  }
});