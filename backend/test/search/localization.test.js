// 1. Imports
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  supportedLocales,
  translations,
  resolveLocale,
  translateValidationMessage
} from '../../src/errors/localization/translation.js';
import { localeMiddleware } from '../../src/errors/localization/localeMiddleware.js';
import { rateLimitHandler } from '../../src/middlewares/rateLimiter.js';
import { roleMiddleware } from '../../src/middlewares/role.js';
import { notFoundHandler } from '../../src/errors/middleware/notFound.js';
import { errorHandler } from '../../src/errors/core/errorHandler.js';

// 2. Locale Selection Tests
test('Locale middleware uses X-Language and falls back for unsupported languages', () => {
  const resolveHeader = (headers) => {
    let locale;
    const req = { headers };
    localeMiddleware(req, {}, () => { locale = req.locale; });
    return locale;
  };

  assert.equal(resolveHeader({ 'x-language': 'FR' }), 'fr');
  assert.equal(resolveHeader({ 'x-language': 'ar' }), 'ar');
  assert.equal(resolveHeader({ 'x-language': 'de' }), 'en');
  assert.equal(resolveHeader({ 'accept-language': 'fr-FR,fr;q=0.9' }), 'fr');
  assert.equal(resolveHeader({ 'accept-language': 'de-DE,de;q=0.9' }), 'en');
  assert.equal(resolveLocale('fr'), 'fr');
  assert.equal(resolveLocale('ar'), 'ar');
  assert.equal(resolveLocale('unsupported'), 'en');
});

// 3. Translation Completeness Tests
test('English, French and Arabic catalogs contain complete non-empty fields', () => {
  for (const locale of supportedLocales) {
    assert.ok(translations[locale]);
    for (const [field, value] of Object.entries(translations[locale])) {
      if (typeof value === 'object' && value !== null) {
        for (const [nestedField, nestedValue] of Object.entries(value)) {
          if (typeof nestedValue !== 'function') {
            assert.ok(String(nestedValue).trim(), `${locale}.${field}.${nestedField} must not be empty`);
          }
        }
      } else if (typeof value !== 'function') {
        assert.ok(String(value).trim(), `${locale}.${field} must not be empty`);
      }
    }
  }

  const enFields = Object.keys(translations.en).sort();
  const frFields = Object.keys(translations.fr).sort();
  const arFields = Object.keys(translations.ar).sort();
  assert.deepEqual(frFields, enFields);
  assert.deepEqual(arFields, enFields);

  const enEmailFields = Object.keys(translations.en.email).sort();
  assert.deepEqual(Object.keys(translations.fr.email).sort(), enEmailFields);
  assert.deepEqual(Object.keys(translations.ar.email).sort(), enEmailFields);
});

// 4. Validation Translation Tests
test('Custom validation messages are translated consistently', () => {
  assert.equal(
    translateValidationMessage('fr', 'Latitude invalide'),
    'Latitude invalide'
  );
  assert.equal(
    translateValidationMessage('ar', 'Latitude invalide'),
    'خط العرض غير صالح'
  );
  assert.equal(
    translateValidationMessage('xx', 'Latitude invalide'),
    'Invalid latitude'
  );
  assert.equal(
    translateValidationMessage('fr', 'Motif obligatoire pour MASQUEE'),
    'Un motif est obligatoire pour le statut MASQUEE'
  );
  assert.equal(
    translateValidationMessage('ar', 'Motif obligatoire pour MASQUEE'),
    'المسبب مطلوب للحالة MASQUEE'
  );
});

// 5. Middleware and Email Localization Tests
test('Authorization, not-found, rate-limit and fallback errors are localized', () => {
  for (const [locale, expectedForbidden, expectedNotFound, expectedRateLimit] of [
    ['en', 'Access forbidden', 'Route not found', 'Too many requests, try again later'],
    ['fr', 'Accès interdit', 'Route introuvable', 'Trop de requêtes, réessayez plus tard'],
    ['ar', 'الوصول ممنوع', 'المسار غير موجود', 'طلبات كثيرة جداً، حاول لاحقاً']
  ]) {
    let authorizationError;
    try {
      roleMiddleware(['MEMBRE'])({ locale, user: { role: 'ADMIN' } }, {}, () => {});
    } catch (error) {
      authorizationError = error;
    }
    assert.equal(authorizationError.message, expectedForbidden);

    let notFoundError;
    notFoundHandler({ locale }, {}, (error) => { notFoundError = error; });
    assert.equal(notFoundError.message, expectedNotFound);

    let statusCode;
    let body;
    const res = {
      status(code) { statusCode = code; return this; },
      json(value) { body = value; return this; }
    };
    rateLimitHandler({ locale }, res);
    assert.equal(statusCode, 429);
    assert.equal(body.error.message, expectedRateLimit);
  }

  const res = {
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
  errorHandler(new Error('unexpected'), { locale: 'xx' }, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.message, 'An internal server error occurred');
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
});

test('Email localization supports English, French and Arabic RTL content', async () => {
  process.env.RESEND_API_KEY = 're_test_localization';
  const [{ resend }, { sendVerificationCodeEmail }] = await Promise.all([
    import('../../src/services/resend.js'),
    import('../../src/services/email.js')
  ]);
  const originalSend = resend.emails.send;
  let sent;
  resend.emails.send = async (payload) => {
    sent = payload;
    return { data: { id: 'test-id' }, error: null };
  };

  try {
    await sendVerificationCodeEmail({
      to: 'test@example.com',
      name: 'Test',
      code: '123456',
      locale: 'fr'
    });
    assert.equal(sent.subject, 'Vérifiez votre adresse email');
    assert.match(sent.html, /lang="fr"/);
    assert.match(sent.html, /dir="ltr"/);

    await sendVerificationCodeEmail({
      to: 'test@example.com',
      name: 'Test',
      code: '123456',
      locale: 'ar'
    });
    assert.equal(sent.subject, 'تحقق من عنوان بريدك الإلكتروني');
    assert.match(sent.html, /lang="ar"/);
    assert.match(sent.html, /dir="rtl"/);

    await sendVerificationCodeEmail({
      to: 'test@example.com',
      name: 'Test',
      code: '123456',
      locale: 'xx'
    });
    assert.equal(sent.subject, 'Verify your email address');
    assert.match(sent.html, /lang="en"/);
  } finally {
    resend.emails.send = originalSend;
  }
});
