import mongoose from 'mongoose';
import { StatutGarde } from './enums.js';

const historiqueGardeSchema = new mongoose.Schema({
  declarationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Declaration', required: true },
  enregistreParId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  statut: { type: String, enum: Object.values(StatutGarde), required: true },
  lieu: { type: String, default: null },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date, default: null },
  commentaire: { type: String, default: null }
}, { timestamps: true });

historiqueGardeSchema.index({ declarationId: 1, dateDebut: -1 });

export default mongoose.model('HistoriqueGarde', historiqueGardeSchema);