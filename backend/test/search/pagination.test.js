// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import searchRoutes from '../../src/routes/search/searchRoutes.js';
import Utilisateur from '../../src/models/Utilisateur.js';
import Declaration from '../../src/models/Declaration.js';
import { errorHandler } from '../../src/errors/core/errorHandler.js';

// 2. Test Setup
const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const declarations = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  return {
    _id: `${(index + 1).toString(16).padStart(24, '0')}`,
    type: index % 2 === 0 ? 'PERDU' : 'TROUVE',
    titre: index % 3 === 0 ? `Sac rouge ${number}` : `Objet ${number}`,
    description: index % 3 === 0 ? 'Sac de campus' : 'Objet trouve',
    categorieId: index % 2 === 0
      ? { _id: '6afccf3d3a2a8ff5920f30a3', nom: 'Sacs' }
      : { _id: '507f1f77bcf86cd799439011', nom: 'Electronique' },
    detailsObjet: {
      marque: index % 2 === 0 ? 'Samsung' : 'Apple',
      couleur: index % 3 === 0 ? 'rouge' : 'bleu',
      modele: null,
      signesDistinctifs: null
    },
    lieu: {
      nomLieu: index % 2 === 0 ? 'B12' : 'Bloc C',
      zone: index % 2 === 0 ? 'Bloc A' : 'Bloc B',
      latitude: index === 11 ? null : 36.8 + (index * 0.001),
      longitude: index === 11 ? null : 10.17 + (index * 0.001)
    },
    dateEvenement: new Date(`2026-11-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`),
    photos: [],
    statut: 'ACTIVE',
    statutGarde: 'UNKNOWN',
    contactVisible: true,
    isDeleted: false,
    archivedAt: null,
    createdAt: new Date(`2026-11-01T10:${String(index).padStart(2, '0')}:00.000Z`)
  };
});

// 3. Mock Filter Helpers
const normalize = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const matchesFilter = (filter, declaration) => {
  if (filter.type && declaration.type !== filter.type) return false;
  if (filter.categorieId) {
    const id = typeof declaration.categorieId === 'object'
      ? declaration.categorieId._id
      : declaration.categorieId;
    if (String(id) !== String(filter.categorieId)) return false;
  }
  if (filter['detailsObjet.couleur']) {
    if (!normalize(declaration.detailsObjet.couleur).includes(normalize(filter['detailsObjet.couleur'].source))) return false;
  }
  if (filter['detailsObjet.marque']) {
    if (!normalize(declaration.detailsObjet.marque).includes(normalize(filter['detailsObjet.marque'].source))) return false;
  }
  if (filter['lieu.zone']) {
    if (!normalize(declaration.lieu.zone).includes(normalize(filter['lieu.zone'].source))) return false;
  }
  if (filter.$or) {
    const haystacks = [
      declaration.lieu.nomLieu,
      declaration.lieu.zone
    ].map(normalize);
    const needle = normalize(filter.$or[0]['lieu.nomLieu'].source);
    if (!haystacks.some((value) => value.includes(needle))) return false;
  }
  if (filter.dateEvenement) {
    if (filter.dateEvenement.$gte && declaration.dateEvenement < filter.dateEvenement.$gte) return false;
    if (filter.dateEvenement.$lte && declaration.dateEvenement > filter.dateEvenement.$lte) return false;
  }
  if (filter.$and) {
    for (const condition of filter.$and) {
      const needle = normalize(condition.$or[0][Object.keys(condition.$or[0])[0]].source);
      const haystacks = [
        declaration.titre,
        declaration.description,
        declaration.detailsObjet.marque,
        declaration.detailsObjet.modele,
        declaration.detailsObjet.couleur,
        declaration.detailsObjet.signesDistinctifs,
        declaration.lieu.nomLieu,
        declaration.lieu.zone
      ].map(normalize);
      if (!haystacks.some((value) => value.includes(needle))) return false;
    }
  }
  return declaration.statut === 'ACTIVE' && declaration.isDeleted === false && declaration.archivedAt === null;
};

