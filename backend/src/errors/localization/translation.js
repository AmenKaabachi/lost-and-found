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
    user: 'User',

    declaration: 'Declaration',
    savedSearch: 'Saved search',
    savedSearchCreated: 'Saved search created',
    savedSearchesFound: 'Saved searches retrieved',
    savedSearchDeleted: 'Saved search deleted',
    alertEmailDisabled: 'Email notifications are disabled in your profile',
    suggestionsFound: 'Suggestions found',
    noSuggestionsFound: 'No suggestions found',
    filtersRetrieved: 'Search filters retrieved',
    invalidType: 'Invalid value type',
    numberTooBig: (max) => `Must be at most ${max}`,
    numberTooSmall: (min, inclusive = true) => (inclusive ? `Must be at least ${min}` : `Must be greater than ${min}`),
    limitMustBePositiveInteger: 'limit must be a positive integer',
    pageMustBePositiveInteger: 'page must be a positive integer',
    
    emailField: 'email',
    accountNotVerified: 'Email address not verified',
    codeExpired: 'The verification code is invalid or has expired',
    tooManyAttempts: 'Too many incorrect attempts',
    codeInvalid: 'Invalid verification code',
    waitBeforeVerificationCode: (seconds) => `Please wait ${seconds}s before requesting a new code`,
    verificationCodeResent: 'If the account exists, a new verification code has been sent',
    resetLinkSent: 'If the email exists, a reset link has been sent',
    resetTokenInvalid: 'Reset token invalid or expired',

    accountCreated: 'Account created. Check your email for verification code.',
    emailAlreadyVerified: 'Email already verified. You can log in.',
    emailVerified: 'Email verified successfully',
    loggedIn: 'Logged in successfully',
    passwordChanged: 'Password changed successfully',
    loggedOut: 'Logged out successfully',
    passwordReset: 'Password reset successfully',
    profileUpdated: 'Profile updated',
    accountDeleted: 'Account deleted',
    userUpdated: 'User updated',
    userStatusUpdated: 'User status updated',
    userRoleUpdated: 'User role updated',
    adminCreated: 'Admin created',
    userAccountSuspended: 'User account suspended',
    categoryRequired: 'Category is required',
    declarationCreated: (status) => `Declaration created with status ${status}`,
    declarationUpdated: 'Declaration updated',
    declarationStatusUpdated: 'Status updated',
    declarationDeleted: 'Declaration deleted',
    declarationValidated: 'Declaration validated and published',
    declarationRejected: 'Declaration rejected',
    declarationsFound: 'Declarations found',
    noDeclarationsFound: 'No declarations match your search',
    noMapDeclarationsFound: 'No declarations match your map search',
    institutionalEmailRequired: 'Institutional email is required',
    atLeastOneFieldRequired: 'At least one field is required',
    invalidDate: 'Invalid ISO date',
    invalidLatitude: 'Invalid latitude',
    invalidLongitude: 'Invalid longitude',
    invalidRadius: 'Invalid radius',
    invalidCategoryId: 'Invalid category ID',
    dateFinBeforeDateDebut: 'dateFin must be equal to or later than dateDebut',
    latitudeRequiredForDistance: 'lat is required for distance sorting',
    longitudeRequiredForDistance: 'lng is required for distance sorting',
    latitudeRequiredForRadius: 'lat is required for the radius filter',
    longitudeRequiredForRadius: 'lng is required for the radius filter',
    maxLatMustBeGreater: 'maxLat must be greater than minLat',
    maxLngMustBeGreater: 'maxLng must be greater than minLng',
    reasonRequiredForMaskedStatus: 'A reason is required for the MASQUEE status',
    tooManyRequests: 'Too many requests, try again later',
    operationCompleted: 'Operation completed successfully',
    routeNotFound: 'Route not found',
    unsupportedFileFormat: 'Unsupported file format (jpg, png, webp only)',

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
    user: 'Utilisateur',

    declaration: 'Déclaration',
    savedSearch: 'Recherche enregistrée',
    savedSearchCreated: 'Recherche enregistrée créée',
    savedSearchesFound: 'Recherches enregistrées récupérées',
    savedSearchDeleted: 'Recherche enregistrée supprimée',
    alertEmailDisabled: 'Les notifications par email sont désactivées dans votre profil',
    suggestionsFound: 'Suggestions trouvées',
    noSuggestionsFound: 'Aucune suggestion trouvée',
    filtersRetrieved: 'Filtres de recherche récupérés',
    invalidType: 'Type de valeur invalide',
    numberTooBig: (max) => `Doit être inférieur ou égal à ${max}`,
    numberTooSmall: (min, inclusive = true) => (inclusive ? `Doit être supérieur ou égal à ${min}` : `Doit être supérieur à ${min}`),
    limitMustBePositiveInteger: 'limit doit être un entier positif',
    pageMustBePositiveInteger: 'page doit être un entier positif',

    emailField: 'email',
    accountNotVerified: 'Adresse email non vérifiée',
    codeExpired: 'Le code de vérification est invalide ou a expiré',
    tooManyAttempts: 'Trop de tentatives incorrectes',
    codeInvalid: 'Code de vérification invalide',
    waitBeforeVerificationCode: (seconds) => `Veuillez patienter ${seconds}s avant de demander un nouveau code`,
    verificationCodeResent: 'Si le compte existe, un nouveau code de vérification a été envoyé',
    resetLinkSent: 'Si l\'adresse email existe, un lien de réinitialisation a été envoyé',
    resetTokenInvalid: 'Le lien de réinitialisation est invalide ou a expiré',

    accountCreated: 'Compte créé. Consultez votre adresse email pour le code de vérification.',
    emailAlreadyVerified: 'Adresse email déjà vérifiée. Vous pouvez vous connecter.',
    emailVerified: 'Adresse email vérifiée avec succès',
    loggedIn: 'Connexion réussie',
    passwordChanged: 'Mot de passe modifié avec succès',
    loggedOut: 'Déconnexion réussie',
    passwordReset: 'Mot de passe réinitialisé avec succès',
    profileUpdated: 'Profil mis à jour',
    accountDeleted: 'Compte supprimé',
    userUpdated: 'Utilisateur mis à jour',
    userStatusUpdated: 'Statut utilisateur mis à jour',
    userRoleUpdated: 'Rôle utilisateur mis à jour',
    adminCreated: 'Administrateur créé',
    userAccountSuspended: 'Compte utilisateur suspendu',
    categoryRequired: 'La catégorie est requise',
    declarationCreated: (status) => `Déclaration créée avec le statut ${status}`,
    declarationUpdated: 'Déclaration mise à jour',
    declarationStatusUpdated: 'Statut mis à jour',
    declarationDeleted: 'Déclaration supprimée',
    declarationValidated: 'Déclaration validée et publiée',
    declarationRejected: 'Déclaration refusée',
    declarationsFound: 'Déclarations trouvées',
    noDeclarationsFound: 'Aucune déclaration ne correspond à votre recherche',
    noMapDeclarationsFound: 'Aucune déclaration ne correspond à votre recherche sur la carte',
    institutionalEmailRequired: 'Une adresse email institutionnelle est requise',
    atLeastOneFieldRequired: 'Au moins un champ est requis',
    invalidDate: 'Date ISO invalide',
    invalidLatitude: 'Latitude invalide',
    invalidLongitude: 'Longitude invalide',
    invalidRadius: 'Rayon invalide',
    invalidCategoryId: 'Identifiant de catégorie invalide',
    dateFinBeforeDateDebut: 'dateFin doit être postérieure ou égale à dateDebut',
    latitudeRequiredForDistance: 'lat est obligatoire pour le tri par distance',
    longitudeRequiredForDistance: 'lng est obligatoire pour le tri par distance',
    latitudeRequiredForRadius: 'lat est obligatoire pour le filtre radius',
    longitudeRequiredForRadius: 'lng est obligatoire pour le filtre radius',
    maxLatMustBeGreater: 'maxLat doit être supérieur à minLat',
    maxLngMustBeGreater: 'maxLng doit être supérieur à minLng',
    reasonRequiredForMaskedStatus: 'Un motif est obligatoire pour le statut MASQUEE',
    tooManyRequests: 'Trop de requêtes, réessayez plus tard',
    operationCompleted: 'Opération effectuée avec succès',
    routeNotFound: 'Route introuvable',
    unsupportedFileFormat: 'Format de fichier non pris en charge (jpg, png, webp uniquement)',

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
    user: 'المستخدم',

    declaration: 'الإعلان',
    savedSearch: 'البحث المحفوظ',
    savedSearchCreated: 'تم إنشاء البحث المحفوظ',
    savedSearchesFound: 'تم استرجاع عمليات البحث المحفوظة',
    savedSearchDeleted: 'تم حذف البحث المحفوظ',
    alertEmailDisabled: 'إشعارات البريد الإلكتروني معطلة في ملفك الشخصي',
    suggestionsFound: 'تم العثور على اقتراحات',
    noSuggestionsFound: 'لم يتم العثور على اقتراحات',
    filtersRetrieved: 'تم استرجاع عوامل تصفية البحث',
    invalidType: 'نوع القيمة غير صالح',
    numberTooBig: (max) => `يجب ألا يتجاوز ${max}`,
    numberTooSmall: (min, inclusive = true) => (inclusive ? `يجب أن يكون ${min} على الأقل` : `يجب أن يكون أكبر من ${min}`),
    limitMustBePositiveInteger: 'يجب أن يكون limit عددًا صحيحًا موجبًا',
    pageMustBePositiveInteger: 'يجب أن يكون page عددًا صحيحًا موجبًا',

    emailField: 'البريد الإلكتروني',
    accountNotVerified: 'عنوان البريد الإلكتروني غير مؤكد',
    codeExpired: 'رمز التحقق غير صالح أو انتهت صلاحيته',
    tooManyAttempts: 'محاولات غير صحيحة كثيرة جداً',
    codeInvalid: 'رمز التحقق غير صالح',
    waitBeforeVerificationCode: (seconds) => `يرجى الانتظار ${seconds} ثانية قبل طلب رمز جديد`,
    verificationCodeResent: 'إذا كان الحساب موجوداً، فقد تم إرسال رمز تحقق جديد',
    resetLinkSent: 'إذا كان البريد الإلكتروني موجوداً، فقد تم إرسال رابط إعادة تعيين كلمة المرور',
    resetTokenInvalid: 'رمز إعادة التعيين غير صالح أو انتهت صلاحيته',

    accountCreated: 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني للحصول على رمز التحقق.',
    emailAlreadyVerified: 'تم التحقق من البريد الإلكتروني بالفعل. يمكنك تسجيل الدخول.',
    emailVerified: 'تم التحقق من البريد الإلكتروني بنجاح',
    loggedIn: 'تم تسجيل الدخول بنجاح',
    passwordChanged: 'تم تغيير كلمة المرور بنجاح',
    loggedOut: 'تم تسجيل الخروج بنجاح',
    passwordReset: 'تمت إعادة تعيين كلمة المرور بنجاح',
    profileUpdated: 'تم تحديث الملف الشخصي',
    accountDeleted: 'تم حذف الحساب',
    userUpdated: 'تم تحديث المستخدم',
    userStatusUpdated: 'تم تحديث حالة المستخدم',
    userRoleUpdated: 'تم تحديث دور المستخدم',
    adminCreated: 'تم إنشاء المسؤول',
    userAccountSuspended: 'تم تعليق حساب المستخدم',
    categoryRequired: 'الفئة مطلوبة',
    declarationCreated: (status) => `تم إنشاء الإعلان بالحالة ${status}`,
    declarationUpdated: 'تم تحديث الإعلان',
    declarationStatusUpdated: 'تم تحديث الحالة',
    declarationDeleted: 'تم حذف الإعلان',
    declarationValidated: 'تم التحقق من الإعلان ونشره',
    declarationRejected: 'تم رفض الإعلان',
    declarationsFound: 'تم العثور على إعلانات',
    noDeclarationsFound: 'لا توجد إعلانات تطابق بحثك',
    noMapDeclarationsFound: 'لا توجد إعلانات تطابق بحث الخريطة',
    institutionalEmailRequired: 'عنوان البريد الإلكتروني المؤسسي مطلوب',
    atLeastOneFieldRequired: 'مطلوب حقل واحد على الأقل',
    invalidDate: 'تاريخ ISO غير صالح',
    invalidLatitude: 'خط العرض غير صالح',
    invalidLongitude: 'خط الطول غير صالح',
    invalidRadius: 'نصف القطر غير صالح',
    invalidCategoryId: 'معرف الفئة غير صالح',
    dateFinBeforeDateDebut: 'يجب أن يكون dateFin مساوياً لـ dateDebut أو أحدث منه',
    latitudeRequiredForDistance: 'lat مطلوب لفرز المسافة',
    longitudeRequiredForDistance: 'lng مطلوب لفرز المسافة',
    latitudeRequiredForRadius: 'lat مطلوب لفلتر نصف القطر',
    longitudeRequiredForRadius: 'lng مطلوب لفلتر نصف القطر',
    maxLatMustBeGreater: 'يجب أن يكون maxLat أكبر من minLat',
    maxLngMustBeGreater: 'يجب أن يكون maxLng أكبر من minLng',
    reasonRequiredForMaskedStatus: 'المسبب مطلوب للحالة MASQUEE',
    tooManyRequests: 'طلبات كثيرة جداً، حاول لاحقاً',
    operationCompleted: 'تمت العملية بنجاح',
    routeNotFound: 'المسار غير موجود',
    unsupportedFileFormat: 'تنسيق الملف غير مدعوم (jpg وpng وwebp فقط)',

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

