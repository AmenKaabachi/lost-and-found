import mongoose from 'mongoose';
import { StatutCorrespondance } from './enums.js';

const correspondanceSchema = new mongoose.Schema({
  declarationPerdueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Declaration', required: true },
  declarationTrouveeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Declaration', required: true },
  score: { type: Number, min: 0, max: 100, required: true },
  methode: { type: String, default: 'AUTO' },
  statut: { type: String, enum: Object.values(StatutCorrespondance), default: StatutCorrespondance.PROPOSEE },
  valideeParId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  dateValidation: { type: Date, default: null }
}, { timestamps: true });

correspondanceSchema.index({ declarationPerdueId: 1 });
correspondanceSchema.index({ declarationTrouveeId: 1 });
correspondanceSchema.index({ statut: 1 });

export default mongoose.model('Correspondance', correspondanceSchema);