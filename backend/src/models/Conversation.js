import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  participantIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Utilisateur', required: true },
  correspondanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Correspondance', default: null },
  lastMessageAt: { type: Date, default: null },
  archivee: { type: Boolean, default: false }
}, { timestamps: true });

conversationSchema.index({ participantIds: 1 });
conversationSchema.index({ correspondanceId: 1 });

export default mongoose.model('Conversation', conversationSchema);