import mongoose from 'mongoose';

const categorieSchema = new mongoose.Schema({
  nom: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Categorie', categorieSchema);