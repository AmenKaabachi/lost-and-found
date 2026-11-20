import Declaration from '../../models/Declaration.js';
import { StatutDeclaration } from '../../models/enums.js';
import { buildKeywordRegex, tokenizeQuery } from '../../utils/search/searchUtils.js';

const SEARCHABLE_FIELDS = [
  'titre',
  'description',
  'detailsObjet.marque',
  'detailsObjet.modele',
  'detailsObjet.couleur',
  'detailsObjet.signesDistinctifs',
  'lieu.nomLieu',
  'lieu.zone'
];

const toPublicDeclaration = (declaration) => {
  const detailsObjet = declaration.detailsObjet || {};
  const lieu = declaration.lieu || {};
  const categorie = declaration.categorieId;

  return {
    _id: declaration._id,
    type: declaration.type,
    titre: declaration.titre,
    description: declaration.description,
    categorie: categorie && typeof categorie === 'object'
      ? { _id: categorie._id, nom: categorie.nom }
      : categorie,
    detailsObjet: {
      marque: detailsObjet.marque ?? null,
      modele: detailsObjet.modele ?? null,
      couleur: detailsObjet.couleur ?? null,
      signesDistinctifs: detailsObjet.signesDistinctifs ?? null
    },
    lieu: {
      nomLieu: lieu.nomLieu ?? null,
      zone: lieu.zone ?? null
    },
    dateEvenement: declaration.dateEvenement,
    photos: declaration.photos || [],
    statut: declaration.statut,
    statutGarde: declaration.statutGarde,
    contactVisible: declaration.contactVisible ?? true,
    createdAt: declaration.createdAt,
    updatedAt: declaration.updatedAt
  };
};

export const searchDeclarations = async (query) => {
  const tokens = tokenizeQuery(query);

  const mongoFilter = {
    statut: StatutDeclaration.ACTIVE,
    isDeleted: false,
    archivedAt: null
  };

  if (tokens.length > 0) {
    mongoFilter.$and = tokens.map((token) => ({
      $or: SEARCHABLE_FIELDS.map((field) => ({
        [field]: buildKeywordRegex(token)
      }))
    }));
  }

  const declarations = await Declaration.find(mongoFilter)
    .sort({ createdAt: -1 })
    .select({
      declarantId: 0,
      numeroInventaire: 0,
      aiModerationReason: 0,
      aiModerationSource: 0,
      motifRefus: 0,
      isDeleted: 0,
      archivedAt: 0,
      'lieu.latitude': 0,
      'lieu.longitude': 0,
      'lieu.description': 0,
      'detailsObjet.numeroSerie': 0
    })
    .populate('categorieId', 'nom')
    .lean();

  return declarations.map(toPublicDeclaration);
};
