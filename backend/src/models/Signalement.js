import mongoose from 'mongoose';
import { StatutSignalement } from './enums.js';

const signalementSchema = new mongoose.Schema({
  auteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  declarationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Declaration', required: true },
  motif: { type: String, required: true },
  description: { type: String, default: null },
  statut: { type: String, enum: Object.values(StatutSignalement), default: StatutSignalement.EN_ATTENTE },
  traiteParId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  traiteAt: { type: Date, default: null }
}, { timestamps: true });

signalementSchema.index({ declarationId: 1 });
signalementSchema.index({ statut: 1 });

export default mongoose.model('Signalement', signalementSchema);