import { translations } from '../localization/translation.js';

export const sendSuccess = (res, data, message, statusCode = 200, extraFields = {}) => {
  const locale = res.req?.locale;
  const m = translations[locale] || translations.en;
  const responseMessage = message || m.operationCompleted;
  res.status(statusCode).json({
    success: true,
    data,
    message: responseMessage,
    ...extraFields
  });
};