// 4. Pagination and Validation Tests
test('Advanced search pagination is deterministic and validated', async (t) => {
  process.env.JWT_SECRET = 'pagination-test-secret';

  const originalFindById = Utilisateur.findById;
  const originalFind = Declaration.find;
  const originalCountDocuments = Declaration.countDocuments;

  let latestFindFilter;
  let latestCountFilter;
  let findFilterCount = 0;

  Utilisateur.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    statut: 'ACTIF',
    emailVerifie: true,
    role: 'MEMBRE'
  });

  Declaration.countDocuments = async (filter) => {
    latestCountFilter = filter;
    return declarations.filter((item) => matchesFilter(filter, item)).length;
  };

  Declaration.find = (filter) => {
    latestFindFilter = filter;
    findFilterCount++;
    let skipCount = 0;
    let limitCount = null;
    let sortOptions = null;
    const chain = {
      sort(value) { sortOptions = value; return this; },
      skip(value) { skipCount = value; return this; },
      limit(value) { limitCount = value; return this; },
      select() { return this; },
      populate() { return this; },
      lean: async () => {
        const matched = declarations
          .filter((item) => matchesFilter(filter, item));
        if (sortOptions?.dateEvenement) {
          matched.sort((a, b) => b.dateEvenement - a.dateEvenement || String(b._id).localeCompare(String(a._id)));
        } else {
          matched.sort((a, b) => b.createdAt - a.createdAt || String(b._id).localeCompare(String(a._id)));
        }
        return matched.slice(skipCount, limitCount === null ? undefined : skipCount + limitCount);
      }
    };
    return chain;
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
  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Utilisateur.findById = originalFindById;
    Declaration.find = originalFind;
    Declaration.countDocuments = originalCountDocuments;
  });

  const get = async (suffix) => {
    const response = await fetch(`${baseUrl}/api/search/declarations${suffix}`, { headers });
    return { response, body: await response.json() };
  };

  const defaultResult = await get('');
  assert.equal(defaultResult.response.status, 200);
  assert.equal(defaultResult.body.pagination.currentPage, 1);
  assert.equal(defaultResult.body.pagination.limit, 10);
  assert.equal(defaultResult.body.data.length, 10);

  const explicit = await get('?page=1&limit=10');
  assert.equal(explicit.response.status, 200);
  assert.equal(explicit.body.pagination.currentPage, 1);
  assert.equal(explicit.body.pagination.limit, 10);

  const page2 = await get('?page=2&limit=5');
  const page1 = await get('?page=1&limit=5');
  assert.equal(page2.response.status, 200);
  assert.equal(page2.body.data.length, 5);
  assert.equal(page2.body.pagination.hasPreviousPage, true);
  assert.equal(page2.body.pagination.hasNextPage, true);
  const page1Ids = new Set(page1.body.data.map((item) => item._id));
  assert.equal(page2.body.data.some((item) => page1Ids.has(item._id)), false);

  const page3 = await get('?page=3&limit=5');
  assert.equal(page3.body.data.length, 2);
  assert.equal(page3.body.pagination.hasNextPage, false);
  assert.equal(page3.body.pagination.totalPages, 3);

  const limit5 = await get('?limit=5');
  assert.equal(limit5.body.data.length, 5);
  assert.equal(limit5.body.pagination.limit, 5);

  const limit50 = await get('?limit=50');
  assert.equal(limit50.response.status, 200);
  assert.equal(limit50.body.data.length, 12);
  assert.equal(limit50.body.pagination.totalPages, 1);

  for (const suffix of [
    '?limit=51',
    '?page=0',
    '?page=-1',
    '?limit=-1',
    '?page=1.5',
    '?limit=2.5',
    '?page=abc',
    '?limit=abc'
  ]) {
    const invalid = await get(suffix);
    assert.equal(invalid.response.status, 400, suffix);
    assert.equal(invalid.body.success, false);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
  }

  const empty = await get('?q=missing-document&page=2&limit=10');
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.body.data, []);
  assert.deepEqual(empty.body.pagination, {
    currentPage: 2,
    limit: 10,
    totalResults: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });

  const beyond = await get('?page=99&limit=10');
  assert.equal(beyond.body.data.length, 0);
  assert.equal(beyond.body.pagination.totalResults, 12);
  assert.equal(beyond.body.pagination.totalPages, 2);
  assert.equal(beyond.body.pagination.hasNextPage, false);
  assert.equal(beyond.body.pagination.hasPreviousPage, true);

  const filters = [
    '?q=sac&page=1&limit=5',
    '?sort=date&page=2&limit=5',
    '?q=sac&sort=pertinence&page=1&limit=5',
    '?sort=distance&lat=36.8065&lng=10.1815&page=1&limit=5',
    '?type=TROUVE&page=1&limit=5',
    '?categorie=6afccf3d3a2a8ff5920f30a3&page=1&limit=5',
    '?couleur=rouge&page=1&limit=5',
    '?marque=Samsung&page=1&limit=5',
    '?lieu=B12&page=1&limit=5',
    '?zoneCampus=Bloc%20A&page=1&limit=5',
    '?dateDebut=2026-11-01&page=1&limit=5',
    '?dateFin=2026-10-31&page=1&limit=5',
    '?lieu=B12&type=TROUVE&page=1&limit=5',
    '?couleur=rouge&page=2&limit=10'
  ];

  for (const suffix of filters) {
    const result = await get(suffix);
    assert.equal(result.response.status, 200, suffix);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.length <= result.body.pagination.limit, true);
  }

  assert.equal(latestFindFilter, latestCountFilter);
  assert.equal(findFilterCount > 0, true);
  assert.equal(explicit.body.pagination.totalResults, 12);
  assert.equal(explicit.body.pagination.totalPages, 2);
});
