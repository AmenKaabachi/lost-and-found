export const sendSuccess = (res, data, message = 'Operation completed successfully', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    message
  });
};