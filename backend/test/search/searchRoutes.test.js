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
    ['?q=a&q=b', 400]
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
