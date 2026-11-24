
import 'dotenv/config';
import mongoose from 'mongoose';

import Declaration from './src/models/Declaration.js';
import Utilisateur from './src/models/Utilisateur.js';
import Correspondance from './src/models/Correspondance.js';
import MatchingState from './src/models/MatchingState.js';
import ConflitMatching from './src/models/ConflitMatching.js';

import {
  TypeDeclaration,
  StatutDeclaration,
  StatutGarde
} from './src/models/enums.js';

const TEST_PREFIX = 'TEST-MATCHING-';

const USER_PERDU = '6afcdaa90b22b070a2de0680';
const USER_TROUVE = '6afcde960b22b070a2de06ad';

const CATEGORIE_OBJET = '6afccf3d3a2a8ff5920f30a3';
const CATEGORIE_ECOUTEURS = '6afccf3d3a2a8ff5920f309e';

const dateRecente = (jours = 1) => {
  const date = new Date();
  date.setDate(date.getDate() - jours);
  return date;
};

const declarationsTest = [
  // SCENARIO 1 : correspondance évidente
  {
    declarantId: USER_PERDU,
    type: TypeDeclaration.PERDU,
    titre: `${TEST_PREFIX}01-Portefeuille`,
    description:
      'Portefeuille noir en cuir perdu avec plusieurs cartes et une carte etudiante a l interieur.',
    categorieId: CATEGORIE_OBJET,
    detailsObjet: {
      marque: 'Zara',
      couleur: 'Noir',
      modele: 'Classic',
      signesDistinctifs: 'Portefeuille avec carte etudiante'
    },
    lieu: {
      zone: 'Bibliotheque',
      latitude: 36.8066,
      longitude: 10.1816
    },
    dateEvenement: dateRecente(2),
    statut: StatutDeclaration.ACTIVE,
    statutGarde: StatutGarde.UNKNOWN
  },
  {
    declarantId: USER_TROUVE,
    type: TypeDeclaration.TROUVE,
    titre: `${TEST_PREFIX}01-Portefeuille-retrouve`,
    description:
      'J ai trouve un portefeuille noir en cuir contenant des cartes et une carte etudiante.',
    categorieId: CATEGORIE_OBJET,
    detailsObjet: {
      marque: 'Zara',
      couleur: 'Noir',
      modele: 'Classic',
      signesDistinctifs: 'Carte etudiante a l interieur'
    },
    lieu: {
      zone: 'Bibliotheque',
      latitude: 36.8067,
      longitude: 10.1817
    },
    dateEvenement: dateRecente(2),
    statut: StatutDeclaration.ACTIVE,
    statutGarde: StatutGarde.WITH_FINDER
  },

  // SCENARIO 2 : deux déclarations perdues similaires
  // pour un seul objet retrouvé.
  {
    declarantId: USER_PERDU,
    type: TypeDeclaration.PERDU,
    titre: `${TEST_PREFIX}02-Sac-rouge-A`,
    description:
      'Sac a dos rouge avec petit logo blanc perdu dans le campus universitaire.',
    categorieId: CATEGORIE_OBJET,
    detailsObjet: {
      marque: 'Zara',
      couleur: 'Rouge',
      modele: 'Classic',
      signesDistinctifs: 'Petit logo blanc'
    },
    lieu: {
      zone: 'Salle B12',
      latitude: 36.8066,
      longitude: 10.1816
    },
    dateEvenement: dateRecente(3),
    statut: StatutDeclaration.ACTIVE
  },
  {
    declarantId: USER_PERDU,
    type: TypeDeclaration.PERDU,
    titre: `${TEST_PREFIX}02-Sac-rouge-B`,
    description:
      'Sac a dos rouge avec petit logo blanc perdu dans le campus universitaire.',
    categorieId: CATEGORIE_OBJET,
    detailsObjet: {
      marque: 'Zara',
      couleur: 'Rouge',
      modele: 'Classic',
      signesDistinctifs: 'Petit logo blanc'
    },
    lieu: {
      zone: 'Salle B12',
      latitude: 36.8066,
      longitude: 10.1816
    },
    dateEvenement: dateRecente(3),
    statut: StatutDeclaration.ACTIVE
  },
  {
    declarantId: USER_TROUVE,
    type: TypeDeclaration.TROUVE,
    titre: `${TEST_PREFIX}02-Sac-rouge-retrouve`,
    description:
      'Sac a dos rouge avec petit logo blanc retrouve dans le campus universitaire.',
    categorieId: CATEGORIE_OBJET,
    detailsObjet: {
      marque: 'Zara',
      couleur: 'Rouge',
      modele: 'Classic',
      signesDistinctifs: 'Petit logo blanc'
    },
    lieu: {
      zone: 'Salle B12',
      latitude: 36.8066,
      longitude: 10.1816
    },
    dateEvenement: dateRecente(3),
    statut: StatutDeclaration.ACTIVE,
    statutGarde: StatutGarde.WITH_FINDER
  },

  // SCENARIO 3 : objets différents
  {
    declarantId: USER_PERDU,
    type: TypeDeclaration.PERDU,
    titre: `${TEST_PREFIX}03-Ecouteurs`,
    description:
      'Ecouteurs sans fil blancs perdus dans un amphitheatre.',
    categorieId: CATEGORIE_ECOUTEURS,
    detailsObjet: {
      marque: 'Apple',
      couleur: 'Blanc',
      modele: 'AirPods'
    },
    lieu: {
      zone: 'Amphitheatre A'
    },
    dateEvenement: dateRecente(1),
    statut: StatutDeclaration.ACTIVE
  },
  {
    declarantId: USER_TROUVE,
    type: TypeDeclaration.TROUVE,
    titre: `${TEST_PREFIX}03-Livre`,
    description:
      'Livre de mathematiques retrouve dans une salle de cours.',
    categorieId: CATEGORIE_OBJET,
    detailsObjet: {
      marque: null,
      couleur: 'Bleu',
      modele: null
    },
    lieu: {
      zone: 'Salle de cours'
    },
    dateEvenement: dateRecente(1),
    statut: StatutDeclaration.ACTIVE,
    statutGarde: StatutGarde.WITH_FINDER
  }
];

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI est absente du fichier .env');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    dbName: 'main'
  });

  console.log('[Seed Matching] MongoDB connecté.');

  // Vérifier les utilisateurs existants.
  const userPerdu = await Utilisateur.findById(USER_PERDU);
  const userTrouve = await Utilisateur.findById(USER_TROUVE);

  if (!userPerdu || !userTrouve) {
    throw new Error(
      'Les deux utilisateurs de test doivent exister dans MongoDB.'
    );
  }

  if (USER_PERDU === USER_TROUVE) {
    throw new Error(
      'Les deux utilisateurs doivent être différents.'
    );
  }

  // Nettoyer uniquement les anciennes données de ce seed.
  const anciennesDeclarations = await Declaration.find({
    titre: { $regex: `^${TEST_PREFIX}` }
  }).select('_id');

  const anciensIds = anciennesDeclarations.map(
    declaration => declaration._id
  );

  if (anciensIds.length > 0) {
    const anciennesCorrespondances = await Correspondance.find({
      $or: [
        { declarationPerdueId: { $in: anciensIds } },
        { declarationTrouveeId: { $in: anciensIds } }
      ]
    }).select('_id');

    const anciensCorrespondanceIds = anciennesCorrespondances.map(
      correspondance => correspondance._id
    );

    await ConflitMatching.deleteMany({
      $or: [
        { declarationPerdueId: { $in: anciensIds } },
        { declarationTrouveeId: { $in: anciensIds } },
        { correspondanceIds: { $in: anciensCorrespondanceIds } }
      ]
    });

    await Correspondance.deleteMany({
      _id: { $in: anciensCorrespondanceIds }
    });

    await MatchingState.deleteMany({
      declarationId: { $in: anciensIds }
    });

    await Declaration.deleteMany({
      _id: { $in: anciensIds }
    });

    console.log(
      `[Seed Matching] ${anciensIds.length} anciennes déclarations de test supprimées.`
    );
  }

  // Créer les nouvelles déclarations.
  const created = await Declaration.insertMany(
    declarationsTest
  );

  console.log(
    `\n[Seed Matching] ${created.length} déclarations créées.`
  );

  for (const declaration of created) {
    console.log(
      `${declaration.type} | ${declaration.titre} | ${declaration._id}`
    );
  }

  console.log('\n[Seed Matching] Initialisation terminée.');
};

main()
  .catch(error => {
    console.error('[Seed Matching] Erreur :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
