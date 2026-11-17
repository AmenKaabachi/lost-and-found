import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  destinataireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  type: { type: String, required: true },
  titre: { type: String, required: true },
  contenu: { type: String, required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  referenceType: { type: String, default: null },
  lue: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ destinataireId: 1, lue: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);