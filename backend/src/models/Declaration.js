import mongoose from 'mongoose';
import { TypeDeclaration, StatutDeclaration, StatutGarde } from './enums.js';

const itemDetailsSchema = new mongoose.Schema({
  marque: { type: String, default: null },
  couleur: { type: String, default: null },
  modele: { type: String, default: null },
  numeroSerie: { type: String, default: null },
  signesDistinctifs: { type: String, default: null }
}, { _id: false });

const locationInfoSchema = new mongoose.Schema({
  nomLieu: { type: String, default: null },
  zone: { type: String, default: null },
  description: { type: String, default: null },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null }
}, { _id: false });

const declarationSchema = new mongoose.Schema({
  declarantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  type: { type: String, enum: Object.values(TypeDeclaration), required: true },
  titre: { type: String, required: true },
  description: { type: String, required: true },
  categorieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Categorie', required: true },
  detailsObjet: { type: itemDetailsSchema, default: () => ({}) },
  lieu: { type: locationInfoSchema, default: () => ({}) },
  dateEvenement: { type: Date, required: true },
  statut: { type: String, enum: Object.values(StatutDeclaration), default: StatutDeclaration.ACTIVE },
  statutGarde: { type: String, enum: Object.values(StatutGarde), default: StatutGarde.UNKNOWN },
  archivedAt: { type: Date, default: null },
  // Extensions API
  contactVisible: { type: Boolean, default: true },
  numeroInventaire: { type: String, default: null },
  aiModerationReason: { type: String, default: null },
  aiModerationSource: { type: String, enum: ['TEXTE', 'IMAGE', null], default: null },
  motifRefus: { type: String, default: null },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

declarationSchema.index({ type: 1, statut: 1, categorieId: 1 });
declarationSchema.index({ 'lieu.zone': 1 });
declarationSchema.index({ createdAt: -1 });

export default mongoose.model('Declaration', declarationSchema);