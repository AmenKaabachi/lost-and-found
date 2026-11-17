import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  expediteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
  contenu: { type: String, required: true },
  luAt: { type: Date, default: null },
  supprimeAt: { type: Date, default: null }
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);