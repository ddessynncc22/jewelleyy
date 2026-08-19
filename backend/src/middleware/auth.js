const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { errorResponse } = require('../utils/response');
const { runWithTenant } = require('./tenantPlugin');

/**
 * Re-checks the request host against the authenticated user on every request, so
 * a token minted for one shop cannot be replayed against another shop's
 * subdomain. Mirrors checkLoginHost in authController.
 */
const hostMatchesUser = (req, user) => {
  const context = req.hostContext || { type: 'local' };
  if (context.type === 'local') return null;
  if (context.type === 'foreign') return 'This address is not configured for this application';

  if (context.type === 'main') {
    return user.role === 'superadmin' ? null : 'This account must be used on its own shop address';
  }
  if (user.role === 'superadmin') {
    return 'Administrator accounts cannot operate on a shop address';
  }
  if (!user.tenantId || !req.hostTenant || user.tenantId !== req.hostTenant.tenantNumber) {
    return 'This account does not belong to this shop';
  }
  return null;
};

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return errorResponse(res, 'Not authorized, no token provided', 401);
    }
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return errorResponse(res, 'User not found', 401);
    }
    if (!user.isActive) {
      return errorResponse(res, 'Account deactivated', 401);
    }
    if (decoded.tv !== (user.tokenVersion || 0)) {
      return errorResponse(res, 'Session expired, please sign in again', 401);
    }
    const hostError = hostMatchesUser(req, user);
    if (hostError) {
      return errorResponse(res, hostError, 403);
    }
    const roleError = qrLookupDenied(req, user);
    if (roleError) {
      return errorResponse(res, roleError, 403);
    }
    req.user = user;
    req.tenantId = user.tenantId;
    return runWithTenant(user.tenantId, user, () => next());
  } catch (error) {
    return errorResponse(res, 'Not authorized, token invalid', 401);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user.role === 'superadmin') {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Not authorized for this action', 403);
    }
    next();
  };
};

/**
 * qr_lookup accounts are tenant-scoped read-only scanners: they may only reach
 * the QR lookup endpoint plus the bare minimum to sign in and change their own
 * password. This is enforced centrally on every authenticated request, so the
 * role is locked out of inventory, POS, pawn, reports, and user APIs even if a
 * token is forged for them.
 */
const QR_LOOKUP_ALLOWED = [
  { method: 'GET', path: /^\/api\/items\/lookup\// },
  { method: 'GET', path: /^\/api\/settings\/?$/ },
  { method: 'GET', path: /^\/api\/auth\/me$/ },
  { method: 'PUT', path: /^\/api\/auth\/profile$/ },
  { method: 'PUT', path: /^\/api\/auth\/change-password$/ },
  { method: 'POST', path: /^\/api\/auth\/logout$/ },
];

const qrLookupDenied = (req, user) => {
  if (user.role !== 'qr_lookup') return null;
  const allowed = QR_LOOKUP_ALLOWED.some(
    (r) => r.method === req.method && r.path.test(req.originalUrl)
  );
  return allowed ? null : 'Not authorized for this action';
};

module.exports = { protect, authorize };
