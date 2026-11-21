import 'dotenv/config';
import { moderateDeclarationContent } from '../backend/src/services/geminiModeration.js';

async function runTests() {
  console.log('================================================================');
  console.log('  TEST MODÉRATION — DIALECTE TUNISIEN (DERJA) & ARABIZI');
  console.log('================================================================\n');

  // TEST 1: Clean Tunisian Derja (should be ACTIVE)
  console.log('--- TEST 1 : Derja propre (sans insultes) ---');
  const clean = await moderateDeclarationContent({
    textFields: {
      titre: 'Tla3t sac noir',
      description: 'Lkit sac noir fi cafet, win sahbou? Fih des cahiers w stylo. Ya 5ouya elli dha3lou yji yakhdhhou.',
      lieuNom: 'Cafétéria ENSI',
      zoneCampus: 'Bloc A'
    }
  });
  console.log('Résultat :', clean);

  // TEST 2: Tunisian insults in arabizi (should be EN_ATTENTE)
  console.log('\n--- TEST 2 : Insultes tunisiennes en arabizi ---');
  const arabizi = await moderateDeclarationContent({
    textFields: {
      titre: 'Ya 7mar elli sra9 tel',
      description: 'Nik ommek ya manyak elli sra9li tel, kess ommek weld el 9a7ba barra raj3heli wella na3mel 3lik 7aja',
      lieuNom: 'Parking',
      zoneCampus: 'Zone B'
    }
  });
  console.log('Résultat :', arabizi);

  // TEST 3: Tunisian insults in Arabic script (should be EN_ATTENTE)
  console.log('\n--- TEST 3 : Insultes tunisiennes en caractères arabes ---');
  const arabic = await moderateDeclarationContent({
    textFields: {
      titre: 'يا كلب سارق',
      description: 'يا نايك كس أمك يا ولد القحبة ما تقربش ليا والا نكسرك',
      lieuNom: 'المكتبة',
      zoneCampus: 'Zone C'
    }
  });
  console.log('Résultat :', arabic);

  // TEST 4: Mixed French + Derja clean (should be ACTIVE)
  console.log('\n--- TEST 4 : Mélange français + derja (propre) ---');
  const mixed = await moderateDeclarationContent({
    textFields: {
      titre: 'Portefeuille perdu',
      description: 'J\'ai perdu mon portefeuille noir f bloc B, fiha carte CIN w flouss. Elli l9aha barcha merci ykalmni.',
      lieuNom: 'Bloc B',
      zoneCampus: 'Zone principale'
    }
  });
  console.log('Résultat :', mixed);

  // TEST 5: Evasion attempt with spaced letters in Derja (should be EN_ATTENTE)
  console.log('\n--- TEST 5 : Tentative de contournement (espaces insérés) ---');
  const evasion = await moderateDeclarationContent({
    textFields: {
      titre: 'Tel dha3',
      description: 'z a b b i 3lik ya k a h b a, barra marra rja3li tel',
      lieuNom: 'Amphi',
      zoneCampus: 'Zone A'
    }
  });
  console.log('Résultat :', evasion);
}

runTests().catch(console.error);
