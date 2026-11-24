
import 'dotenv/config';

import mongoose from 'mongoose';

import Declaration from '../../models/Declaration.js';
import MatchingState from '../../models/MatchingState.js';

import { StatutDeclaration } from '../../models/enums.js';
import '../../models/Utilisateur.js';

import { runMatchingForDeclaration } from './matchingService.js';

// Configuration
const POLLING_INTERVAL = Number(
  process.env.MATCHING_POLLING_INTERVAL || 30000
);

const LOCK_DURATION = 2 * 60 * 1000;
const HEARTBEAT_INTERVAL = 30 * 1000;
const RETRY_DELAY = 60 * 1000;
const BATCH_SIZE = 50;

let isStopping = false;

/**
 * Attend avant le prochain cycle.
 */
const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

/**
 * Récupère les déclarations qui nécessitent un matching.
 *
 * Important :
 * On récupère les déclarations avant de limiter le résultat.
 * Cela évite que les premières déclarations déjà traitées
 * bloquent définitivement les suivantes.
 */
const getPendingDeclarations = async () => {
  const declarations = await Declaration.find({
    statut: StatutDeclaration.ACTIVE,
    isDeleted: { $ne: true }
  })
    .select('_id updatedAt')
    .sort({ updatedAt: 1 })
    .lean();

  if (declarations.length === 0) {
    return [];
  }

  const declarationIds = declarations.map(
    (declaration) => declaration._id
  );

  const states = await MatchingState.find({
    declarationId: { $in: declarationIds }
  }).lean();

  const stateByDeclarationId = new Map(
    states.map((state) => [
      state.declarationId.toString(),
      state
    ])
  );

  const now = Date.now();

  const pendingDeclarations = declarations.filter((declaration) => {
    const state = stateByDeclarationId.get(
      declaration._id.toString()
    );

    // Aucun état : la déclaration n'a jamais été traitée.
    if (!state) {
      return true;
    }

    // Un autre traitement possède encore le verrou.
    if (
      state.lockUntil &&
      new Date(state.lockUntil).getTime() > now
    ) {
      return false;
    }

    // Éviter de réessayer immédiatement après une erreur.
    if (
      state.status === 'ERREUR' &&
      state.lastAttemptAt &&
      now - new Date(state.lastAttemptAt).getTime() < RETRY_DELAY
    ) {
      return false;
    }

    // La déclaration n'a jamais été traitée avec succès.
    if (!state.processedUpdatedAt) {
      return true;
    }

    // La déclaration a été modifiée depuis le dernier traitement.
    return (
      new Date(declaration.updatedAt).getTime() >
      new Date(state.processedUpdatedAt).getTime()
    );
  });

  // La limite est appliquée après le filtrage.
  return pendingDeclarations.slice(0, BATCH_SIZE);
};

/**
 * Essaie de réserver le traitement d'une déclaration.
 *
 * lastAttemptAt sert également d'identifiant du propriétaire
 * du verrou. Il permet d'empêcher un ancien worker de modifier
 * l'état d'un traitement repris par un autre worker.
 */
const acquireLock = async (declarationId) => {
  const now = new Date();

  const lockUntil = new Date(
    now.getTime() + LOCK_DURATION
  );

  const updateData = {
    $set: {
      status: 'EN_COURS',
      lastAttemptAt: now,
      lockUntil,
      lastError: null
    },
    $inc: {
      attempts: 1
    }
  };

  const lockFilter = {
    declarationId,
    $or: [
      { lockUntil: null },
      { lockUntil: { $exists: false } },
      { lockUntil: { $lte: now } }
    ]
  };

  // Première tentative : réserver un état existant.
  let state = await MatchingState.findOneAndUpdate(
    lockFilter,
    updateData,
    { new: true }
  );

  if (state) {
    return state;
  }

  // Aucun état : créer une nouvelle entrée avec son verrou.
  try {
    state = await MatchingState.create({
      declarationId,
      status: 'EN_COURS',
      lastAttemptAt: now,
      lockUntil,
      attempts: 1
    });

    return state;
  } catch (error) {
    // Un autre worker a éventuellement créé l'entrée entre-temps.
    if (error.code !== 11000) {
      throw error;
    }
  }

  // Deuxième tentative après une éventuelle création concurrente.
  state = await MatchingState.findOneAndUpdate(
    lockFilter,
    updateData,
    { new: true }
  );

  return state;
};

/**
 * Renouvelle le verrou pendant un traitement long.
 *
 * Seul le worker qui possède le lastAttemptAt correspondant
 * peut prolonger ce verrou.
 */
const refreshLock = async (declarationId, lockToken) => {
  const now = new Date();

  const refreshedState = await MatchingState.findOneAndUpdate(
    {
      declarationId,
      lastAttemptAt: lockToken,
      lockUntil: { $gt: now }
    },
    {
      $set: {
        lockUntil: new Date(now.getTime() + LOCK_DURATION)
      }
    },
    { new: true }
  );

  return Boolean(refreshedState);
};

/**
 * Enregistre la réussite du matching.
 *
 * Le worker doit toujours posséder le verrou.
 */
