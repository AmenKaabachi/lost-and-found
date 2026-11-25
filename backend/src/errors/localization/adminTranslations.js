// Messages du module Administration (binôme 4) en en / fr / ar.
// Fichier séparé de translation.js pour éviter les conflits git avec les autres binômes.
export const adminTranslations = {
  en: {
    // Système
    healthOk: 'All systems operational',
    healthDegraded: 'Some services are not working properly',
    // Signalements
    invalidId: 'Invalid ID format',
    reportNotFound: 'Report not found',
    declarationNotFound: 'Declaration not found',
    cannotReportOwnDeclaration: 'You cannot report your own declaration',
    alreadyReported: 'You have already reported this declaration',
    reportAlreadyClosed: 'This report has already been processed',
    reportCreated: 'Report submitted successfully',
    reportsFetched: 'Reports retrieved successfully',
    reportFetched: 'Report retrieved successfully',
    reportUpdated: 'Report updated successfully',
    reportDismissed: 'Report dismissed',
    notifReportTreatedTitle: 'Your report has been processed',
    notifReportTreatedBody: 'Thank you, an administrator has processed your report.',
    notifReportDismissedTitle: 'Your report was dismissed',
    notifReportDismissedBody: 'An administrator reviewed your report and found no problem.'
  },
  fr: {
    healthOk: 'Tous les services fonctionnent',
    healthDegraded: 'Certains services ne fonctionnent pas correctement',
    invalidId: "Format d'identifiant invalide",
    reportNotFound: 'Signalement introuvable',
    declarationNotFound: 'Déclaration introuvable',
    cannotReportOwnDeclaration: 'Vous ne pouvez pas signaler votre propre déclaration',
    alreadyReported: 'Vous avez déjà signalé cette déclaration',
    reportAlreadyClosed: 'Ce signalement a déjà été traité',
    reportCreated: 'Signalement envoyé avec succès',
    reportsFetched: 'Signalements récupérés avec succès',
    reportFetched: 'Signalement récupéré avec succès',
    reportUpdated: 'Signalement mis à jour avec succès',
    reportDismissed: 'Signalement rejeté',
    notifReportTreatedTitle: 'Votre signalement a été traité',
    notifReportTreatedBody: 'Merci, un administrateur a traité votre signalement.',
    notifReportDismissedTitle: 'Votre signalement a été rejeté',
    notifReportDismissedBody: "Un administrateur a examiné votre signalement et n'a pas trouvé de problème."
  },
  ar: {
    healthOk: 'جميع الخدمات تعمل بشكل طبيعي',
    healthDegraded: 'بعض الخدمات لا تعمل بشكل صحيح',
    invalidId: 'صيغة المعرف غير صالحة',
    reportNotFound: 'البلاغ غير موجود',
    declarationNotFound: 'التصريح غير موجود',
    cannotReportOwnDeclaration: 'لا يمكنك الإبلاغ عن تصريحك الخاص',
    alreadyReported: 'لقد قمت بالإبلاغ عن هذا التصريح من قبل',
    reportAlreadyClosed: 'تمت معالجة هذا البلاغ مسبقاً',
    reportCreated: 'تم إرسال البلاغ بنجاح',
    reportsFetched: 'تم جلب البلاغات بنجاح',
    reportFetched: 'تم جلب البلاغ بنجاح',
    reportUpdated: 'تم تحديث البلاغ بنجاح',
    reportDismissed: 'تم رفض البلاغ',
    notifReportTreatedTitle: 'تمت معالجة بلاغك',
    notifReportTreatedBody: 'شكراً، قام أحد المشرفين بمعالجة بلاغك.',
    notifReportDismissedTitle: 'تم رفض بلاغك',
    notifReportDismissedBody: 'قام أحد المشرفين بمراجعة بلاغك ولم يجد أي مشكلة.'
  }
};

// Renvoie les messages dans la langue de la requête (anglais par défaut).
export const adminMessages = (req) => adminTranslations[req.locale] || adminTranslations.en;
