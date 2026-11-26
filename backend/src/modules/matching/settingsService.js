import MatchingSettings from '../../models/MatchingSettings.js';

export const DEFAULT_MATCHING_SETTINGS = Object.freeze({
  minimumMatchScore: 55,
  highConfidenceThreshold: 80,
  weights: Object.freeze({
    semantic: 45,
    category: 15,
    attributes: 15,
    date: 10,
    location: 10,
    profile: 5
  })
});

export const getMatchingSettings = async () => {
  const settings = await MatchingSettings.findOne({ key: 'default' }).lean();

  if (!settings) {
    return {
      ...DEFAULT_MATCHING_SETTINGS,
      weights: { ...DEFAULT_MATCHING_SETTINGS.weights }
    };
  }

  return {
    minimumMatchScore: settings.minimumMatchScore,
    highConfidenceThreshold: settings.highConfidenceThreshold,
    weights: { ...settings.weights }
  };
};

export const saveMatchingSettings = async (settings) => {
  const updated = await MatchingSettings.findOneAndUpdate(
    { key: 'default' },
    { $set: settings, $setOnInsert: { key: 'default' } },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return {
    minimumMatchScore: updated.minimumMatchScore,
    highConfidenceThreshold: updated.highConfidenceThreshold,
    weights: { ...updated.weights }
  };
};
