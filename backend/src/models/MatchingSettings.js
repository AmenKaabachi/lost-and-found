import mongoose from 'mongoose';

const matchingSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: ['default'],
    default: 'default',
    unique: true
  },
  minimumMatchScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 55
  },
  highConfidenceThreshold: {
    type: Number,
    min: 0,
    max: 100,
    default: 80
  },
  weights: {
    semantic: { type: Number, min: 0, max: 100, default: 45 },
    category: { type: Number, min: 0, max: 100, default: 15 },
    attributes: { type: Number, min: 0, max: 100, default: 15 },
    date: { type: Number, min: 0, max: 100, default: 10 },
    location: { type: Number, min: 0, max: 100, default: 10 },
    profile: { type: Number, min: 0, max: 100, default: 5 }
  }
}, { timestamps: true });

export default mongoose.model('MatchingSettings', matchingSettingsSchema);
