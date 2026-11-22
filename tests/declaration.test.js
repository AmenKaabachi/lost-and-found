import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Declaration from '../backend/src/models/Declaration.js';
import Categorie from '../backend/src/models/Categorie.js';
import JournalAudit from '../backend/src/models/JournalAudit.js';
import Utilisateur from '../backend/src/models/Utilisateur.js';
import declarationRoutes from '../backend/src/routes/declarationRoutes.js';
import * as declarationController from '../backend/src/controllers/declarationController.js';
import * as userController from '../backend/src/controllers/userController.js';

// Aucune connexion MongoDB : les accès base sont remplacés par des stubs,
// mais la validation Mongoose (save -> validate) reste la vraie.
const { ObjectId } = Declaration.base.Types;

const originals = {
  declarationCreate: Declaration.create,
  declarationFindOne: Declaration.findOne,
  declarationFind: Declaration.find,
  declarationCount: Declaration.countDocuments,
  utilisateurFindById: Utilisateur.findById,
  categorieFindOne: Categorie.findOne,
  journalCreate: JournalAudit.create
};

before(() => {
  JournalAudit.create = async () => ({});
  Categorie.findOne = async () => ({ _id: new ObjectId(), nom: 'Clés' });
});

after(() => {
  Declaration.create = originals.declarationCreate;
  Declaration.findOne = originals.declarationFindOne;
  Declaration.find = originals.declarationFind;
  Declaration.countDocuments = originals.declarationCount;
  Utilisateur.findById = originals.utilisateurFindById;
  Categorie.findOne = originals.categorieFindOne;
  JournalAudit.create = originals.journalCreate;
});

// Exécute un contrôleur (asyncHandler ne renvoie pas de promesse) et attend la réponse ou l'erreur.
const callController = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: JSON.parse(JSON.stringify(payload)) }); }
  };
  handler(req, res, err => reject(err));
});

// Simule une ancienne déclaration en base, créée avec photos et une modération IMAGE.
const legacyDeclaration = (ownerId, overrides = {}) => {
  const doc = Declaration.hydrate({
    _id: new ObjectId(),
    declarantId: ownerId,
    type: 'PERDU',
    titre: 'Portefeuille noir perdu',
    description: 'Portefeuille en cuir noir perdu près de la bibliothèque',
    categorieId: new ObjectId(),
    detailsObjet: { couleur: 'Noir', marque: null },
    lieu: { nomLieu: 'Bibliothèque', zone: 'Nord' },
    dateEvenement: new Date('2026-05-10'),
    photos: ['uploads/1715000000-123.png'],
    statut: 'EN_ATTENTE',
    statutGarde: 'UNKNOWN',
    aiModerationReason: 'Image inappropriée détectée',
    aiModerationSource: 'IMAGE',
    isDeleted: false,
    ...overrides
  });
  // save() sans base : on garde uniquement la vraie validation
  doc.save = async function () { await this.validate(); return this; };
  return doc;
};

const member = () => ({ _id: new ObjectId(), role: 'MEMBRE' });
const admin = () => ({ _id: new ObjectId(), role: 'ADMIN' });

