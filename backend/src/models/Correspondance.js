
import mongoose from 'mongoose';

import {
  StatutCorrespondance,
  StatutReponseCorrespondance,
  DecisionFinaleCorrespondance
} from './enums.js';

// Réponse initiale d'un déclarant
const reponseSchema = new mongoose.Schema({
  statut: {
    type: String,
    enum: Object.values(StatutReponseCorrespondance),
    default: StatutReponseCorrespondance.EN_ATTENTE
  },
  dateReponse: {
    type: Date,
    default: null
  },
  motif: {
    type: String,
    default: null,
    trim: true
  }
}, { _id: false });

// Décision finale après discussion
const decisionFinaleSchema = new mongoose.Schema({
  statut: {
    type: String,
    enum: Object.values(DecisionFinaleCorrespondance),
    default: DecisionFinaleCorrespondance.EN_ATTENTE
  },
  dateDecision: {
    type: Date,
    default: null
  },
  motif: {
    type: String,
    default: null,
    trim: true
  }
}, { _id: false });

const correspondanceSchema = new mongoose.Schema({
  declarationPerdueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Declaration',
    required: true
  },

  declarationTrouveeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Declaration',
    required: true
  },

  score: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },

  methode: {
    type: String,
    default: 'AUTO'
  },

  statut: {
    type: String,
    enum: Object.values(StatutCorrespondance),
    default: StatutCorrespondance.PROPOSEE
  },

  // Réponses initiales des deux déclarants
  reponseDeclarantPerdu: {
    type: reponseSchema,
    default: () => ({})
  },

  reponseDeclarantTrouve: {
    type: reponseSchema,
    default: () => ({})
  },

  // Décisions finales des deux déclarants
  decisionFinaleDeclarantPerdu: {
    type: decisionFinaleSchema,
    default: () => ({})
  },

  decisionFinaleDeclarantTrouve: {
    type: decisionFinaleSchema,
    default: () => ({})
  },

  // Champs conservés pour compatibilité avec l'ancien fonctionnement
  valideeParId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Utilisateur',
    default: null
  },

  dateValidation: {
    type: Date,
    default: null
  }

}, { timestamps: true });

correspondanceSchema.index({ declarationPerdueId: 1 });
correspondanceSchema.index({ declarationTrouveeId: 1 });
correspondanceSchema.index({ statut: 1 });
correspondanceSchema.index(
  { declarationPerdueId: 1, declarationTrouveeId: 1 },
  { unique: true }
);

export default mongoose.model('Correspondance', correspondanceSchema);
