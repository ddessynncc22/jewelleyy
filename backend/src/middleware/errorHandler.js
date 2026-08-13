const config = require('../config');

const logSystemError = async (req, statusCode, message) => {
  try {
    const ActivityLog = require('../models/ActivityLog');
    await ActivityLog.create({
      action: 'error',
      module: 'system',
      description: `${statusCode} ${req.method} ${req.originalUrl} - ${message}`.slice(0, 500),
      performedBy: req.user?._id || null,
      tenantId: req.tenantId ?? null,
      metadata: { method: req.method, url: req.originalUrl, statusCode, message },
      ipAddress: req.ip,
    });
  } catch (err) {
    console.error('Failed to log system error:', err.message);
  }
};

const errorHandler = async (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((val) => val.message);
    message = 'Validation Error';
    errors = messages;
  }

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for ${field}. This ${field} already exists.`;
    errors = [{ field, message: `${field} already exists` }];
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large. Maximum size is 5MB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files. Maximum is 5 files.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field.';
    } else {
      message = err.message;
    }
  }

  if (statusCode >= 500) {
    await logSystemError(req, statusCode, message);
    // Full detail goes to the server log only; clients get a generic message.
    if (config.nodeEnv === 'production') {
      console.error(`[internal-error] ${req.method} ${req.originalUrl} -> ${message}`);
      message = 'Internal server error. Please try again or contact support.';
      errors = null;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
