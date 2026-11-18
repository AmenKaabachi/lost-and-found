import mongoose from 'mongoose';
import { Role, TypeMembre, StatutUtilisateur } from './enums.js';

const utilisateurSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  prenom: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: Object.values(Role), default: Role.MEMBRE },
  typeMembre: { type: String, enum: Object.values(TypeMembre), default: TypeMembre.ETUDIANT },
  telephone: { type: String, default: null },
  actif: { type: Boolean, default: false },
  avatar: { type: String, default: null },
  notificationsEmail: { type: Boolean, default: true },
  statut: {
    type: String,
    enum: Object.values(StatutUtilisateur),
    default: StatutUtilisateur.EN_ATTENTE_VERIFICATION
  },
  lastVerificationSentAt: { type: Date, default: null },
  emailVerifie: { type: Boolean, default: false },
  verificationCode: { type: String, default: null },
  verificationCodeExpires: { type: Date, default: null },
  verificationAttempts: { type: Number, default: 0 },
  lastVerificationSentAt: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }
}, { timestamps: true });

utilisateurSchema.pre('save', function () {
  this.actif = this.statut === StatutUtilisateur.ACTIF;
});

utilisateurSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.verificationCode;
  delete obj.verificationCodeExpires;
  delete obj.verificationAttempts;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

export default mongoose.model('Utilisateur', utilisateurSchema);