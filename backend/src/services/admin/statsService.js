// Calculs des statistiques (binôme 4, étape 4).
// Utilisés par les routes /api/admin/stats/* ET par l'export CSV/PDF.
import Utilisateur from '../../models/Utilisateur.js';
import Declaration from '../../models/Declaration.js';
import Categorie from '../../models/Categorie.js';
import Signalement from '../../models/Signalement.js';
import Correspondance from '../../models/Correspondance.js';
import Resolution from '../../models/Resolution.js';

import { StatutDeclaration, StatutSignalement } from '../../models/enums.js';

// ─── Outils ──────────────────────────────────────────────

// Filtre sur createdAt entre startDate et endDate (les deux optionnels)
const dateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const createdAt = {};
  if (startDate) createdAt.$gte = startDate;
  if (endDate) {
    // endDate inclus : jusqu'à 23:59:59.999 ce jour-là
    const fin = new Date(endDate);
    fin.setUTCHours(23, 59, 59, 999);
    createdAt.$lte = fin;
  }
  return { createdAt };
};

// [{ _id: 'A', n: 3 }, { _id: 'B', n: 1 }]  →  { A: 3, B: 1 }
const toObject = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'INCONNU', r.n]));

const countBy = (Model, field, match = {}) =>
  Model.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } }
  ]).then(toObject);

const declarationsMatch = (startDate, endDate) => ({
  isDeleted: false,
  ...dateFilter(startDate, endDate)
});

// ─── Vue d'ensemble (KPIs) ───────────────────────────────
export const computeOverview = async ({ startDate, endDate } = {}) => {
  const periode = dateFilter(startDate, endDate);
  const declMatch = declarationsMatch(startDate, endDate);

  const [
    totalUtilisateurs, utilisateursParRole, utilisateursParStatut,
    totalDeclarations, declarationsParType, declarationsParStatut,
    signalementsParStatut, correspondancesParStatut, resolutionsParStatut
  ] = await Promise.all([
    Utilisateur.countDocuments(periode),
    countBy(Utilisateur, 'role', periode),
    countBy(Utilisateur, 'statut', periode),
    Declaration.countDocuments(declMatch),
    countBy(Declaration, 'type', declMatch),
    countBy(Declaration, 'statut', declMatch),
    countBy(Signalement, 'statut', periode),
    countBy(Correspondance, 'statut', periode),
    countBy(Resolution, 'statut', periode)
  ]);

  // Objets rendus = RESTITUEE (binôme 1) + RESOLVED (binôme 3)
  const restituees =
    (declarationsParStatut[StatutDeclaration.RESTITUEE] || 0) +
    (declarationsParStatut[StatutDeclaration.RESOLVED] || 0);

  const signalementsOuverts =
    (signalementsParStatut[StatutSignalement.EN_ATTENTE] || 0) +
    (signalementsParStatut[StatutSignalement.EN_EXAMEN] || 0);

  return {
    periode: { startDate: startDate || null, endDate: endDate || null },
    utilisateurs: { total: totalUtilisateurs, parRole: utilisateursParRole, parStatut: utilisateursParStatut },
    declarations: {
      total: totalDeclarations,
      parType: declarationsParType,
      parStatut: declarationsParStatut,
      enAttenteModeration: declarationsParStatut[StatutDeclaration.EN_ATTENTE] || 0,
      restituees,
      // en %, arrondi à 1 décimale
      tauxRestitution: totalDeclarations ? Math.round((restituees / totalDeclarations) * 1000) / 10 : 0
    },
    signalements: { ouverts: signalementsOuverts, parStatut: signalementsParStatut },
    correspondances: { parStatut: correspondancesParStatut },
    resolutions: { parStatut: resolutionsParStatut }
  };
};

// ─── Répartition par catégorie ───────────────────────────
export const computeCategories = async ({ startDate, endDate } = {}) => {
  const rows = await Declaration.aggregate([
    { $match: declarationsMatch(startDate, endDate) },
    {
      $group: {
        _id: '$categorieId',
        total: { $sum: 1 },
        perdus: { $sum: { $cond: [{ $eq: ['$type', 'PERDU'] }, 1, 0] } },
        trouves: { $sum: { $cond: [{ $eq: ['$type', 'TROUVE'] }, 1, 0] } }
      }
    },
    {
      $lookup: {
        from: Categorie.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'categorie'
      }
    },
    { $sort: { total: -1 } },
    {
      $project: {
        _id: 0,
        categorieId: '$_id',
        categorie: { $ifNull: [{ $arrayElemAt: ['$categorie.nom', 0] }, 'Sans catégorie'] },
        total: 1,
        perdus: 1,
        trouves: 1
      }
    }
  ]);

  const totalGeneral = rows.reduce((s, r) => s + r.total, 0);
  return rows.map((r) => ({
    ...r,
    pourcentage: totalGeneral ? Math.round((r.total / totalGeneral) * 1000) / 10 : 0
  }));
};

// ─── Évolution dans le temps ─────────────────────────────
// interval : 'daily' (par jour) ou 'monthly' (par mois)
export const computeEvolution = async ({ startDate, endDate, interval = 'daily' } = {}) => {
  // Période par défaut : 30 derniers jours (daily) ou 12 derniers mois (monthly)
  const fin = endDate || new Date();
  let debut = startDate;
  if (!debut) {
    debut = new Date(fin);
    if (interval === 'monthly') debut.setUTCMonth(debut.getUTCMonth() - 11, 1);
    else debut.setUTCDate(debut.getUTCDate() - 29);
    debut.setUTCHours(0, 0, 0, 0);
  }

  const format = interval === 'monthly' ? '%Y-%m' : '%Y-%m-%d';

  const rows = await Declaration.aggregate([
    { $match: declarationsMatch(debut, fin) },
    {
      $group: {
        _id: { $dateToString: { format, date: '$createdAt' } },
        total: { $sum: 1 },
        perdus: { $sum: { $cond: [{ $eq: ['$type', 'PERDU'] }, 1, 0] } },
        trouves: { $sum: { $cond: [{ $eq: ['$type', 'TROUVE'] }, 1, 0] } },
        restituees: {
          $sum: {
            $cond: [{ $in: ['$statut', [StatutDeclaration.RESTITUEE, StatutDeclaration.RESOLVED]] }, 1, 0]
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Ajouter les périodes sans déclaration (à 0) pour avoir une courbe continue
  const parPeriode = Object.fromEntries(rows.map((r) => [r._id, r]));
  const points = [];
  const curseur = new Date(debut);
  curseur.setUTCHours(0, 0, 0, 0);
  if (interval === 'monthly') curseur.setUTCDate(1);
  while (curseur <= fin && points.length < 1000) {
    const cle = interval === 'monthly'
      ? curseur.toISOString().slice(0, 7)
      : curseur.toISOString().slice(0, 10);
    const r = parPeriode[cle];
    points.push({
      periode: cle,
      total: r?.total || 0,
      perdus: r?.perdus || 0,
      trouves: r?.trouves || 0,
      restituees: r?.restituees || 0
    });
    if (interval === 'monthly') curseur.setUTCMonth(curseur.getUTCMonth() + 1);
    else curseur.setUTCDate(curseur.getUTCDate() + 1);
  }

  return { interval, startDate: debut, endDate: fin, points };
};
