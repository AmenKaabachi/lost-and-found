import { z } from 'zod';

export const supportedLocales = ['en', 'fr', 'ar'];
export const defaultLocale = 'en';

export const translations = {
  en: {
    required: 'This field is required',
    invalidEmail: 'Invalid email address',
    invalidUuid: 'Invalid ID format',
    tooShort: (min) => `Must be at least ${min} characters`,
    tooLong: (max) => `Must not exceed ${max} characters`,
    invalidEnum: (options) => `Invalid value. Options: ${options.join(', ')}`,
    validationError: 'The submitted data is invalid',
    notFound: (resource) => `${resource} not found`,
    unauthorized: 'Unauthorized access',
    forbidden: 'Access forbidden',
    conflict: (field) => `A record with this ${field} already exists`,
    invalidCredentials: 'Invalid credentials',
    emailNotVerified: 'Email not verified',
    accountSuspended: 'Account suspended',
    statusTransitionForbidden: 'Status transition not allowed',
    declarationNotPending: 'Declaration is not pending moderation',
    internalError: 'An internal server error occurred',

    email: {
      // Vérification (code 6 chiffres)
      verificationSubject: 'Verify your email address',
      verificationGreeting: (name) => `Hello ${name},`,
      verificationBody: 'Here is your verification code. It is valid for 10 minutes.',
      verificationFooter: 'If you did not create an account, you can ignore this email.',

      // Reset password
      resetSubject: 'Reset your password',
      resetGreeting: (name) => `Hello ${name},`,
      resetBody: 'Click the button below to reset your password. The link is valid for 10 minutes.',
      resetButton: 'Reset my password',
      resetFooter: 'If you did not request this, ignore this email.',

      // Suspension
      suspendedSubject: 'Your account has been suspended',
      suspendedGreeting: (name) => `Hello ${name},`,
      suspendedBody: 'Your Lost & Found account has been suspended.',
      suspendedReason: (motif) => `Reason: ${motif}`,
      suspendedFooter: 'For more information, contact the Lost & Found office.'
    },

    // (Réservé pour la vérification par lien — non utilisé par email.js actuellement)
    verificationSuccess: 'Email verified successfully',
    verificationInvalid: 'The verification link is invalid or has already been used',
    verificationExpired: 'The verification link has expired'
  },

  fr: {
    required: 'Ce champ est obligatoire',
    invalidEmail: 'Adresse email invalide',
    invalidUuid: 'Format d\'identifiant invalide',
    tooShort: (min) => `Doit contenir au moins ${min} caractères`,
    tooLong: (max) => `Ne doit pas dépasser ${max} caractères`,
    invalidEnum: (options) => `Valeur invalide. Options : ${options.join(', ')}`,
    validationError: 'Les données envoyées sont invalides',
    notFound: (resource) => `${resource} introuvable`,
    unauthorized: 'Accès non autorisé',
    forbidden: 'Accès interdit',
    conflict: (field) => `Un enregistrement avec ce ${field} existe déjà`,
    invalidCredentials: 'Identifiants incorrects',
    emailNotVerified: 'Email non vérifié',
    accountSuspended: 'Compte suspendu',
    statusTransitionForbidden: 'Transition de statut non autorisée',
    declarationNotPending: 'La déclaration n\'est pas en attente de modération',
    internalError: 'Une erreur interne est survenue',

    email: {
      verificationSubject: 'Vérifiez votre adresse email',
      verificationGreeting: (name) => `Bonjour ${name},`,
      verificationBody: 'Voici votre code de vérification. Il est valable 10 minutes.',
      verificationFooter: 'Si vous n\'avez pas créé de compte, ignorez cet email.',

      resetSubject: 'Réinitialisation de votre mot de passe',
      resetGreeting: (name) => `Bonjour ${name},`,
      resetBody: 'Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe. Le lien est valable 10 minutes.',
      resetButton: 'Réinitialiser mon mot de passe',
      resetFooter: 'Si vous n\'avez pas demandé cette réinitialisation, ignorez cet email.',

      suspendedSubject: 'Votre compte a été suspendu',
      suspendedGreeting: (name) => `Bonjour ${name},`,
      suspendedBody: 'Votre compte Lost & Found a été suspendu.',
      suspendedReason: (motif) => `Motif : ${motif}`,
      suspendedFooter: 'Pour plus d\'informations, contactez le bureau d\'objets trouvés.'
    },

    verificationSuccess: 'Email vérifié avec succès',
    verificationInvalid: 'Le lien de vérification est invalide ou a déjà été utilisé',
    verificationExpired: 'Le lien de vérification a expiré'
  },

  ar: {
    required: 'هذا الحقل مطلوب',
    invalidEmail: 'عنوان البريد الإلكتروني غير صالح',
    invalidUuid: 'تنسيق المعرف غير صالح',
    tooShort: (min) => `يجب أن يكون على الأقل ${min} أحرف`,
    tooLong: (max) => `يجب ألا يتجاوز ${max} أحرف`,
    invalidEnum: (options) => `قيمة غير صالحة. الخيارات: ${options.join(', ')}`,
    validationError: 'البيانات المرسلة غير صالحة',
    notFound: (resource) => `${resource} غير موجود`,
    unauthorized: 'وصول غير مصرح به',
    forbidden: 'الوصول ممنوع',
    conflict: (field) => `يوجد سجل بالفعل بهذا ${field}`,
    invalidCredentials: 'بيانات الاعتماد غير صحيحة',
    emailNotVerified: 'البريد الإلكتروني غير مؤكد',
    accountSuspended: 'الحساب موقوف',
    statusTransitionForbidden: 'الانتقال بين الحالات غير مسموح',
    declarationNotPending: 'الإعلان ليس قيد المراجعة',
    internalError: 'حدث خطأ داخلي في الخادم',

    email: {
      verificationSubject: 'تحقق من عنوان بريدك الإلكتروني',
      verificationGreeting: (name) => `مرحباً ${name}،`,
      verificationBody: 'هذا هو رمز التحقق الخاص بك. صالح لمدة 10 دقائق.',
      verificationFooter: 'إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذا البريد.',

      resetSubject: 'إعادة تعيين كلمة المرور',
      resetGreeting: (name) => `مرحباً ${name}،`,
      resetBody: 'انقر على الزر أدناه لإعادة تعيين كلمة المرور. الرابط صالح لمدة 10 دقائق.',
      resetButton: 'إعادة تعيين كلمة المرور',
      resetFooter: 'إذا لم تطلب ذلك، تجاهل هذا البريد.',

      suspendedSubject: 'تم تعليق حسابك',
      suspendedGreeting: (name) => `مرحباً ${name}،`,
      suspendedBody: 'تم تعليق حسابك على منصة المفقودات والموجودات.',
      suspendedReason: (motif) => `السبب: ${motif}`,
      suspendedFooter: 'لمزيد من المعلومات، اتصل بمكتب المفقودات.'
    },

    verificationSuccess: 'تم التحقق من البريد الإلكتروني بنجاح',
    verificationInvalid: 'رابط التحقق غير صالح أو تم استخدامه بالفعل',
    verificationExpired: 'انتهت صلاحية رابط التحقق'
  }
};

/**
 * Alias pour compatibilité avec services/email.js
 * qui importe `messages` au lieu de `translations`
 */
export const messages = translations;

export const buildZodErrorMap = (locale) => {
  const m = translations[locale] || translations[defaultLocale];
  return (issue, ctx) => {
    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        if (issue.received === 'undefined' || issue.received === 'null') return { message: m.required };
        break;
      case z.ZodIssueCode.invalid_string:
        if (issue.validation === 'email') return { message: m.invalidEmail };
        if (issue.validation === 'uuid') return { message: m.invalidUuid };
        break;
      case z.ZodIssueCode.too_small:
        if (issue.type === 'string') return { message: m.tooShort(issue.minimum) };
        break;
      case z.ZodIssueCode.too_big:
        if (issue.type === 'string') return { message: m.tooLong(issue.maximum) };
        break;
      case z.ZodIssueCode.invalid_enum_value:
        return { message: m.invalidEnum(issue.options) };
    }
    return { message: ctx.defaultError };
  };
};