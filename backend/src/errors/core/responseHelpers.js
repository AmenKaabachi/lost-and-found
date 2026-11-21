export const sendSuccess = (res, data, message = 'Operation completed successfully', statusCode = 200, extraFields = {}) => {
  res.status(statusCode).json({
    success: true,
    data,
    message,
    ...extraFields
  });
};