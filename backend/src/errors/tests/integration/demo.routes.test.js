import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../../app.js';

describe('demo API', () => {
  it('returns health and declarations', async () => {
    const health = await request(app).get('/api/demo/health');
    const list = await request(app).get('/api/demo/declarations');
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
  });

  it('creates and deletes a declaration', async () => {
    const created = await request(app).post('/api/demo/declarations').send({
      title: 'Green umbrella',
      description: 'A green umbrella found by the campus gate',
      type: 'found',
      category: 'accessories',
    });
    expect(created.status).toBe(201);
    const deleted = await request(app).delete(`/api/demo/declarations/${created.body.data.id}`);
    expect(deleted.status).toBe(200);
  });

  it.each([
    ['en', 'The submitted data is invalid'],
    ['fr', 'Les données envoyées sont invalides'],
    ['ar', 'البيانات المرسلة غير صالحة'],
  ])('translates validation errors in %s', async (locale, message) => {
    const response = await request(app)
      .post('/api/demo/declarations')
      .set('X-Language', locale)
      .send({ description: 'short', type: 'unknown' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe(message);
  });

  it('handles not found, locale priority, and internal errors safely', async () => {
    const missing = await request(app)
      .get('/api/demo/declarations/decl-999')
      .set('Accept-Language', 'fr-FR');
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('Ressource introuvable');

    const priority = await request(app)
      .get('/api/demo/declarations/decl-999')
      .set('X-Language', 'ar-TN')
      .set('Accept-Language', 'fr');
    expect(priority.body.error.message).toBe('المورد غير موجود');

    const internal = await request(app)
      .get('/api/demo/test-error')
      .set('Accept-Language', 'fr');
    expect(internal.status).toBe(500);
    expect(internal.body.error.message).toBe('Une erreur interne inattendue s\'est produite');
    expect(JSON.stringify(internal.body)).not.toContain('Intentional internal');
    expect(JSON.stringify(internal.body)).not.toContain('stack');
  });

  it('keeps locales isolated for concurrent requests', async () => {
    const responses = await Promise.all([
      request(app).get('/api/demo/declarations/decl-999').set('X-Language', 'en'),
      request(app).get('/api/demo/declarations/decl-999').set('X-Language', 'fr'),
      request(app).get('/api/demo/declarations/decl-999').set('X-Language', 'ar'),
    ]);
    expect(responses.map((response) => response.body.error.message)).toEqual([
      'Resource not found',
      'Ressource introuvable',
      'المورد غير موجود',
    ]);
  });
});
