// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import Declaration from '../../src/models/Declaration.js';
import { searchDeclarations } from '../../src/services/search/declarationSearchService.js';

// 2. Test Setup
test('Declaration search builds ACTIVE, deletion and archive filters', async (t) => {
  const originalFind = Declaration.find;
  const originalCountDocuments = Declaration.countDocuments;
  let capturedFilter;
  let capturedSelect;
  let capturedSkip;
  let capturedLimit;

  Declaration.countDocuments = async () => 25;

  Declaration.find = (filter) => {
    capturedFilter = filter;
    const chain = {
      sort() { return this; },
      skip(value) { capturedSkip = value; return this; },
      limit(value) { capturedLimit = value; return this; },
      select(value) { capturedSelect = value; return this; },
      populate() { return this; },
      lean: async () => [{
        _id: '1',
        type: 'PERDU',
        titre: 'iPhone',
        description: 'Téléphone',
        categorieId: { _id: '2', nom: 'Électronique' },
        detailsObjet: {
          marque: 'Apple',
          modele: '15',
          couleur: 'Noir',
          signesDistinctifs: 'Rayure',
          numeroSerie: 'SERIAL-SECRET'
        },
        lieu: {
          nomLieu: 'Main',
          zone: 'Campus',
          description: 'SECRET LOCATION DESCRIPTION',
          latitude: 36.123,
          longitude: 10.123
        },
        declarantId: {
          nom: 'SECRET-NAME',
          prenom: 'SECRET-SURNAME',
          email: 'secret@example.com',
          telephone: 'SECRET-PHONE',
          avatar: 'secret-avatar'
        },
        dateEvenement: new Date('2026-01-01'),
        photos: ['photo.jpg'],
        statut: 'ACTIVE',
        statutGarde: 'UNKNOWN',
        contactVisible: true,
        numeroInventaire: 'SECRET-INVENTORY',
        aiModerationReason: 'SECRET-MODERATION',
        aiModerationSource: 'TEXTE',
        motifRefus: 'SECRET-REASON',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02')
      }]
    };
    return chain;
  };

  t.after(() => {
    Declaration.find = originalFind;
    Declaration.countDocuments = originalCountDocuments;
  });

  const noKeyword = await searchDeclarations(undefined);
  assert.equal(capturedSkip, 0);
  assert.equal(capturedLimit, 10);
  assert.equal(noKeyword.pagination.currentPage, 1);
  assert.equal(noKeyword.pagination.limit, 10);
  assert.equal(noKeyword.pagination.totalResults, 25);
  assert.equal(noKeyword.pagination.totalPages, 3);
  assert.equal(noKeyword.pagination.hasNextPage, true);
  assert.equal(noKeyword.pagination.hasPreviousPage, false);
  assert.equal(capturedFilter.statut, 'ACTIVE');
  assert.equal(capturedFilter.isDeleted, false);
  assert.equal(capturedFilter.archivedAt, null);
  assert.equal('$and' in capturedFilter, false);

  await searchDeclarations('iphone noir');
  assert.equal(capturedFilter.statut, 'ACTIVE');
  assert.equal(capturedFilter.isDeleted, false);
  assert.equal(capturedFilter.archivedAt, null);
  assert.equal(capturedFilter.$and.length, 2);

  const searchableFields = new Set([
    'titre', 'description', 'detailsObjet.marque', 'detailsObjet.modele',
    'detailsObjet.couleur', 'detailsObjet.signesDistinctifs',
    'lieu.nomLieu', 'lieu.zone'
  ]);
  const generatedFields = new Set(
    capturedFilter.$and.flatMap(condition =>
      condition.$or.map(branch => Object.keys(branch)[0])
    )
  );
  assert.deepEqual(generatedFields, searchableFields);

  const declaration = noKeyword.declarations[0];
  assert.equal(declaration.categorie.nom, 'Électronique');
  assert.equal(declaration.titre, 'iPhone');
  assert.equal(declaration.detailsObjet.marque, 'Apple');
  assert.equal(declaration.lieu.nomLieu, 'Main');

  const serialized = JSON.stringify(declaration);
  for (const secret of [
    'SECRET-NAME', 'SECRET-SURNAME', 'secret@example.com', 'SECRET-PHONE',
    'secret-avatar', 'SECRET-INVENTORY', 'SECRET-MODERATION', 'SECRET-REASON',
    'SERIAL-SECRET', 'SECRET LOCATION DESCRIPTION', '36.123', '10.123'
  ]) {
    assert.equal(serialized.includes(secret), false, `${secret} must not be returned`);
  }

  assert.equal(capturedSelect.declarantId, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(capturedSelect, 'lieu.latitude'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(capturedSelect, 'lieu.longitude'), false);
  assert.equal(capturedSelect['lieu.description'], 0);
  assert.equal(capturedSelect['detailsObjet.numeroSerie'], 0);

  await searchDeclarations({
    type: 'TROUVE',
    categorie: '507f1f77bcf86cd799439011',
    couleur: 'bleu',
    marque: 'Apple',
    lieu: 'bibliothèque',
    zoneCampus: 'A',
    dateDebut: '2026-01-01',
    dateFin: '2026-01-31'
  });
  assert.equal(capturedFilter.type, 'TROUVE');
  assert.equal(capturedFilter.categorieId, '507f1f77bcf86cd799439011');
  assert.equal(capturedFilter['detailsObjet.couleur'].test('BLEU clair'), true);
  assert.equal(capturedFilter['detailsObjet.marque'].test('APPLE'), true);
  assert.equal(capturedFilter['lieu.zone'].test('Zone A'), true);
  assert.equal(capturedFilter.$or.length, 2);
  assert.deepEqual(capturedFilter.dateEvenement, {
    $gte: new Date('2026-01-01T00:00:00.000Z'),
    $lte: new Date('2026-01-31T23:59:59.999Z')
  });
});

// 3. Sorting Tests
test('Declaration search applies date, relevance and distance sorting', async (t) => {
  const originalFind = Declaration.find;
  const originalCountDocuments = Declaration.countDocuments;

  const records = [
    {
      _id: '000000000000000000000001',
      type: 'PERDU',
      titre: 'Portefeuille vert perdu',
      description: 'Portefeuille vert',
      detailsObjet: { marque: null, modele: null, couleur: 'vert', signesDistinctifs: null },
      lieu: { nomLieu: 'Bibliotheque', zone: 'Bloc C', latitude: 36.82, longitude: 10.19 },
      dateEvenement: new Date('2026-11-10T12:00:00.000Z'),
      statut: 'ACTIVE',
      isDeleted: false,
      archivedAt: null,
      photos: []
    },
    {
      _id: '000000000000000000000002',
      type: 'TROUVE',
      titre: 'Trousse bleue trouvee',
      description: 'Trousse bleue',
      detailsObjet: { marque: null, modele: null, couleur: 'bleu', signesDistinctifs: null },
      lieu: { nomLieu: 'Salle B12', zone: 'Bloc B', latitude: 36.8100, longitude: 10.1850 },
      dateEvenement: new Date('2026-11-10T12:00:00.000Z'),
      statut: 'ACTIVE',
      isDeleted: false,
      archivedAt: null,
      photos: []
    },
    {
      _id: '000000000000000000000003',
      type: 'PERDU',
      titre: 'Test moderation',
      description: 'Sans coordonnées',
      detailsObjet: { marque: null, modele: null, couleur: null, signesDistinctifs: null },
      lieu: { nomLieu: 'Test', zone: 'Test', latitude: null, longitude: null },
      dateEvenement: new Date('2026-11-01T12:00:00.000Z'),
      statut: 'ACTIVE',
      isDeleted: false,
      archivedAt: null,
      photos: []
    },
    {
      _id: '000000000000000000000004',
      type: 'TROUVE',
      titre: 'Sac rouge trouve',
      description: 'Sac rouge',
      detailsObjet: { marque: 'Samsung', modele: null, couleur: 'rouge', signesDistinctifs: null },
      lieu: { nomLieu: 'Salle B12', zone: 'Bloc A', latitude: 36.8066, longitude: 10.1816 },
      dateEvenement: new Date('2026-11-10T12:00:00.000Z'),
      statut: 'ACTIVE',
      isDeleted: false,
      archivedAt: null,
      photos: []
    }
  ];

  let capturedSort;
  let capturedSkip;
  let capturedLimit;

  Declaration.countDocuments = async () => records.length;
  Declaration.find = () => {
    capturedSkip = 0;
    capturedLimit = null;
    const chain = {
      sort(value) { capturedSort = value; return this; },
      skip(value) { capturedSkip = value; return this; },
      limit(value) { capturedLimit = value; return this; },
      select() { return this; },
      populate() { return this; },
      lean: async () => {
        const limit = capturedLimit ?? records.length;
        const matched = [...records];
        if (capturedSort?.dateEvenement) {
          matched.sort((first, second) =>
            new Date(second.dateEvenement).getTime() - new Date(first.dateEvenement).getTime()
            || String(second._id).localeCompare(String(first._id))
          );
        }
        return matched.slice(capturedSkip ?? 0, (capturedSkip ?? 0) + limit);
      }
    };
    return chain;
  };

  t.after(() => {
    Declaration.find = originalFind;
    Declaration.countDocuments = originalCountDocuments;
  });

  const defaults = await searchDeclarations({ page: 1, limit: 2 });
  assert.deepEqual(capturedSort, { dateEvenement: -1, _id: -1 });
  assert.equal(capturedSkip, 0);
  assert.equal(capturedLimit, 2);
  assert.equal(defaults.declarations.length, 2);

  const relevance = await searchDeclarations({
    q: 'sac samsung',
    sort: 'pertinence',
    page: 1,
    limit: 2
  });
  assert.equal(relevance.declarations[0].titre, 'Sac rouge trouve');
  assert.equal(relevance.declarations[0].detailsObjet.marque, 'Samsung');

  const relevanceFallback = await searchDeclarations({
    sort: 'pertinence',
    page: 2,
    limit: 1
  });
  assert.equal(relevanceFallback.declarations.length, 1);
  assert.equal(relevanceFallback.pagination.currentPage, 2);

  const distance = await searchDeclarations({
    sort: 'distance',
    lat: 36.8065,
    lng: 10.1815,
    page: 1,
    limit: 10
  });
  assert.deepEqual(
    distance.declarations.map((declaration) => declaration.titre),
    [
      'Sac rouge trouve',
      'Trousse bleue trouvee',
      'Portefeuille vert perdu',
      'Test moderation'
    ]
  );

  const distancePage1 = await searchDeclarations({
    sort: 'distance',
    lat: 36.8065,
    lng: 10.1815,
    page: 1,
    limit: 2
  });
  const distancePage2 = await searchDeclarations({
    sort: 'distance',
    lat: 36.8065,
    lng: 10.1815,
    page: 2,
    limit: 2
  });
  const page1Ids = new Set(distancePage1.declarations.map((declaration) => declaration._id));
  assert.equal(
    distancePage2.declarations.some((declaration) => page1Ids.has(declaration._id)),
    false
  );

  const radius = await searchDeclarations({
    lat: 36.8065,
    lng: 10.1815,
    radius: 500,
    page: 1,
    limit: 10
  });
  assert.deepEqual(
    radius.declarations.map((declaration) => declaration.titre),
    [
      'Sac rouge trouve',
      'Trousse bleue trouvee'
    ]
  );
  assert.equal(radius.pagination.totalResults, 2);
  assert.equal(radius.pagination.totalPages, 1);
  assert.equal(radius.pagination.hasNextPage, false);
  assert.equal(radius.pagination.hasPreviousPage, false);
});