describe('Déclarations sans photos', () => {
  test('Le schéma ne contient plus le champ photos', () => {
    assert.equal(Declaration.schema.path('photos'), undefined);
    for (const field of ['titre', 'description', 'categorieId', 'detailsObjet', 'lieu', 'aiModerationSource']) {
      assert.ok(Declaration.schema.path(field) || Declaration.schema.pathType(field) === 'nested', `champ ${field} conservé`);
    }
  });

  test('aiModerationSource accepte encore IMAGE (valeur historique)', () => {
    assert.deepEqual(Declaration.schema.path('aiModerationSource').enumValues, ['TEXTE', 'IMAGE', null]);
  });

  test('Les routes de création et de modification n\'ont plus de middleware d\'upload', () => {
    const routeStack = (method, path) =>
      declarationRoutes.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack;
    const post = routeStack('post', '/');
    const put = routeStack('put', '/:id');
    assert.equal(post.length, 3); // validateRequest, aiModeration, contrôleur
    assert.equal(put.length, 4);  // ownerOrAdmin, validateRequest, aiModeration, contrôleur
    assert.ok([...post, ...put].every(l => !/multer/i.test(l.name)));
  });

  test('Zod accepte une création sans photos (urlencoded et JSON) et ignore un champ photos', () => {
    const validator = declarationRoutes.stack
      .find(l => l.route?.path === '/' && l.route.methods.post).route.stack[0].handle;
    const run = body => {
      const req = { body, locale: 'fr' };
      let err;
      validator(req, {}, e => { err = e; });
      return { err, body: req.body };
    };
    const base = {
      type: 'TROUVE',
      titre: 'Clés trouvées',
      description: 'Trousseau de clés trouvé au parking B',
      categorie: 'Clés',
      dateEvenement: '2026-11-18T10:00:00Z'
    };
    assert.equal(run({ ...base, latitude: '36.8', contactVisible: 'true' }).err, undefined);
    assert.equal(run({ ...base, latitude: '36.8', longitude: '10.1', contactVisible: false }).err, undefined);
    const withPhotos = run({ ...base, photos: ['x.png'] });
    assert.equal(withPhotos.err, undefined);
    assert.equal('photos' in withPhotos.body, false);
  });

  test('createDeclaration n\'enregistre jamais de photos, même si req.files est présent', async () => {
    let created;
    Declaration.create = async data => { created = data; return new Declaration(data); };
    const user = member();
    const { statusCode, body } = await callController(declarationController.createDeclaration, {
      user,
      body: {
        type: 'TROUVE',
        titre: 'Clés trouvées',
        description: 'Trousseau de clés trouvé au parking B',
        categorie: 'Clés',
        dateEvenement: new Date('2026-11-18'),
        couleur: 'Bleu',
        marque: 'Renault'
      },
      files: [{ path: 'uploads/x.png' }],
      moderationResult: { statut: 'ACTIVE', reason: null, source: null }
    });
    assert.equal(statusCode, 201);
    assert.equal('photos' in created, false);
    assert.equal('photos' in body.data, false);
    assert.equal(body.data.detailsObjet.couleur, 'Bleu');
    assert.equal(body.data.statut, 'ACTIVE');
  });

  test('Ancienne déclaration : consultation sans photos exposées', async () => {
    const user = member();
    const doc = legacyDeclaration(user._id, { statut: 'ACTIVE' });
    const chain = { populate() { return chain; }, then: (ok, ko) => Promise.resolve(doc).then(ok, ko) };
    Declaration.findOne = () => chain;
    const { body } = await callController(declarationController.getDeclarationById, {
      params: { id: doc._id.toString() }, user, locale: 'fr'
    });
    assert.equal('photos' in body.data, false);
    assert.equal(body.data.aiModerationSource, 'IMAGE');
    // La donnée reste en base (non supprimée)
    assert.deepEqual(doc.get('photos', null, { strict: false }), ['uploads/1715000000-123.png']);
  });

  test('Ancienne déclaration (source IMAGE) : modification par le propriétaire', async () => {
    const user = member();
    const doc = legacyDeclaration(user._id, { statut: 'ACTIVE' });
    const { body } = await callController(declarationController.updateDeclaration, {
      declaration: doc,
      user,
      locale: 'fr',
      body: { titre: 'Portefeuille noir en cuir' },
      moderationResult: { statut: 'ACTIVE', reason: null, source: null }
    });
    assert.equal(body.data.titre, 'Portefeuille noir en cuir');
    assert.equal(body.data.aiModerationSource, null);
    assert.equal('photos' in body.data, false);
  });

  test('Ancienne déclaration (source IMAGE) : modification par un admin sans re-analyse', async () => {
    const doc = legacyDeclaration(new ObjectId());
    const { body } = await callController(declarationController.updateDeclaration, {
      declaration: doc, user: admin(), locale: 'fr',
      body: { couleur: 'Marron' }, moderationResult: null
    });
    assert.equal(body.data.detailsObjet.couleur, 'Marron');
    assert.equal(body.data.aiModerationSource, 'IMAGE');
  });

  test('Ancienne déclaration (source IMAGE) : validation par un admin', async () => {
    const doc = legacyDeclaration(new ObjectId());
    const { body } = await callController(declarationController.validateDeclaration, {
      declaration: doc, user: admin(), locale: 'fr'
    });
    assert.equal(body.data.statut, 'ACTIVE');
  });

  test('Ancienne déclaration (source IMAGE) : refus par un admin', async () => {
    const doc = legacyDeclaration(new ObjectId());
    const { body } = await callController(declarationController.rejectDeclaration, {
      declaration: doc, user: admin(), locale: 'fr', body: { motif: 'Doublon' }
    });
    assert.equal(body.data.statut, 'REFUSEE');
    assert.equal(body.data.motifRefus, 'Doublon');
  });

  test('Ancienne déclaration (source IMAGE) : changement de statut', async () => {
    const user = member();
    const doc = legacyDeclaration(user._id, { statut: 'ACTIVE' });
    const { body } = await callController(declarationController.updateDeclarationStatus, {
      declaration: doc, user, locale: 'fr', body: { statut: 'RESTITUEE' }
    });
    assert.equal(body.data.statut, 'RESTITUEE');
  });

  test('Ancienne déclaration (source IMAGE) : suppression (logique)', async () => {
    const user = member();
    const doc = legacyDeclaration(user._id);
    const { statusCode } = await callController(declarationController.deleteDeclaration, {
      declaration: doc, user, locale: 'fr'
    });
    assert.equal(statusCode, 200);
    assert.equal(doc.isDeleted, true);
  });
});

