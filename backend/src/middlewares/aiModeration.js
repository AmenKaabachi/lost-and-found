// Mock — remplacer par un appel OpenAI Moderation API en production
export const aiModeration = async (req, res, next) => {
  // TODO: appel réel OpenAI sur req.body + req.files
  req.moderationResult = {
    statut: 'ACTIVE',
    reason: null,
    source: null
  };
  next();
};