import mongoose from 'mongoose';

const journalAuditSchema = new mongoose.Schema({
  acteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  action: { type: String, required: true },
  typeEntite: { type: String, required: true },
  entiteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

journalAuditSchema.index({ entiteId: 1, typeEntite: 1 });
journalAuditSchema.index({ acteurId: 1 });
journalAuditSchema.index({ createdAt: -1 });

export default mongoose.model('JournalAudit', journalAuditSchema);