import { Role } from '../models/enums.js';
import { moderateDeclarationContent } from '../services/geminiModeration.js';
import logger from '../errors/logging/logger.js';

/**
 * Middleware de modération IA basé sur l'API Google Gemini.
 * Analyse le texte (titre, description, lieu) et les photos sans les données de contact.
 * Calcule le statut : ACTIVE si tout est conforme, EN_ATTENTE sinon.
 * Si l'API est indisponible ou dépasse le délai : EN_ATTENTE (jamais de publication sans analyse).
 * Ne rejette jamais la requête.
 */
export const aiModeration = async (req, res, next) => {
  try {
    // Si c'est une modification par un ADMIN qui n'est pas l'auteur de la déclaration :
    // Selon la spécification : "Admin : tout statut, sans nouvelle analyse ni changement de statut."
    if (req.declaration) {
      const isOwner = req.declaration.declarantId?.toString() === req.user?._id?.toString();
      const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN].includes(req.user?.role);
      if (!isOwner && isAdmin) {
        req.moderationResult = null;
        return next();
      }
    }

    const textFields = {
      titre: req.body.titre ?? req.declaration?.titre,
      description: req.body.description ?? req.declaration?.description,
      lieuNom: req.body.lieuNom ?? req.declaration?.lieu?.nomLieu,
      zoneCampus: req.body.zoneCampus ?? req.declaration?.lieu?.zone,
      categorie: req.body.categorie,
      couleur: req.body.couleur ?? req.declaration?.detailsObjet?.couleur,
      marque: req.body.marque ?? req.declaration?.detailsObjet?.marque
    };

    const imageFiles = req.files || [];

    const result = await moderateDeclarationContent({
      textFields,
      imageFiles
    });

    req.moderationResult = result;
    next();
  } catch (err) {
    logger.error({ err }, 'Erreur inattendue dans aiModeration');
    // Règle de spécification : si incident ou indisponibilité, toujours EN_ATTENTE et ne jamais rejeter la requête
    req.moderationResult = {
      statut: 'EN_ATTENTE',
      reason: 'Incident technique lors de la modération IA (mise en attente pour examen manuel)',
      source: null
    };
    next();
  }
};