// Chaîne de requête Mongoose simulée (find().sort().skip().limit().populate() puis await)
const queryChain = result => {
  const chain = {
    sort() { return chain; }, skip() { return chain; }, limit() { return chain; }, populate() { return chain; },
    then: (ok, ko) => Promise.resolve(result).then(ok, ko)
  };
  return chain;
};

describe('Anciennes photos masquées dans tous les endpoints de liste', () => {
  const assertNoPhotos = list => {
    assert.ok(list.length > 0);
    for (const d of list) {
      assert.equal('photos' in d, false);
      assert.equal(d.titre, 'Portefeuille noir perdu');
    }
  };

  test('GET /declarations/moderation (getModerationQueue)', async () => {
    Declaration.find = () => queryChain([legacyDeclaration(new ObjectId()), legacyDeclaration(new ObjectId())]);
    Declaration.countDocuments = async () => 2;
    const { body } = await callController(declarationController.getModerationQueue, {
      query: { source: 'IMAGE' }, user: admin(), locale: 'fr'
    });
    assertNoPhotos(body.data.declarations);
    assert.equal(body.data.declarations[0].aiModerationSource, 'IMAGE');
  });

  test('GET /users/me/declarations (getMyDeclarations)', async () => {
    const user = member();
    Declaration.find = () => queryChain([legacyDeclaration(user._id)]);
    Declaration.countDocuments = async () => 1;
    const { body } = await callController(userController.getMyDeclarations, { query: {}, user, locale: 'fr' });
    assertNoPhotos(body.data.declarations);
  });

  test('GET /users/:id/declarations (getUserDeclarations)', async () => {
    const ownerId = new ObjectId();
    Utilisateur.findById = async () => ({ _id: ownerId });
    Declaration.find = () => queryChain([legacyDeclaration(ownerId)]);
    const { body } = await callController(userController.getUserDeclarations, {
      params: { id: ownerId.toString() }, user: admin(), locale: 'fr'
    });
    assertNoPhotos(body.data);
  });
});

