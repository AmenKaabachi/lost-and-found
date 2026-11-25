// Messages de la modération des déclarations (binôme 4, étape 3) en en / fr / ar.
export const moderationTranslations = {
  en: {
    flaggedFetched: 'Flagged declarations retrieved successfully',
    duplicatesFetched: 'Possible duplicates retrieved successfully',
    bulkDone: (n) => `Action applied to ${n} declaration(s)`,
    defaultHideReason: 'Hidden by an administrator (bulk action)'
  },
  fr: {
    flaggedFetched: 'Déclarations signalées récupérées avec succès',
    duplicatesFetched: 'Doublons possibles récupérés avec succès',
    bulkDone: (n) => `Action appliquée à ${n} déclaration(s)`,
    defaultHideReason: 'Masquée par un administrateur (action groupée)'
  },
  ar: {
    flaggedFetched: 'تم جلب التصريحات المبلغ عنها بنجاح',
    duplicatesFetched: 'تم جلب التصريحات المكررة المحتملة بنجاح',
    bulkDone: (n) => `تم تطبيق الإجراء على ${n} تصريح(ات)`,
    defaultHideReason: 'تم الإخفاء من طرف مشرف (إجراء جماعي)'
  }
};

export const moderationMessages = (req) => moderationTranslations[req.locale] || moderationTranslations.en;
