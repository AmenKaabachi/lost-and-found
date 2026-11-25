// Messages des logs et notifications (binôme 4, étape 5) en en / fr / ar.
export const superAdminTranslations = {
  en: {
    logsFetched: 'Audit logs retrieved successfully',
    logsPurged: (n, days) => `${n} log(s) older than ${days} day(s) deleted`,
    notificationsFetched: 'Notifications retrieved successfully',
    notificationsSent: (n) => `Notification sent to ${n} recipient(s)`,
    noRecipients: 'No recipient matches this audience',
    recipientNotFound: 'Recipient not found',
    notificationNotFound: 'Notification not found',
    notificationAlreadyArchived: 'This notification is already archived',
    notificationArchived: 'Notification archived',
    invalidId: 'Invalid ID format'
  },
  fr: {
    logsFetched: "Journal d'audit récupéré avec succès",
    logsPurged: (n, days) => `${n} log(s) de plus de ${days} jour(s) supprimé(s)`,
    notificationsFetched: 'Notifications récupérées avec succès',
    notificationsSent: (n) => `Notification envoyée à ${n} destinataire(s)`,
    noRecipients: 'Aucun destinataire ne correspond à cette audience',
    recipientNotFound: 'Destinataire introuvable',
    notificationNotFound: 'Notification introuvable',
    notificationAlreadyArchived: 'Cette notification est déjà archivée',
    notificationArchived: 'Notification archivée',
    invalidId: "Format d'identifiant invalide"
  },
  ar: {
    logsFetched: 'تم جلب سجل التدقيق بنجاح',
    logsPurged: (n, days) => `تم حذف ${n} سجل(ات) أقدم من ${days} يوم(أيام)`,
    notificationsFetched: 'تم جلب الإشعارات بنجاح',
    notificationsSent: (n) => `تم إرسال الإشعار إلى ${n} مستلم(ين)`,
    noRecipients: 'لا يوجد مستلم يطابق هذه الفئة',
    recipientNotFound: 'المستلم غير موجود',
    notificationNotFound: 'الإشعار غير موجود',
    notificationAlreadyArchived: 'هذا الإشعار مؤرشف مسبقاً',
    notificationArchived: 'تمت أرشفة الإشعار',
    invalidId: 'صيغة المعرف غير صالحة'
  }
};

export const superAdminMessages = (req) => superAdminTranslations[req.locale] || superAdminTranslations.en;
