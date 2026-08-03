function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    errors: null,
  });
}

function sendError(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    errors,
  });
}

function sendPaginated(res, data, total, page, limit, message = 'Success') {
  const totalPages = Math.ceil(total / limit);
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    errors: null,
  });
}

module.exports = { sendSuccess, sendError, sendPaginated, paginatedResponse: sendPaginated, successResponse: sendSuccess, errorResponse: sendError };
