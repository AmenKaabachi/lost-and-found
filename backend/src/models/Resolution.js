import mongoose from 'mongoose';
import { StatutResolution } from './enums.js';

const resolutionSchema = new mongoose.Schema({
  correspondanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Correspondance', required: true },
  declarationPerdueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Declaration', required: true },
  declarationTrouveeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Declaration', required: true },
  verifieeParId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  remiseParId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  proprietaireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  statut: { type: String, enum: Object.values(StatutResolution), default: StatutResolution.EN_ATTENTE },
  dateVerification: { type: Date, default: null },
  dateRemise: { type: Date, default: null },
  preuveVerification: { type: String, default: null },
  notes: { type: String, default: null }
}, { timestamps: true });

resolutionSchema.index({ correspondanceId: 1 }, { unique: true });
resolutionSchema.index({ proprietaireId: 1 });

export default mongoose.model('Resolution', resolutionSchema);