import mongoose from 'mongoose';
import { StatutSignalement } from './enums.js';

const signalementSchema = new mongoose.Schema({
  auteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  declarationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Declaration', required: true },
  motif: { type: String, required: true },
  description: { type: String, default: null },
  statut: { type: String, enum: Object.values(StatutSignalement), default: StatutSignalement.EN_ATTENTE },
  traiteParId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  traiteAt: { type: Date, default: null },
  // Ajout binôme 4 : note de l'admin quand il traite ou rejette le signalement
  notesResolution: { type: String, default: null }
}, { timestamps: true });

signalementSchema.index({ declarationId: 1 });
signalementSchema.index({ statut: 1 });
signalementSchema.index({ auteurId: 1, declarationId: 1 });

export default mongoose.model('Signalement', signalementSchema);