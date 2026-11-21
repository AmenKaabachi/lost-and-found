// services/email.js
import { resend } from './resend.js';
import { messages, resolveLocale } from '../errors/localization/translation.js';
import logger from '../errors/logging/logger.js';

const FROM = process.env.RESEND_FROM_EMAIL || 'Lost & Found <onboarding@resend.dev>';

/**
 * Retourne le bloc email traduit pour la locale donnée.
 */
const getEmailMessages = (locale) => {
  const resolvedLocale = resolveLocale(String(locale || '').trim().toLowerCase());
  return messages[resolvedLocale].email;
};

/**
 * Wrapper générique autour de resend.emails.send()
 * - idempotencyKey évite les doublons en cas de retry réseau
 * - Ne lève jamais d'exception : renvoie { success, id?, error? }
 */
const sendWithResend = async ({ to, subject, html, idempotencyKey, tag }) => {
  try {
    const { data, error } = await resend.emails.send(
      {
        from: FROM,
        to,
        subject,
        html
      },
      { idempotencyKey }
    );

    if (error) {
      logger.error({ err: error, to, tag }, `❌ Resend error (${tag})`);
      return { success: false, error };
    }

    logger.info(`📬 Email sent (${tag}) → ${to} | Resend ID: ${data.id}`);
    return { success: true, id: data.id };
  } catch (err) {
    logger.error({ err, to, tag }, `❌ Resend exception (${tag})`);
    return { success: false, error: err };
  }
};

// ──────────────────────────────────────────────────────
//  1. Vérification email (code 6 chiffres)
// ──────────────────────────────────────────────────────
export async function sendVerificationCodeEmail({ to, name, code, locale = 'en' }) {
  const resolvedLocale = resolveLocale(String(locale || '').trim().toLowerCase());
  const m = getEmailMessages(resolvedLocale);
  const direction = resolvedLocale === 'ar' ? 'rtl' : 'ltr';
  const lang = resolvedLocale;

  const html = `
    <div lang="${lang}" dir="${direction}" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="margin-bottom: 8px;">${m.verificationSubject}</h2>
      <p>${m.verificationGreeting(name)}</p>
      <p>${m.verificationBody}</p>
      <p style="text-align: center; margin: 32px 0;">
        <span style="display: inline-block; font-size: 36px; font-weight: 700;
                     letter-spacing: 12px; background: #f4f4f4; padding: 16px 24px;
                     border-radius: 8px; font-family: 'Courier New', monospace;">
          ${code}
        </span>
      </p>
      <p style="font-size: 12px; color: #666;">${m.verificationFooter}</p>
    </div>
  `;

  return sendWithResend({
    to,
    subject: m.verificationSubject,
    html,
    idempotencyKey: `verify-code/${to}/${code}`,
    tag: 'verification'
  });
}

// ──────────────────────────────────────────────────────
//  2. Réinitialisation mot de passe (lien)
// ──────────────────────────────────────────────────────
export async function sendResetPasswordEmail({ to, name, resetUrl, locale = 'en' }) {
  const resolvedLocale = resolveLocale(String(locale || '').trim().toLowerCase());
  const m = getEmailMessages(resolvedLocale);
  const direction = resolvedLocale === 'ar' ? 'rtl' : 'ltr';
  const lang = resolvedLocale;

  const html = `
    <div lang="${lang}" dir="${direction}" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="margin-bottom: 8px;">${m.resetSubject}</h2>
      <p>${m.resetGreeting(name)}</p>
      <p>${m.resetBody}</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}"
           style="display: inline-block; background: #2563eb; color: #fff;
                  text-decoration: none; padding: 14px 32px;
                  border-radius: 8px; font-weight: bold;">
          ${m.resetButton}
        </a>
      </p>
      <p style="font-size: 12px; color: #666; word-break: break-all;">
        ${resetUrl}
      </p>
      <p style="font-size: 12px; color: #666;">${m.resetFooter}</p>
    </div>
  `;

  return sendWithResend({
    to,
    subject: m.resetSubject,
    html,
    idempotencyKey: `reset-password/${to}/${resetUrl.split('token=')[1] ?? Date.now()}`,
    tag: 'reset-password'
  });
}

// ──────────────────────────────────────────────────────
//  3. Notification de suspension
// ──────────────────────────────────────────────────────
export async function sendSuspendedEmail({ to, name, motif, locale = 'en' }) {
  const resolvedLocale = resolveLocale(String(locale || '').trim().toLowerCase());
  const m = getEmailMessages(resolvedLocale);
  const direction = resolvedLocale === 'ar' ? 'rtl' : 'ltr';
  const lang = resolvedLocale;

  const html = `
    <div lang="${lang}" dir="${direction}" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #dc2626; margin-bottom: 8px;">${m.suspendedSubject}</h2>
      <p>${m.suspendedGreeting(name)}</p>
      <p>${m.suspendedBody}</p>
      ${motif ? `<p><strong>${m.suspendedReason(motif)}</strong></p>` : ''}
      <p style="font-size: 12px; color: #666;">${m.suspendedFooter}</p>
    </div>
  `;

  return sendWithResend({
    to,
    subject: m.suspendedSubject,
    html,
    idempotencyKey: `suspended/${to}/${Date.now()}`,
    tag: 'suspended'
  });
}