
import 'dotenv/config';
import { getSemanticSimilarity } from '../src/modules/matching/nlpClient.js';

const testCases = [
  // Paires positives : même objet décrit différemment.
  {
    id: 1,
    label: 'POSITIF',
    lost: 'J’ai perdu un sac à dos noir contenant un ordinateur portable.',
    found: 'Un sac noir avec un laptop a été retrouvé près de la bibliothèque.'
  },
  {
    id: 2,
    label: 'POSITIF',
    lost: 'J’ai perdu un trousseau de clés avec un porte-clés bleu.',
    found: 'Un ensemble de clés accompagné d’un porte-clés de couleur bleue a été retrouvé.'
  },
  {
    id: 3,
    label: 'POSITIF',
    lost: 'Mes écouteurs sans fil blancs ont été perdus dans la salle de cours.',
    found: 'Une paire d’écouteurs Bluetooth blanche a été retrouvée dans une classe.'
  },
  {
    id: 4,
    label: 'POSITIF',
    lost: 'J’ai oublié ma bouteille d’eau rouge en acier inoxydable.',
    found: 'Une gourde métallique rouge a été trouvée.'
  },
  {
    id: 5,
    label: 'POSITIF',
    lost: 'ضاعتلي محفظة صغيرة بنية فيها بطاقة تعريف.',
    found: 'لقاو porte-monnaie صغير لونو بني وفيه بطاقة تعريف.'
  },
  {
    id: 6,
    label: 'POSITIF',
    lost: 'ضيعت تليفوني سامسونغ في المكتبة.',
    found: 'تم العثور على هاتف Samsung في المكتبة.'
  },

  // Paires négatives : objets différents, parfois avec des caractéristiques communes.
  {
    id: 7,
    label: 'NEGATIF',
    lost: 'J’ai perdu un sac à dos noir contenant un ordinateur portable.',
    found: 'J’ai retrouvé un sac noir contenant des vêtements.'
  },
  {
    id: 8,
    label: 'NEGATIF',
    lost: 'J’ai perdu un iPhone 13 noir.',
    found: 'Un Samsung Galaxy A15 noir a été retrouvé.'
  },
  {
    id: 9,
    label: 'NEGATIF',
    lost: 'J’ai perdu un trousseau de clés avec un porte-clés bleu.',
    found: 'Une paire de lunettes avec une monture bleue a été retrouvée.'
  },
  {
    id: 10,
    label: 'NEGATIF',
    lost: 'J’ai perdu une montre connectée noire.',
    found: 'Un portefeuille noir a été retrouvé.'
  },
  {
    id: 11,
    label: 'NEGATIF',
    lost: 'J’ai perdu un ordinateur portable HP gris.',
    found: 'Une tablette Samsung grise a été retrouvée.'
  },
  {
    id: 12,
    label: 'NEGATIF',
    lost: 'ضيعت تليفوني سامسونغ في المكتبة.',
    found: 'لقيت محفظة بنية فيها فلوس وبطاقة تعريف.'
  }
];

function calculateAverage(values) {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main() {
  console.log('======================================');
  console.log('ÉVALUATION DU MODÈLE MULTILINGUAL E5');
  console.log('======================================\n');

  const results = [];

  for (const test of testCases) {
    console.log(`Test ${test.id} (${test.label})`);

    const result = await getSemanticSimilarity(
      test.lost,
      test.found
    );

    results.push({
      ...test,
      similarity: result.percentage
    });

    console.log('Description perdue :', test.lost);
    console.log('Description trouvée :', test.found);
    console.log('Similarité :', result.percentage + '%');
    console.log('--------------------------------------');
  }

  const positiveResults = results
    .filter(test => test.label === 'POSITIF')
    .map(test => test.similarity);

  const negativeResults = results
    .filter(test => test.label === 'NEGATIF')
    .map(test => test.similarity);

  const positiveAverage = calculateAverage(positiveResults);
  const negativeAverage = calculateAverage(negativeResults);

  console.log('\n========== BILAN GLOBAL ==========');
  console.log(
    'Moyenne des paires positives :',
    positiveAverage.toFixed(2) + '%'
  );
  console.log(
    'Moyenne des paires négatives :',
    negativeAverage.toFixed(2) + '%'
  );
  console.log(
    'Écart entre les moyennes :',
    (positiveAverage - negativeAverage).toFixed(2) + ' points'
  );

  console.log('\n========== RÉSULTATS DÉTAILLÉS ==========');

  for (const test of results) {
    console.log(
      `Test ${test.id} | ${test.label} | ${test.similarity}%`
    );
  }
}

main().catch(error => {
  console.error('\nErreur pendant l’évaluation :', error.message);
  process.exitCode = 1;
});

