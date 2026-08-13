function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    errors: null,
  });
}

const config = require('../config');

function sendError(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
  // Server-side failures must not leak internals (query text, error stacks,
  // connection strings) to the client in production. The real message is
  // written to the server log; the client gets a generic line. 4xx errors are
  // deliberate, actionable messages and are passed through unchanged.
  if (statusCode >= 500 && config.nodeEnv === 'production' && message) {
    console.error(`[internal-error] ${message}`);
    message = 'Internal server error. Please try again or contact support.';
    errors = null;
  }
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