export const resolveLocale = (locale) =>
  supportedLocales.includes(locale) ? locale : defaultLocale;

export const translateValidationMessage = (locale, message) => {
  const m = translations[resolveLocale(locale)];
  const customMessages = {
    'Email institutionnel requis': m.institutionalEmailRequired,
    'Au moins un champ requis': m.atLeastOneFieldRequired,
    'Catégorie requise': m.categoryRequired,
    'Date ISO invalide': m.invalidDate,
    'Latitude invalide': m.invalidLatitude,
    'Longitude invalide': m.invalidLongitude,
    'Radius invalide': m.invalidRadius,
    'Identifiant de catégorie invalide': m.invalidCategoryId,
    'Identifiant invalide': m.invalidUuid,
    'limit doit être un entier positif': m.limitMustBePositiveInteger,
    'page doit être un entier positif': m.pageMustBePositiveInteger,
    'dateFin doit être postérieure ou égale à dateDebut': m.dateFinBeforeDateDebut,
    'lat est obligatoire pour le tri par distance': m.latitudeRequiredForDistance,
    'lng est obligatoire pour le tri par distance': m.longitudeRequiredForDistance,
    'lat est obligatoire pour le filtre radius': m.latitudeRequiredForRadius,
    'lng est obligatoire pour le filtre radius': m.longitudeRequiredForRadius,
    'maxLat doit être supérieur à minLat': m.maxLatMustBeGreater,
    'maxLng doit être supérieur à minLng': m.maxLngMustBeGreater,
    'Motif obligatoire pour MASQUEE': m.reasonRequiredForMaskedStatus
  };

  return customMessages[message] || message;
};

export const buildZodErrorMap = (locale) => {
  const m = translations[locale] || translations[defaultLocale];
  return (issue, ctx) => {
    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        if (issue.received === 'undefined' || issue.received === 'null') return { message: m.required };
        return { message: m.invalidType };
      case z.ZodIssueCode.invalid_string:
        if (issue.validation === 'email') return { message: m.invalidEmail };
        if (issue.validation === 'uuid') return { message: m.invalidUuid };
        break;
      case z.ZodIssueCode.too_small:
        if (issue.type === 'string') return { message: m.tooShort(issue.minimum) };
        if (issue.type === 'number') return { message: m.numberTooSmall(issue.minimum, issue.inclusive) };
        break;
      case z.ZodIssueCode.too_big:
        if (issue.type === 'string') return { message: m.tooLong(issue.maximum) };
        if (issue.type === 'number') return { message: m.numberTooBig(issue.maximum) };
        break;
      case z.ZodIssueCode.invalid_enum_value:
        return { message: m.invalidEnum(issue.options) };
    }
    return { message: ctx.defaultError };
  };
};