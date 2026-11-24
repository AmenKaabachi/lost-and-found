
import mongoose from 'mongoose';

const matchingStateSchema = new mongoose.Schema({
  declarationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Declaration',
    required: true
  },

  // Date de modification de la déclaration lors du dernier matching réussi
  processedUpdatedAt: {
    type: Date,
    default: null
  },

  // Date du dernier matching réussi
  lastProcessedAt: {
    type: Date,
    default: null
  },

  // Date de la dernière tentative
  lastAttemptAt: {
    type: Date,
    default: null
  },

  // Nombre de tentatives de traitement
  attempts: {
    type: Number,
    default: 0,
    min: 0
  },

  status: {
    type: String,
    enum: ['EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ERREUR'],
    default: 'EN_ATTENTE'
  },

  // Verrou temporaire pour éviter les traitements simultanés
  lockUntil: {
    type: Date,
    default: null
  },

  lastError: {
    type: String,
    default: null
  }

}, { timestamps: true });

// Une seule entrée de suivi par déclaration
matchingStateSchema.index({ declarationId: 1 }, { unique: true });

// Facilite la recherche des traitements
matchingStateSchema.index({ status: 1, updatedAt: 1 });

export default mongoose.model('MatchingState', matchingStateSchema);
