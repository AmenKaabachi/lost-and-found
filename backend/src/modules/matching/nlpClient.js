
const NLP_SERVICE_URL =
  process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * Vérifie que le service Python est disponible.
 */
export async function checkNlpHealth() {
  try {
    const response = await fetch(`${NLP_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Service NLP indisponible : HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'ok' || data.model_loaded !== true) {
      throw new Error('Le modèle NLP n’est pas chargé.');
    }

    return data;
  } catch (error) {
    throw new Error(`Impossible de contacter le service NLP : ${error.message}`);
  }
}

/**
 * Calcule la similarité sémantique entre deux descriptions.
 */
export async function getSemanticSimilarity(
  descriptionLost,
  descriptionFound
) {
  if (
    typeof descriptionLost !== 'string' ||
    !descriptionLost.trim()
  ) {
    throw new Error('La description de l’objet perdu est obligatoire.');
  }

  if (
    typeof descriptionFound !== 'string' ||
    !descriptionFound.trim()
  ) {
    throw new Error('La description de l’objet trouvé est obligatoire.');
  }

  try {
    const response = await fetch(`${NLP_SERVICE_URL}/similarity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description_lost: descriptionLost.trim(),
        description_found: descriptionFound.trim()
      }),
      signal: AbortSignal.timeout(30000)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || `Erreur HTTP ${response.status}`
      );
    }

    if (
      typeof data.similarity !== 'number' ||
      typeof data.percentage !== 'number'
    ) {
      throw new Error('Réponse invalide du service NLP.');
    }

    return {
      similarity: data.similarity,
      percentage: data.percentage,
      model: data.model
    };
  } catch (error) {
    throw new Error(
      `Erreur lors de la comparaison NLP : ${error.message}`
    );
  }
}
