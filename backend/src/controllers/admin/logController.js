import JournalAudit from '../../models/JournalAudit.js';

import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { superAdminMessages } from '../../errors/localization/superAdminTranslations.js';

// ─── GET /api/admin/logs (SUPER_ADMIN) ───────────────────
// Query : adminId, action, typeEntite, startDate, endDate, page, limit
export const getLogs = asyncHandler(async (req, res) => {
  const m = superAdminMessages(req);
  const { adminId, action, typeEntite, startDate, endDate, page, limit } = req.query;

  const filter = {};
  if (adminId) filter.acteurId = adminId;
  if (action) filter.action = action;
  if (typeEntite) filter.typeEntite = typeEntite;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) {
      const fin = new Date(endDate);
      fin.setUTCHours(23, 59, 59, 999); // endDate inclus
      filter.createdAt.$lte = fin;
    }
  }

  const [logs, total] = await Promise.all([
    JournalAudit.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('acteurId', 'nom prenom email role'),
    JournalAudit.countDocuments(filter)
  ]);

  sendSuccess(res, { logs, total, page, limit, pages: Math.ceil(total / limit) }, m.logsFetched);
});

// ─── DELETE /api/admin/logs?olderThanDays=90 (SUPER_ADMIN) ─
// Supprime les logs plus vieux que X jours.
export const purgeLogs = asyncHandler(async (req, res) => {
  const m = superAdminMessages(req);
  const { olderThanDays } = req.query;

  const dateLimite = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const { deletedCount } = await JournalAudit.deleteMany({ createdAt: { $lt: dateLimite } });

  // On garde une trace de la purge elle-même (créée APRÈS, donc jamais supprimée par elle)
  await JournalAudit.create({
    acteurId: req.user._id,
    action: 'LOGS_PURGE',
    typeEntite: 'JournalAudit',
    entiteId: req.user._id,
    details: { olderThanDays, dateLimite, deletedCount }
  });

  sendSuccess(res, { deletedCount, dateLimite }, m.logsPurged(deletedCount, olderThanDays));
});
