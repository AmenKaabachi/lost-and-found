import fs from 'fs';
import path from 'path';
import logger from '../errors/logging/logger.js';

const SYSTEM_PROMPT = `Tu es un système d'analyse et de modération automatique de contenu pour une plateforme universitaire d'objets perdus et trouvés ("LOST & FOUND") dans un campus en Tunisie.
Ta mission est d'analyser le contenu d'une déclaration (titre, description, lieu, détails d'objet) ainsi que les éventuelles photos jointes, afin d'identifier tout contenu inapproprié ou frauduleux.

IMPORTANT — LANGUES ET DIALECTES :
Les utilisateurs sont des étudiants tunisiens. Ils peuvent écrire en :
- Français
- Arabe standard (فصحى)
- Dialecte tunisien (Derja / تونسي) écrit en caractères arabes OU en caractères latins (arabizi / franco-arabe), par exemple : "na7ki", "y5i", "3abd"
- Un mélange de ces langues dans le même texte (code-switching)

Tu DOIS détecter les insultes, vulgarités et propos inappropriés dans TOUTES ces langues et variantes, y compris :
- Gros mots et insultes en dialecte tunisien (Derja) : exemples incluant mais sans s'y limiter des mots comme "zabbi", "nayek", "9a7ba", "manyak", "kess ommek/ommok", "barra nik", "zebi", "ta7an", "kahba", "weld el 9a7ba", "ya 7mar", "ya bagra", "tfou 3lik", "nik ommek", "ya kelb", etc., qu'ils soient écrits en caractères arabes (زبي، نايك، قحبة، كس أمك، etc.) ou en arabizi/franco-arabe.
- Insultes en arabe standard : كلب، حمار، ابن الحرام، etc.
- Gros mots en français : merde, connard, putain, nique, enculé, etc.
- Toute variante orthographique intentionnelle visant à contourner la modération (lettres remplacées par des chiffres, espaces insérés, etc.)

Critères de modération TEXTE :
- Présence de gros mots, vulgarités, insultes, jurons, propos obscènes ou agressifs dans n'importe quelle langue ou dialecte (français, arabe, derja tunisien, arabizi).
- Propos haineux, racistes, sexistes, homophobes, diffamatoires ou discriminatoires.
- Menaces, incitation à la violence, harcèlement.
- Contenu sexuellement explicite ou allusions perverses.
- Vente d'armes, de stupéfiants ou de substances illicites.
- Arnaques, escroqueries, tentatives de phishing, spam publicitaire.
Remarque : Les descriptions légitimes d'objets usuels égarés ou retrouvés sur un campus (portefeuilles, clés, sacs, téléphones avec écran rayé ou fissuré, vêtements, documents d'identité trouvés, cartes étudiantes, etc.) sont tout à fait conformes. Ne pas pénaliser un ton naturel ou informel dès lors qu'il n'est ni injurieux ni malveillant. Des expressions familières tunisiennes inoffensives comme "ya 5ouya" (mon frère), "barcha" (beaucoup), "chnoua" (quoi), "win" (où), "mahlebi" etc. sont parfaitement acceptables.

Critères de modération IMAGE :
- Nudité, pornographie, tenues ou poses suggestives.
- Violence, sang, mutilations, armes, drogues illicites.
- Gestes offensants, insultants ou symboles haineux.
- Images choquantes, grotesques, ou sans aucun rapport avec un objet perdu/trouvé dans une intention malveillante.
Remarque : Les photos réelles d'objets perdus ou trouvés (clés, téléphones, sacs, ordinateurs, écouteurs, vêtements, portefeuilles, cartes, etc.) sont conformes.

FORMAT DE RÉPONSE OBLIGATOIRE (JSON STRICT UNIQUEMENT) :
{
  "conforme": true | false,
  "source": "TEXTE" | "IMAGE" | null,
  "motif": string | null
}

Règles de décision pour la réponse :
- Si tout est conforme : { "conforme": true, "source": null, "motif": null }
- Si le texte contient des propos inappropriés ou grossiers : { "conforme": false, "source": "TEXTE", "motif": "<Explication claire et concise en français de la raison du signalement>" }
- Si une image est inappropriée : { "conforme": false, "source": "IMAGE", "motif": "<Explication claire et concise en français de la raison du signalement de l'image>" }
- Si le texte ET une image sont inappropriés : { "conforme": false, "source": "TEXTE", "motif": "<Explication concise résumant le problème textuel et visuel>" }
`;

function getMimeType(filePath, explicitMimeType) {
  if (explicitMimeType && typeof explicitMimeType === 'string' && explicitMimeType.startsWith('image/')) {
    return explicitMimeType;
  }
  if (!filePath) return 'image/jpeg';
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
    default:
      return 'image/jpeg';
  }
}

function resolveFilePath(filePath) {
  if (!filePath) return null;
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    return filePath;
  }
  const relativeFromCwd = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(relativeFromCwd)) {
    return relativeFromCwd;
  }
  return null;
}

/**
 * Modère le texte et les photos d'une déclaration via l'API Gemini de Google.
 * 
 * @param {Object} options
 * @param {Object} options.textFields - Champs texte (titre, description, lieuNom, zoneCampus, categorie, couleur, marque)
 * @param {Array} [options.imageFiles] - Fichiers images (objets multer avec path/mimetype ou chaînes chemins)
 * @param {number} [options.timeoutMs] - Délai max en ms avant timeout (par défaut 10000ms)
 * @returns {Promise<{ statut: 'ACTIVE' | 'EN_ATTENTE', reason: string | null, source: 'TEXTE' | 'IMAGE' | null }>}
 */
