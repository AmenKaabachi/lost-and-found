// Messages des statistiques (binôme 4, étape 4) en en / fr / ar.
export const statsTranslations = {
  en: {
    overviewFetched: 'Overview statistics retrieved successfully',
    categoriesFetched: 'Category statistics retrieved successfully',
    evolutionFetched: 'Evolution statistics retrieved successfully'
  },
  fr: {
    overviewFetched: "Statistiques générales récupérées avec succès",
    categoriesFetched: 'Statistiques par catégorie récupérées avec succès',
    evolutionFetched: "Évolution des statistiques récupérée avec succès"
  },
  ar: {
    overviewFetched: 'تم جلب الإحصائيات العامة بنجاح',
    categoriesFetched: 'تم جلب الإحصائيات حسب الفئة بنجاح',
    evolutionFetched: 'تم جلب تطور الإحصائيات بنجاح'
  }
};

export const statsMessages = (req) => statsTranslations[req.locale] || statsTranslations.en;
