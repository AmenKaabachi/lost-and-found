
import mongoose from 'mongoose';

import {
  TypeConflitMatching,
  StatutConflitMatching
} from './enums.js';

// Informations demandées aux déclarants pour clarifier un conflit
const informationSupplementaireSchema = new mongoose.Schema({
  demandeParId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Utilisateur',
    default: null
  },

  destinataireId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Utilisateur',
    required: true
  },

  question: {
    type: String,
    required: true,
    trim: true
  },

  reponse: {
    type: String,
    default: null,
    trim: true
  },

  dateDemande: {
    type: Date,
    default: Date.now
  },

  dateReponse: {
    type: Date,
    default: null
  }
}, { _id: true });

// Historique des relances du matching par l'administration
const relanceSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Utilisateur',
    required: true
  },

  dateRelance: {
    type: Date,
    default: Date.now
  },

  motif: {
    type: String,
    default: null,
    trim: true
  }
}, { _id: true });

const conflitMatchingSchema = new mongoose.Schema({

  // Nature du conflit
  type: {
    type: String,
    enum: Object.values(TypeConflitMatching),
    required: true
  },

  // État de traitement du conflit
  statut: {
    type: String,
    enum: Object.values(StatutConflitMatching),
    default: StatutConflitMatching.EN_ATTENTE
  },

  // Déclaration trouvée concernée par une égalité de scores
  declarationTrouveeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Declaration',
    default: null
  },

  // Déclaration perdue concernée, si le conflit porte sur une correspondance précise
  declarationPerdueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Declaration',
    default: null
  },

  // Une égalité peut concerner plusieurs correspondances.
  // Un désaccord entre deux utilisateurs concerne généralement une seule correspondance.
  correspondanceIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Correspondance'
  }],

  // Questions posées aux déclarants et informations reçues
  informationsSupplementaires: {
    type: [informationSupplementaireSchema],
    default: []
  },

  // Historique des relances du moteur de matching
  historiqueRelances: {
    type: [relanceSchema],
    default: []
  },

  // Administrateur ayant pris en charge le conflit
  traiteParId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Utilisateur',
    default: null
  },

  dateResolution: {
    type: Date,
    default: null
  },

  commentaireResolution: {
    type: String,
    default: null,
    trim: true
  }

}, { timestamps: true });

// Index pour retrouver rapidement les conflits
conflitMatchingSchema.index({ type: 1, statut: 1 });
conflitMatchingSchema.index({ declarationTrouveeId: 1 });
conflitMatchingSchema.index({ declarationPerdueId: 1 });
conflitMatchingSchema.index({ correspondanceIds: 1 });
conflitMatchingSchema.index({ createdAt: -1 });

export default mongoose.model('ConflitMatching', conflitMatchingSchema);
