import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Categorie from './src/models/Categorie.js';

dotenv.config();
await mongoose.connect(process.env.MONGO_URI, {
  dbName: 'main'
});
const categories = [
  { nom: 'Électronique', description: 'Téléphones, laptops, écouteurs' },
  { nom: 'Documents', description: 'Cartes étudiantes, CNI, passeports' },
  { nom: 'Vêtements', description: 'Vestes, sacs, écharpes' },
  { nom: 'Clés', description: 'Clés de voiture, chambre, casier' },
  { nom: 'Accessoires', description: 'Montres, lunettes, bijoux' },
  { nom: 'Autres', description: 'Objets divers' }
];

for (const cat of categories) {
  await Categorie.updateOne({ nom: cat.nom }, { $setOnInsert: cat }, { upsert: true });
}
console.log(`✅ ${categories.length} catégories seedées`);
process.exit(0);