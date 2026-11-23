
import 'dotenv/config';

import {
  checkNlpHealth,
  getSemanticSimilarity
} from '../src/modules/matching/nlpClient.js';

async function main() {
  console.log('1. Vérification du service NLP...');

  const health = await checkNlpHealth();

  console.log('Service disponible :', health.status);
  console.log('Modèle chargé :', health.model);

  console.log('\n2. Test de comparaison sémantique...');

  const result = await getSemanticSimilarity(
    'J’ai perdu un sac à dos noir contenant un ordinateur portable.',
    'Un sac noir avec un laptop a été retrouvé près de la bibliothèque.'
  );

  console.log('\nRésultat de la comparaison :');
  console.log('Similarité :', result.similarity);
  console.log('Pourcentage :', result.percentage + '%');
  console.log('Modèle :', result.model);
}

main().catch((error) => {
  console.error('\nÉchec du test :', error.message);
  process.exitCode = 1;
});
