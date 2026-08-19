const User = require('../models/User');
const Tenant = require('../models/Tenant');
const AccessRequest = require('../models/AccessRequest');
const { successResponse, errorResponse } = require('../utils/response');

// Superadmin-only route, but the role string must still be validated: a
// registration approval must never mint a superadmin account.
const VALID_APPROVAL_ROLES = ['admin', 'manager', 'staff'];

exports.register = async (req, res) => {
  try {
    const { name, email, phone, message, requestedRole } = req.body;
    if (!name || !email) {
      return errorResponse(res, 'Name and email are required', 400);
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return errorResponse(res, 'Please provide a valid email', 400);
    }
    const existingUser = await User.findOne({ email: normalizedEmail });
    const existingPending = await AccessRequest.findOne({ email: normalizedEmail, type: 'registration', status: 'pending' });
    // Whether the email exists or a request is already queued, the response is
    // the same generic success — otherwise this endpoint is an oracle for
    // which emails have accounts.
    if (!existingUser && !existingPending) {
      await AccessRequest.create({
        type: 'registration',
        name: String(name).trim(),
        email: normalizedEmail,
        phone: phone || '',
        message: message || '',
        requestedRole: requestedRole || 'staff',
      });
    }
    return successResponse(res, null, 'Registration request submitted. The administrator will review and activate your account.');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return errorResponse(res, 'Email is required', 400);
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return errorResponse(res, 'Please provide a valid email', 400);
    }
    const user = await User.findOne({ email: normalizedEmail });
    const existingPending = await AccessRequest.findOne({ email: normalizedEmail, type: 'password_reset', status: 'pending' });
    if (user && !existingPending) {
      await AccessRequest.create({
        type: 'password_reset',
        name: name || user.name,
        email: normalizedEmail,
        phone: user.phone || '',
        requestedBy: user._id,
        tenantId: user.tenantId,
      });
    }
    // Same response whether the email exists or not, so this endpoint cannot
    // be used to enumerate accounts.
    return successResponse(res, null, 'If an account exists for this email, a password reset request has been submitted.');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.listRequests = async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    const requests = await AccessRequest.find(filter).sort({ createdAt: -1 }).limit(100);
    return successResponse(res, requests);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getRequest = async (req, res) => {
  try {
    const request = await AccessRequest.findById(req.params.id);
    if (!request) return errorResponse(res, 'Request not found', 404);
    return successResponse(res, request);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { password, role, tenantId, note } = req.body;
    const request = await AccessRequest.findById(req.params.id);
    if (!request) return errorResponse(res, 'Request not found', 404);
    if (request.status !== 'pending') {
      return errorResponse(res, 'This request has already been processed', 400);
    }
    if (!password || String(password).length < 6) {
      return errorResponse(res, 'An initial password of at least 6 characters is required', 400);
    }

    if (request.type === 'registration') {
      const tenant = tenantId ? await Tenant.findOne({ tenantNumber: Number(tenantId) }) : null;
      if (!tenant) return errorResponse(res, 'Please select a valid tenant/shop for the user', 400);
      const safeRole = VALID_APPROVAL_ROLES.includes(role) ? role : 'staff';
      const existing = await User.findOne({ email: request.email });
      if (existing) return errorResponse(res, 'A user with this email already exists', 400);
      await User.create({
        name: request.name,
        email: request.email,
        password: String(password),
        phone: request.phone || '',
        role: safeRole,
        tenantId: tenant.tenantNumber,
      });
    } else if (request.type === 'password_reset') {
      const user = await User.findOne({ email: request.email });
      if (!user) return errorResponse(res, 'No account found for this email', 400);
      user.password = String(password);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
    } else {
      return errorResponse(res, 'Unknown request type', 400);
    }

    request.status = 'approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = note || '';
    await request.save();

    const msg = request.type === 'registration' ? 'Account created and request approved' : 'Password reset and request approved';
    return successResponse(res, request, msg);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { note } = req.body;
    const request = await AccessRequest.findById(req.params.id);
    if (!request) return errorResponse(res, 'Request not found', 404);
    if (request.status !== 'pending') {
      return errorResponse(res, 'This request has already been processed', 400);
    }
    request.status = 'rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = note || '';
    await request.save();
    return successResponse(res, request, 'Request rejected');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
