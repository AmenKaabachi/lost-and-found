import 'dotenv/config';
import { moderateDeclarationContent } from '../backend/src/services/geminiModeration.js';

async function runLiveTest() {
  console.log('--- TEST 1 : Déclaration normale et propre ---');
  const cleanResult = await moderateDeclarationContent({
    textFields: {
      titre: 'Clés perdues',
      description: 'J\'ai perdu mon trousseau de clés avec un badge bleu près de la bibliothèque universitaire.',
      lieuNom: 'Bibliothèque Universitaire',
      zoneCampus: 'Zone B',
      categorie: 'Clés'
    }
  });
  console.log('Résultat déclaration propre :', cleanResult);

  console.log('\n--- TEST 2 : Déclaration contenant des insultes et gros mots ---');
  const badResult = await moderateDeclarationContent({
    textFields: {
      titre: 'Voleur de merde',
      description: 'Espèce de connard rends-moi mon sac ou je vais te défoncer la gueule putain',
      lieuNom: 'Cafétéria',
      categorie: 'Sac'
    }
  });
  console.log('Résultat déclaration avec gros mots :', badResult);

  console.log('\n--- TEST 3 : Déclaration avec contenu inapproprié / illicite ---');
  const illicitResult = await moderateDeclarationContent({
    textFields: {
      titre: 'Vente de beuh et armes',
      description: 'Contactez-moi pour acheter de la cocaïne pure et un flingue 9mm pas cher',
      lieuNom: 'Derrière le gymnase',
      categorie: 'Autre'
    }
  });
  console.log('Résultat déclaration illicite :', illicitResult);
}

runLiveTest().catch(console.error);
