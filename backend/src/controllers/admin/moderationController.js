import Declaration from '../../models/Declaration.js';
import Signalement from '../../models/Signalement.js';
import JournalAudit from '../../models/JournalAudit.js';

import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { moderationMessages } from '../../errors/localization/moderationTranslations.js';

import { StatutDeclaration, StatutSignalement } from '../../models/enums.js';

// Signalements encore "ouverts" (pas encore traités ni rejetés)
const STATUTS_OUVERTS = [StatutSignalement.EN_ATTENTE, StatutSignalement.EN_EXAMEN];

// ─── GET /api/admin/declarations/flagged ─────────────────
// Déclarations qui ont reçu au moins `minReports` signalements ouverts.
// Query : minReports (défaut 1), page, limit
export const getFlaggedDeclarations = asyncHandler(async (req, res) => {
  const m = moderationMessages(req);
  const { minReports, page, limit } = req.query;

  const [result] = await Signalement.aggregate([
    // 1. Garder seulement les signalements ouverts
    { $match: { statut: { $in: STATUTS_OUVERTS } } },
    // 2. Les regrouper par déclaration et les compter
    {
      $group: {
        _id: '$declarationId',
        nbSignalements: { $sum: 1 },
        motifs: { $addToSet: '$motif' },
        dernierSignalement: { $max: '$createdAt' }
      }
    },
    // 3. Garder les déclarations assez signalées
    { $match: { nbSignalements: { $gte: minReports } } },
    // 4. Joindre la déclaration elle-même
    {
      $lookup: {
        from: Declaration.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'declaration'
      }
    },
    { $unwind: '$declaration' },
    { $match: { 'declaration.isDeleted': false } },
    // 5. Les plus signalées en premier
    { $sort: { nbSignalements: -1, dernierSignalement: -1 } },
    { $addFields: { declarationId: '$_id' } },
    // 6. Pagination + total en une seule requête
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              declarationId: 1,
              nbSignalements: 1,
              motifs: 1,
              dernierSignalement: 1,
              declaration: {
                titre: '$declaration.titre',
                type: '$declaration.type',
                statut: '$declaration.statut',
                declarantId: '$declaration.declarantId',
                createdAt: '$declaration.createdAt'
              }
            }
          }
        ],
        total: [{ $count: 'n' }]
      }
    }
  ]);

  const total = result.total[0]?.n || 0;
  sendSuccess(
    res,
    { declarations: result.items, total, page, limit, pages: Math.ceil(total / limit) },
    m.flaggedFetched
  );
});

// ─── GET /api/admin/declarations/duplicates ──────────────
// Doublons possibles : même déclarant + même type + même titre (sans tenir
// compte des majuscules ni des espaces autour). Query : type?, page, limit
export const getDuplicateDeclarations = asyncHandler(async (req, res) => {
  const m = moderationMessages(req);
  const { type, page, limit } = req.query;

  const match = {
    isDeleted: false,
    statut: { $in: [StatutDeclaration.ACTIVE, StatutDeclaration.EN_ATTENTE] }
  };
  if (type) match.type = type;

  const [result] = await Declaration.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          declarantId: '$declarantId',
          type: '$type',
          titre: { $toLower: { $trim: { input: '$titre' } } }
        },
        nb: { $sum: 1 },
        declarations: {
          $push: { _id: '$_id', titre: '$titre', statut: '$statut', createdAt: '$createdAt' }
        }
      }
    },
    // Un "groupe" n'est un doublon que s'il contient au moins 2 déclarations
    { $match: { nb: { $gt: 1 } } },
    { $sort: { nb: -1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              declarantId: '$_id.declarantId',
              type: '$_id.type',
              titre: '$_id.titre',
              nb: 1,
              declarations: 1
            }
          }
        ],
        total: [{ $count: 'n' }]
      }
    }
  ]);

  const total = result.total[0]?.n || 0;
  sendSuccess(
    res,
    { groupes: result.items, total, page, limit, pages: Math.ceil(total / limit) },
    m.duplicatesFetched
  );
});

// ─── POST /api/admin/declarations/bulk-action ────────────
// Body : { action: 'delete' | 'hide', ids: [...], motif? }
// - delete : suppression "douce" (isDeleted = true), comme le binôme 1
// - hide   : statut MASQUEE + motif, comme PATCH /declarations/:id/status
// Dans les deux cas, les signalements ouverts de ces déclarations passent à TRAITE.
export const bulkAction = asyncHandler(async (req, res) => {
  const m = moderationMessages(req);
  const { action, ids } = req.body;
  const motif = req.body.motif || m.defaultHideReason;

  // 1. Quelles déclarations existent vraiment ?
  const declarations = await Declaration.find(
    { _id: { $in: ids }, isDeleted: false },
    { _id: 1, statut: 1 }
  );
  const trouves = declarations.map((d) => String(d._id));
  const introuvables = ids.filter((id) => !trouves.includes(id));

  if (trouves.length === 0) {
    return sendSuccess(res, { action, modifies: 0, introuvables }, m.bulkDone(0));
  }

  // 2. Appliquer l'action
  if (action === 'delete') {
    await Declaration.updateMany({ _id: { $in: trouves } }, { $set: { isDeleted: true } });
  } else {
    await Declaration.updateMany(
      { _id: { $in: trouves } },
      { $set: { statut: StatutDeclaration.MASQUEE, motifRefus: motif } }
    );
  }

  // 3. Fermer les signalements ouverts de ces déclarations
  await Signalement.updateMany(
    { declarationId: { $in: trouves }, statut: { $in: STATUTS_OUVERTS } },
    {
      $set: {
        statut: StatutSignalement.TRAITE,
        traiteParId: req.user._id,
        traiteAt: new Date(),
        notesResolution: action === 'delete' ? 'Déclaration supprimée' : `Déclaration masquée : ${motif}`
      }
    }
  );

  // 4. Une ligne d'audit par déclaration (visible dans GET /declarations/:id/history)
  await JournalAudit.insertMany(
    declarations.map((d) => ({
      acteurId: req.user._id,
      action: action === 'delete' ? 'DELETE' : 'STATUS_CHANGE',
      typeEntite: 'Declaration',
      entiteId: d._id,
      details: action === 'delete'
        ? { bulk: true }
        : { bulk: true, ancienStatut: d.statut, nouveauStatut: StatutDeclaration.MASQUEE, motif }
    }))
  );

  sendSuccess(res, { action, modifies: trouves.length, introuvables }, m.bulkDone(trouves.length));
});