describe('Requêtes HTTP JSON et urlencoded (validateurs Zod + contrôleurs réels)', () => {
  let server;
  let baseUrl;
  let lastCreated;
  let currentDoc;
  const owner = member();

  before(async () => {
    const routeStack = (method, path) =>
      declarationRoutes.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack;
    const postValidator = routeStack('post', '/')[0].handle;
    const putValidator = routeStack('put', '/:id')[1].handle;
    const fakeAuthAndModeration = (req, _res, next) => {
      req.user = owner;
      req.locale = 'fr';
      req.moderationResult = { statut: 'ACTIVE', reason: null, source: null };
      next();
    };

    Declaration.create = async data => { lastCreated = data; return new Declaration(data); };

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.post('/declarations', fakeAuthAndModeration, postValidator, declarationController.createDeclaration);
    app.put('/declarations/:id', fakeAuthAndModeration, (req, _res, next) => { req.declaration = currentDoc; next(); },
      putValidator, declarationController.updateDeclaration);
    app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ success: false, details: err.details }));

    await new Promise(resolve => { server = app.listen(0, resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise(resolve => server.close(resolve)));

  const base = {
    type: 'TROUVE',
    titre: 'Clés trouvées',
    description: 'Trousseau de clés trouvé au parking B',
    categorie: 'Clés',
    dateEvenement: '2026-11-18T10:00:00Z'
  };

  const postJson = body => fetch(`${baseUrl}/declarations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const postForm = body => fetch(`${baseUrl}/declarations`, {
    method: 'POST', body: new URLSearchParams(body)
  });

  test('POST JSON : latitude/longitude en chaîne (validation inchangée), contactVisible en booléen', async () => {
    const res = await postJson({ ...base, latitude: '36.8065', longitude: '10.1815', contactVisible: false });
    assert.equal(res.status, 201);
    assert.equal(lastCreated.lieu.latitude, 36.8065);
    assert.equal(lastCreated.lieu.longitude, 10.1815);
    assert.equal(lastCreated.contactVisible, false);
    assert.equal('photos' in (await res.json()).data, false);
  });

  test('POST JSON : contactVisible true', async () => {
    const res = await postJson({ ...base, contactVisible: true });
    assert.equal(res.status, 201);
    assert.equal(lastCreated.contactVisible, true);
  });

  test('POST urlencoded : tout arrive en chaîne et est converti', async () => {
    const res = await postForm({ ...base, latitude: '36.8', longitude: '10.1', contactVisible: 'true' });
    assert.equal(res.status, 201);
    assert.equal(lastCreated.lieu.latitude, 36.8);
    assert.equal(lastCreated.lieu.longitude, 10.1);
    assert.equal(lastCreated.contactVisible, true);
  });

  test('POST urlencoded : contactVisible=false', async () => {
    const res = await postForm({ ...base, contactVisible: 'false' });
    assert.equal(res.status, 201);
    assert.equal(lastCreated.contactVisible, false);
  });

  test('POST JSON : types invalides refusés (400)', async () => {
    for (const bad of [{ latitude: { x: 1 } }, { contactVisible: 1 }, { longitude: [1] }]) {
      const res = await postJson({ ...base, ...bad });
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
  });

  test('POST multipart avec photo : plus accepté (corps non lu -> 400)', async () => {
    const form = new FormData();
    for (const [k, v] of Object.entries(base)) form.append(k, v);
    form.append('photos', new Blob([Buffer.from('x')], { type: 'image/png' }), 'p.png');
    const res = await fetch(`${baseUrl}/declarations`, { method: 'POST', body: form });
    assert.equal(res.status, 400);
  });

  test('PUT JSON sur ancienne déclaration (source IMAGE) : coordonnées et booléen', async () => {
    currentDoc = legacyDeclaration(owner._id, { statut: 'ACTIVE' });
    const res = await fetch(`${baseUrl}/declarations/${currentDoc._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: '36.9', longitude: '10.2', contactVisible: false })
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();
    assert.equal(data.lieu.latitude, 36.9);
    assert.equal(data.lieu.longitude, 10.2);
    assert.equal(data.contactVisible, false);
    assert.equal('photos' in data, false);
  });

  test('PUT urlencoded sur ancienne déclaration : chaînes converties', async () => {
    currentDoc = legacyDeclaration(owner._id, { statut: 'ACTIVE' });
    const res = await fetch(`${baseUrl}/declarations/${currentDoc._id}`, {
      method: 'PUT', body: new URLSearchParams({ latitude: '36.7', contactVisible: 'true', couleur: 'Rouge' })
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();
    assert.equal(data.lieu.latitude, 36.7);
    assert.equal(data.contactVisible, true);
    assert.equal(data.detailsObjet.couleur, 'Rouge');
  });
});