const markAsCompleted = async (
  declarationId,
  processedUpdatedAt,
  lockToken
) => {
  const now = new Date();

  const state = await MatchingState.findOneAndUpdate(
    {
      declarationId,
      lastAttemptAt: lockToken,
      lockUntil: { $gt: now }
    },
    {
      $set: {
        status: 'TERMINE',
        processedUpdatedAt,
        lastProcessedAt: now,
        lockUntil: null,
        lastError: null
      }
    },
    { new: true }
  );

  return Boolean(state);
};

/**
 * Enregistre une erreur et libère le verrou.
 *
 * Un ancien worker ne peut pas modifier l'état
 * d'un traitement appartenant à un autre worker.
 */
const markAsFailed = async (
  declarationId,
  error,
  lockToken
) => {
  const now = new Date();

  const state = await MatchingState.findOneAndUpdate(
    {
      declarationId,
      lastAttemptAt: lockToken,
      lockUntil: { $gt: now }
    },
    {
      $set: {
        status: 'ERREUR',
        lockUntil: null,
        lastError: String(
          error?.message || error
        ).slice(0, 2000)
      }
    },
    { new: true }
  );

  return Boolean(state);
};

/**
 * Traite une déclaration.
 */
const processDeclaration = async (declarationId) => {
  const lock = await acquireLock(declarationId);

  // Déjà réservée par un autre traitement.
  if (!lock) {
    return;
  }

  // Jeton permettant d'identifier le propriétaire du verrou.
  const lockToken = lock.lastAttemptAt;

  let lockLost = false;
  let heartbeatRunning = false;

  /**
   * Renouvellement périodique du verrou.
   */
  const heartbeat = setInterval(async () => {
    if (heartbeatRunning || lockLost) {
      return;
    }

    heartbeatRunning = true;

    try {
      const refreshed = await refreshLock(
        declarationId,
        lockToken
      );

      if (!refreshed) {
        lockLost = true;

        console.warn(
          `[Matching Worker] Verrou perdu pour ${declarationId}`
        );
      }
    } catch (error) {
      console.error(
        `[Matching Worker] Erreur de renouvellement du verrou pour ${declarationId}:`,
        error.message
      );
    } finally {
      heartbeatRunning = false;
    }
  }, HEARTBEAT_INTERVAL);

  try {
    // Recharger la déclaration pour obtenir ses dernières données.
    const declaration = await Declaration.findOne({
      _id: declarationId,
      statut: StatutDeclaration.ACTIVE,
      isDeleted: { $ne: true }
    }).select('_id updatedAt');

    // Elle a pu être supprimée ou désactivée entre-temps.
    if (!declaration) {
      await markAsCompleted(
        declarationId,
        new Date(),
        lockToken
      );

      return;
    }

    console.log(
      `[Matching Worker] Traitement de ${declarationId}`
    );

    await runMatchingForDeclaration(declarationId);

    const completed = await markAsCompleted(
      declarationId,
      declaration.updatedAt,
      lockToken
    );

    if (!completed) {
      console.warn(
        `[Matching Worker] Résultat non enregistré : verrou perdu pour ${declarationId}`
      );

      return;
    }

    console.log(
      `[Matching Worker] Traitement terminé : ${declarationId}`
    );
  } catch (error) {
    console.error(
      `[Matching Worker] Erreur pour ${declarationId}:`,
      error.message
    );

    const failed = await markAsFailed(
      declarationId,
      error,
      lockToken
    );

    if (!failed) {
      console.warn(
        `[Matching Worker] Impossible de modifier l'état : verrou perdu pour ${declarationId}`
      );
    }
  } finally {
    clearInterval(heartbeat);

    // Attendre la fin d'un éventuel renouvellement déjà lancé.
    while (heartbeatRunning) {
      await sleep(100);
    }
  }
};

/**
 * Exécute un cycle de matching.
 */
const runWorkerCycle = async () => {
  const declarations = await getPendingDeclarations();

  if (declarations.length === 0) {
    console.log(
      '[Matching Worker] Aucune déclaration à traiter.'
    );

    return;
  }

  console.log(
    `[Matching Worker] ${declarations.length} déclaration(s) à traiter.`
  );

  for (const declaration of declarations) {
    if (isStopping) {
      break;
    }

    await processDeclaration(declaration._id);
  }
};

/**
 * Démarre le worker.
 */
const startWorker = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('La variable MONGO_URI est absente.');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    dbName: 'main'
  });

  console.log('[Matching Worker] MongoDB connecté.');

  console.log(
    `[Matching Worker] Intervalle : ${POLLING_INTERVAL} ms`
  );

  while (!isStopping) {
    try {
      await runWorkerCycle();
    } catch (error) {
      console.error(
        '[Matching Worker] Erreur du cycle :',
        error
      );
    }

    if (!isStopping) {
      await sleep(POLLING_INTERVAL);
    }
  }

  await mongoose.disconnect();

  console.log('[Matching Worker] Arrêt terminé.');
};

// Arrêt propre
process.on('SIGINT', () => {
  console.log('\n[Matching Worker] Arrêt demandé...');
  isStopping = true;
});

process.on('SIGTERM', () => {
  console.log('\n[Matching Worker] Arrêt demandé...');
  isStopping = true;
});

// Démarrage
startWorker().catch(async (error) => {
  console.error(
    '[Matching Worker] Impossible de démarrer :',
    error
  );

  await mongoose.disconnect();

  process.exitCode = 1;
});
