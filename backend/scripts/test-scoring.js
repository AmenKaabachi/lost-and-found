
import 'dotenv/config';
import { calculateMatchScore } from '../src/modules/matching/scoringService.js';

const declarationPerdue = {
  type: 'PERDU',

  titre: 'Sac à dos noir perdu',

  description:
    'J’ai perdu un sac à dos noir contenant un ordinateur portable.',

  categorieId: '675a12345678901234567890',

  declarantId: {
    moyenTransport: 'BUS',
    lieuResidence: 'Mahdia',
    nomEtablissement: 'ISAMM'
  },

  detailsObjet: {
    marque: 'Samsonite',
    couleur: 'Noir',
    modele: 'Sac à dos',
    numeroSerie: null,
    signesDistinctifs: 'Une petite étiquette rouge'
  },

  dateEvenement: new Date('2026-11-18'),

  lieu: {
    nomLieu: 'Bibliothèque universitaire',
    zone: 'Campus'
  }
};

const declarationTrouvee = {
  type: 'TROUVE',

  titre: 'Sac noir retrouvé',

  description:
    'Un sac noir avec un laptop a été retrouvé près de la bibliothèque.',

  categorieId: '675a12345678901234567890',

  declarantId: {
    moyenTransport: 'METRO',
    lieuResidence: 'Mahdia',
    nomEtablissement: 'ISAMM'
  },

  detailsObjet: {
    marque: 'Samsonite',
    couleur: 'Noir',
    modele: 'Sac à dos',
    numeroSerie: null,
    signesDistinctifs: 'Une petite étiquette rouge'
  },

  dateEvenement: new Date('2026-11-19'),

  lieu: {
    nomLieu: 'Bibliothèque universitaire',
    zone: 'Campus'
  }
};

async function main() {
  console.log('Calcul du score de correspondance...\n');

  const result = await calculateMatchScore(
    declarationPerdue,
    declarationTrouvee
  );

  console.log(JSON.stringify(result, null, 2));

  console.log('\n--- Résumé ---');
  console.log('Score global :', result.score + '%');
  console.log('Niveau de confiance :', result.confidence);
  console.log('Score du profil :', result.breakdown.profile.score);
  console.log('Poids disponible :', result.availableWeight + '%');
}

main().catch(error => {
  console.error('Erreur pendant le test :', error.message);
  process.exitCode = 1;
});
