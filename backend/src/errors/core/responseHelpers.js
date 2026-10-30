export function successResponse(response, data, statusCode = 200, message) {
  return response.status(statusCode).json({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

