// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import RechercheEnregistree from '../../src/models/RechercheEnregistree.js';

// 2. Collection Tests
test('RechercheEnregistree uses the requested collection and default connection', () => {
  assert.equal(RechercheEnregistree.collection.collectionName, 'recherches_enregistrees');
  assert.equal(RechercheEnregistree.db, mongoose.connection);
});

// 3. Schema Tests
test('RechercheEnregistree filters are embedded and use API names', () => {
  assert.equal(RechercheEnregistree.schema.path('filtres').instance, 'Embedded');

  const filterSchema = RechercheEnregistree.schema.path('filtres').schema;
  const expected = [
    'type', 'q', 'categorie', 'couleur', 'marque', 'lieu', 'zoneCampus',
    'dateDebut', 'dateFin', 'lat', 'lng', 'radius', 'sort'
  ];

  for (const name of expected) {
    assert.ok(filterSchema.path(name), `missing filter: ${name}`);
  }
  assert.equal(filterSchema.path('rayonKm'), undefined);
  assert.equal(filterSchema.path('latitude'), undefined);
  assert.equal(filterSchema.path('longitude'), undefined);
});

test('RechercheEnregistree preserves owner, name, alert and timestamps', () => {
  assert.ok(RechercheEnregistree.schema.path('utilisateurId').isRequired);
  assert.ok(RechercheEnregistree.schema.path('nom').isRequired);
  assert.equal(RechercheEnregistree.schema.path('alerteEmail').defaultValue, false);
  assert.ok(RechercheEnregistree.schema.path('createdAt'));
  assert.ok(RechercheEnregistree.schema.path('updatedAt'));
});

test('radius is stored in metres with a 2000 metre maximum', () => {
  const radius = RechercheEnregistree.schema.path('filtres').schema.path('radius');
  assert.equal(radius.instance, 'Number');
  assert.equal(radius.options.max, 2000);
  assert.equal(radius.options.min, 0);
});
