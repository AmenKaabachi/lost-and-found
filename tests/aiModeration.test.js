import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { aiModeration } from '../backend/src/middlewares/aiModeration.js';
import { moderateDeclarationContent } from '../backend/src/services/geminiModeration.js';

describe('AI Moderation Service and Middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('Gracefully sets EN_ATTENTE if GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;

    const result = await moderateDeclarationContent({
      textFields: {
        titre: 'Sac à dos noir',
        description: 'Perdu près de la cafétéria'
      }
    });

    assert.equal(result.statut, 'EN_ATTENTE');
    assert.match(result.reason, /non configuré/);
    assert.equal(result.source, null);
  });

  test('Middleware sets req.moderationResult and calls next() without throwing', async () => {
    delete process.env.GEMINI_API_KEY;

    const req = {
      body: {
        titre: 'Portefeuille',
        description: 'Trouvé sur un banc'
      },
      files: []
    };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await aiModeration(req, res, next);

    assert.equal(nextCalled, true);
    assert.ok(req.moderationResult);
    assert.equal(req.moderationResult.statut, 'EN_ATTENTE');
  });

  test('Middleware skips moderation when ADMIN modifies an existing declaration', async () => {
    const req = {
      user: {
        _id: 'admin-id-123',
        role: 'ADMIN'
      },
      declaration: {
        _id: 'decl-id-456',
        declarantId: 'member-author-id-789',
        statut: 'EN_ATTENTE'
      },
      body: {
        titre: 'Titre corrigé par admin'
      }
    };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await aiModeration(req, res, next);

    assert.equal(nextCalled, true);
    assert.equal(req.moderationResult, null);
  });

  test('Simulates clean declaration approved by Gemini', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    conforme: true,
                    source: null,
                    motif: null
                  })
                }
              ]
            }
          }
        ]
      })
    });

    try {
      const result = await moderateDeclarationContent({
        textFields: {
          titre: 'Clés de voiture trouvées',
          description: 'Clés avec porte-clé bleu trouvées sur le parking'
        }
      });

      assert.equal(result.statut, 'ACTIVE');
      assert.equal(result.reason, null);
      assert.equal(result.source, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Simulates bad words in declaration text flagged by Gemini', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    conforme: false,
                    source: 'TEXTE',
                    motif: 'Propos injurieux ou vulgaires détectés dans la description.'
                  })
                }
              ]
            }
          }
        ]
      })
    });

    try {
      const req = {
        body: {
          titre: 'Sac avec insulte',
          description: 'Description avec gros mots'
        },
        files: []
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await aiModeration(req, res, next);

      assert.equal(nextCalled, true);
      assert.equal(req.moderationResult.statut, 'EN_ATTENTE');
      assert.equal(req.moderationResult.source, 'TEXTE');
      assert.match(req.moderationResult.reason, /injurieux ou vulgaires/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Sends only text to Gemini (no inlineData), even if req.files is present', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    let sentBody;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      sentBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ conforme: true, source: null, motif: null }) }] } }]
        })
      };
    };

    try {
      const req = {
        body: {
          titre: 'Écouteurs blancs',
          description: 'Trouvés dans l\'amphi A',
          categorie: 'Électronique',
          couleur: 'Blanc',
          marque: 'Apple'
        },
        // Fichiers éventuellement présents : ils doivent être ignorés
        files: [{ path: 'uploads/ancienne_photo.png', mimetype: 'image/png' }]
      };
      await aiModeration(req, {}, () => {});

      const parts = sentBody.contents[0].parts;
      assert.equal(parts.length, 1);
      assert.ok(parts.every(p => !('inlineData' in p)));
      const text = parts[0].text;
      assert.match(text, /Titre : Écouteurs blancs/);
      assert.match(text, /Catégorie : Électronique/);
      assert.match(text, /Couleur : Blanc/);
      assert.match(text, /Marque : Apple/);
      assert.equal(req.moderationResult.statut, 'ACTIVE');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Prompt contains only text moderation rules (no image criteria)', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    let promptText;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      promptText = JSON.parse(options.body).contents[0].parts[0].text;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ conforme: true, source: null, motif: null }) }] } }]
        })
      };
    };

    try {
      await moderateDeclarationContent({ textFields: { titre: 'Carte étudiante', description: 'Trouvée à la bibliothèque' } });
      assert.match(promptText, /Critères de modération TEXTE/);
      assert.match(promptText, /insultes/);
      assert.doesNotMatch(promptText, /IMAGE/);
      assert.doesNotMatch(promptText, /photo/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Never produces source IMAGE: a legacy IMAGE answer from Gemini is attributed to TEXTE', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ conforme: false, source: 'IMAGE', motif: null }) }] } }]
      })
    });

    try {
      const result = await moderateDeclarationContent({
        textFields: { titre: 'Objet quelconque', description: 'Objet trouvé dans le hall' }
      });
      assert.equal(result.statut, 'EN_ATTENTE');
      assert.equal(result.source, 'TEXTE');
      assert.equal(result.reason, 'Texte inapproprié détecté');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Prompt blocked by Gemini safety filters is attributed to TEXTE', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } })
    });

    try {
      const result = await moderateDeclarationContent({
        textFields: { titre: 'Texte bloqué', description: 'Contenu bloqué par Google' }
      });
      assert.equal(result.statut, 'EN_ATTENTE');
      assert.equal(result.source, 'TEXTE');
      assert.match(result.reason, /SAFETY/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Flags Tunisian Derja insults in text (text moderation still works)', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    let promptText;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      promptText = JSON.parse(options.body).contents[0].parts[0].text;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ conforme: false, source: 'TEXTE', motif: 'Insulte en dialecte tunisien détectée.' }) }] } }]
        })
      };
    };

    try {
      const req = { body: { titre: 'Sac perdu ya 7mar', description: 'Sac noir perdu, ya kelb rodhou' } };
      await aiModeration(req, {}, () => {});
      assert.match(promptText, /Derja/);
      assert.match(promptText, /Description : Sac noir perdu, ya kelb rodhou/);
      assert.equal(req.moderationResult.statut, 'EN_ATTENTE');
      assert.equal(req.moderationResult.source, 'TEXTE');
      assert.match(req.moderationResult.reason, /dialecte tunisien/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Handles Gemini safety filter block (finishReason: SAFETY)', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: 'SAFETY'
          }
        ]
      })
    });

    try {
      const result = await moderateDeclarationContent({
        textFields: {
          titre: 'Contenu extrême',
          description: 'Texte violent ou explicite'
        }
      });

      assert.equal(result.statut, 'EN_ATTENTE');
      assert.match(result.reason, /sécurité/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Handles network error or timeout gracefully without rejecting request', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };

    try {
      const req = {
        body: {
          titre: 'Ordinateur portable',
          description: 'Oublié en salle TD 102'
        }
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await aiModeration(req, res, next);

      assert.equal(nextCalled, true);
      assert.equal(req.moderationResult.statut, 'EN_ATTENTE');
      assert.match(req.moderationResult.reason, /délai d'analyse IA dépassé/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