export async function moderateDeclarationContent({ textFields = {}, imageFiles = [], timeoutMs = 10000 }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    logger.warn('GEMINI_API_KEY non définie dans les variables d\'environnement. Mise en attente de la déclaration.');
    return {
      statut: 'EN_ATTENTE',
      reason: 'Service de modération IA non configuré (mise en attente pour vérification manuelle)',
      source: null
    };
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const configuredTimeout = Number(process.env.GEMINI_TIMEOUT_MS) || timeoutMs;

  // Préparation du texte (sans données de contact personnelles)
  const lines = [];
  if (textFields.titre) lines.push(`Titre : ${textFields.titre}`);
  if (textFields.description) lines.push(`Description : ${textFields.description}`);
  if (textFields.lieuNom) lines.push(`Lieu : ${textFields.lieuNom}`);
  if (textFields.zoneCampus) lines.push(`Zone du campus : ${textFields.zoneCampus}`);
  if (textFields.categorie) lines.push(`Catégorie : ${textFields.categorie}`);
  if (textFields.couleur) lines.push(`Couleur : ${textFields.couleur}`);
  if (textFields.marque) lines.push(`Marque : ${textFields.marque}`);

  const textPayload = lines.length > 0 ? lines.join('\n') : '(Aucun texte fourni)';

  const parts = [
    {
      text: `${SYSTEM_PROMPT}\n\n--- DÉCLARATION À ANALYSER ---\n${textPayload}`
    }
  ];

  let hasImages = false;
  if (Array.isArray(imageFiles) && imageFiles.length > 0) {
    for (const item of imageFiles) {
      const rawPath = typeof item === 'string' ? item : item?.path;
      const explicitMime = typeof item === 'object' ? item?.mimetype : null;
      const resolved = resolveFilePath(rawPath);

      if (resolved) {
        try {
          const buffer = await fs.promises.readFile(resolved);
          const mimeType = getMimeType(resolved, explicitMime);
          parts.push({
            inlineData: {
              mimeType,
              data: buffer.toString('base64')
            }
          });
          hasImages = true;
        } catch (readErr) {
          logger.warn({ err: readErr, path: rawPath }, 'Impossible de lire le fichier image pour la modération');
        }
      }
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), configuredTimeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, body: errorText }, 'Échec de l\'appel à l\'API Gemini');
      return {
        statut: 'EN_ATTENTE',
        reason: 'Service de modération IA temporairement indisponible (mise en attente pour vérification manuelle)',
        source: null
      };
    }

    const data = await response.json();

    // 1. Détection des blocages au niveau du prompt par les filtres de sécurité Google
    if (data?.promptFeedback?.blockReason) {
      logger.warn({ blockReason: data.promptFeedback.blockReason }, 'Prompt bloqué par la sécurité Gemini');
      return {
        statut: 'EN_ATTENTE',
        reason: `Contenu bloqué par les filtres de sécurité IA (${data.promptFeedback.blockReason})`,
        source: hasImages ? 'IMAGE' : 'TEXTE'
      };
    }

    const firstCandidate = data?.candidates?.[0];

    // 2. Détection de blocage au niveau de la génération
    if (firstCandidate?.finishReason === 'SAFETY') {
      logger.warn('Génération arrêtée pour motif de sécurité par Gemini');
      return {
        statut: 'EN_ATTENTE',
        reason: 'Contenu signalé pour non-respect des critères de sécurité IA',
        source: hasImages ? 'IMAGE' : 'TEXTE'
      };
    }

    const outputText = firstCandidate?.content?.parts?.[0]?.text;
    if (!outputText) {
      logger.warn({ data }, 'Réponse Gemini sans texte exploitable');
      return {
        statut: 'EN_ATTENTE',
        reason: 'Réponse de modération vide ou inexploitable',
        source: null
      };
    }

    // Parsing du JSON retourné
    let parsed;
    try {
      const cleaned = outputText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      logger.error({ parseError, outputText }, 'Erreur de décodage JSON de la réponse Gemini');
      return {
        statut: 'EN_ATTENTE',
        reason: 'Erreur d\'interprétation de l\'analyse IA',
        source: null
      };
    }

    if (parsed.conforme === true) {
      return {
        statut: 'ACTIVE',
        reason: null,
        source: null
      };
    }

    const source = parsed.source === 'IMAGE' ? 'IMAGE' : 'TEXTE';
    const reason = parsed.motif || (source === 'IMAGE' ? 'Image inappropriée détectée' : 'Texte inapproprié détecté');

    return {
      statut: 'EN_ATTENTE',
      reason,
      source
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      logger.warn('Délai d\'analyse Gemini dépassé (timeout)');
      return {
        statut: 'EN_ATTENTE',
        reason: 'Délai d\'analyse IA dépassé : déclaration mise en attente pour examen',
        source: null
      };
    }

    logger.error({ err }, 'Exception réseau ou technique lors de l\'appel à Gemini');
    return {
      statut: 'EN_ATTENTE',
      reason: 'Erreur technique lors de la modération IA',
      source: null
    };
  }
}
