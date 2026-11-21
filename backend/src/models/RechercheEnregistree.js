// 1. Imports
import mongoose from 'mongoose';
import { TypeDeclaration } from './enums.js';

// 2. Filter Schema
const filtresRechercheSchema = new mongoose.Schema({
  type: { type: String, enum: [...Object.values(TypeDeclaration), null], default: null },
  q: { type: String, default: null, trim: true },
  categorie: { type: String, default: null, trim: true },
  couleur: { type: String, default: null, trim: true },
  marque: { type: String, default: null, trim: true },
  lieu: { type: String, default: null, trim: true },
  zoneCampus: { type: String, default: null, trim: true },
  dateDebut: { type: Date, default: null },
  dateFin: { type: Date, default: null },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  radius: { type: Number, default: null, min: 0, max: 2000 },
  sort: { type: String, enum: ['date', 'pertinence', 'distance', null], default: null }
}, { _id: false });

// 3. Search Schema
const rechercheEnregistreeSchema = new mongoose.Schema({
  utilisateurId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Utilisateur',
    required: true
  },
  nom: { type: String, required: true, trim: true },
  filtres: { type: filtresRechercheSchema, default: () => ({}) },
  alerteEmail: { type: Boolean, default: false }
}, { timestamps: true });

// 4. Indexes
rechercheEnregistreeSchema.index({ utilisateurId: 1, createdAt: -1 });

// 5. Model Creation and Export
export default mongoose.model(
  'RechercheEnregistree',
  rechercheEnregistreeSchema,
  'recherches_enregistrees'
);
