const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const config = require('../config');
const Tenant = require('../models/Tenant');
const { successResponse, errorResponse } = require('../utils/response');
const { shopUrlFor } = require('../middleware/host');

const generateToken = (id, tenantId) => {
  return jwt.sign({ id, tenantId }, config.jwtSecret, { expiresIn: config.jwtExpire });
};

/**
 * Enforces that the sign-in host matches the account.
 *
 * - superadmin may only sign in on the main host (jewellery.example.com)
 * - shop users may only sign in on their own shop host (<slug>.example.com)
 * - 'local' hosts (localhost / raw IP / no APP_BASE_DOMAIN) skip the check so
 *   dev and single-domain deployments keep working unchanged
 *
 * Returns null when allowed, or { message, data } describing the rejection.
 */
async function checkLoginHost(req, user) {
  const context = req.hostContext || { type: 'local' };
  if (context.type === 'local') return null;

  if (context.type === 'foreign') {
    return { message: 'This address is not configured for sign-in', data: null };
  }

  const isSuperadmin = user.role === 'superadmin';

  if (context.type === 'main') {
    if (isSuperadmin) return null;
    const tenant = user.tenantId
      ? await Tenant.findOne({ tenantNumber: user.tenantId }).select('slug name').lean()
      : null;
    const shopUrl = tenant ? shopUrlFor(tenant.slug, req) : null;
    return {
      message: shopUrl
        ? `Please sign in at your shop's address: ${shopUrl}`
        : 'This account is not permitted to sign in here',
      data: shopUrl ? { redirectTo: shopUrl, shopName: tenant.name } : null,
    };
  }

  // context.type === 'tenant' — req.hostTenant is guaranteed by resolveHost
  if (isSuperadmin) {
    return { message: 'Administrator accounts sign in at the main portal, not a shop address', data: null };
  }
  if (!user.tenantId || !req.hostTenant || user.tenantId !== req.hostTenant.tenantNumber) {
    return { message: 'This account does not belong to this shop', data: null };
  }
  return null;
}

const logLogin = async (action, description, user, req, metadata = {}) => {
  try {
    await ActivityLog.create({
      action,
      module: 'auth',
      description,
      performedBy: user?._id || null,
      tenantId: user?.tenantId ?? null,
      metadata: { email: user?.email || req.body?.email || '', ...metadata },
      ipAddress: req.ip,
    });
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      await logLogin('login-failed', 'Login failed - no account found for email', null, req, { reason: 'user-not-found' });
      return errorResponse(res, 'Invalid credentials', 401);
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await logLogin('login-failed', 'Login failed - incorrect password', user, req, { reason: 'invalid-password' });
      return errorResponse(res, 'Invalid credentials', 401);
    }
    if (!user.isActive) {
      await logLogin('login-failed', 'Login failed - account is deactivated', user, req, { reason: 'account-deactivated' });
      return errorResponse(res, 'Account is deactivated', 401);
    }
    const hostRejection = await checkLoginHost(req, user);
    if (hostRejection) {
      await logLogin('login-failed', `Login failed - wrong host (${req.hostContext?.hostname || 'unknown'})`, user, req, { reason: 'host-mismatch' });
      return res.status(403).json({
        success: false,
        message: hostRejection.message,
        data: hostRejection.data,
        errors: null,
      });
    }
    const token = generateToken(user._id, user.tenantId);
    await logLogin('login', 'User logged in successfully', user, req);
    return successResponse(res, { user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, tenantId: user.tenantId }, token }, 'Login successful');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.logout = async (req, res) => {
  try {
    await logLogin('logout', 'User logged out', req.user, req);
    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    return successResponse(res, user);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    return successResponse(res, user, 'Profile updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Current password and new password are required', 400);
    }
    if (newPassword.length < 6) {
      return errorResponse(res, 'New password must be at least 6 characters', 400);
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 401);
    }
    user.password = newPassword;
    await user.save();
    return successResponse(res, null, 'Password changed successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
