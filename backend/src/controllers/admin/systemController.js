import mongoose from 'mongoose';

import Utilisateur from '../../models/Utilisateur.js';
import Declaration from '../../models/Declaration.js';
import Correspondance from '../../models/Correspondance.js';

import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { adminMessages } from '../../errors/localization/adminTranslations.js';

// Correspondance entre le code numérique de Mongoose et un texte lisible
const DB_STATES = {
  0: 'DISCONNECTED',
  1: 'CONNECTED',
  2: 'CONNECTING',
  3: 'DISCONNECTING'
};

const toMB = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

/**
 * GET /api/admin/system/health
 * Réservé au SUPER_ADMIN : état du serveur et de la base de données.
 */
export const getSystemHealth = asyncHandler(async (req, res) => {
  const m = adminMessages(req);

  // 1. Base de données : état de la connexion + temps de réponse (ping)
  const database = {
    status: DB_STATES[mongoose.connection.readyState] || 'UNKNOWN',
    name: mongoose.connection.name || null,
    latencyMs: null
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      database.latencyMs = Date.now() - start;
    } catch {
      database.status = 'ERROR';
    }
  }

  const dbOk = database.status === 'CONNECTED';

  // 2. Quelques compteurs pour vérifier que les données sont accessibles
  let counts = null;
  if (dbOk) {
    const [utilisateurs, declarations, correspondances] = await Promise.all([
      Utilisateur.countDocuments(),
      Declaration.countDocuments({ isDeleted: { $ne: true } }),
      Correspondance.countDocuments()
    ]);
    counts = { utilisateurs, declarations, correspondances };
  }

  // 3. Serveur Node.js
  const memory = process.memoryUsage();
  const server = {
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    memoryMB: {
      rss: toMB(memory.rss),
      heapUsed: toMB(memory.heapUsed),
      heapTotal: toMB(memory.heapTotal)
    }
  };

  const status = dbOk ? 'OK' : 'DEGRADED';

  sendSuccess(
    res,
    { status, timestamp: new Date().toISOString(), database, counts, server },
    dbOk ? m.healthOk : m.healthDegraded,
    dbOk ? 200 : 503
  );
});
