import 'dotenv/config';
import fs from 'fs';
import { moderateDeclarationContent } from '../backend/src/services/geminiModeration.js';

async function testImageModeration() {
  // Créer un PNG 1x1 transparent valide
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const imgPath = 'uploads/test_sample_photo.png';
  if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
  fs.writeFileSync(imgPath, Buffer.from(pngBase64, 'base64'));

  console.log('--- TEST AVEC PHOTO ET TEXTE ---');
  const result = await moderateDeclarationContent({
    textFields: {
      titre: 'Sac à dos bleu',
      description: 'Sac à dos trouvé avec des cahiers d\'étudiant à l\'intérieur'
    },
    imageFiles: [
      { path: imgPath, mimetype: 'image/png' }
    ]
  });
  console.log('Résultat avec photo :', result);
}

testImageModeration().catch(console.error);
