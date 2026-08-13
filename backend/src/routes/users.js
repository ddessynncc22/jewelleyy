const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendSuccess, sendError } = require('../utils/response');
const { User, ActivityLog } = require('../models');
const { getPagination } = require('../utils/helpers');
const { escapeRegex } = require('../utils/helpers');

// Explicit allowlist — req.body is never spread into User.create/update, so a
// caller can neither plant a tenantId (cross-tenant write) nor elevate a role
// to superadmin via mass assignment.
const CREATABLE_FIELDS = ['name', 'email', 'password', 'role', 'phone', 'isActive'];
const UPDATABLE_FIELDS = ['name', 'email', 'role', 'phone', 'isActive'];
const VALID_ROLES = ['admin', 'manager', 'staff', 'qr_lookup'];

function pickUserFields(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

router.get('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.search) {
      const searchRegex = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [users, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    sendSuccess(res, { users, total, page, limit, totalPages: Math.ceil(total / limit) }, 'Users retrieved');
  } catch (error) {
    next(error);
  }
});

router.get('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }
    sendSuccess(res, { user }, 'User retrieved');
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['admin', 'manager', 'staff', 'qr_lookup']).withMessage('Invalid role'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        return sendError(res, 'User with this email already exists', 400);
      }

      const user = await User.create(pickUserFields(req.body, CREATABLE_FIELDS));

      await ActivityLog.create({
        action: 'CREATE',
        module: 'User',
        description: `User ${user.name} (${user.email}) created`,
        performedBy: req.user._id,
        referenceId: user._id,
        referenceModel: 'User',
        ipAddress: req.ip,
      });

      sendSuccess(res, {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isActive: user.isActive,
        },
      }, 'User created', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    if (req.body.password) {
      return sendError(res, 'Password cannot be updated here. Use the change-password endpoint.', 400);
    }

    const updateData = pickUserFields(req.body, UPDATABLE_FIELDS);
    if (updateData.role !== undefined && !VALID_ROLES.includes(updateData.role)) {
      return sendError(res, 'Invalid role', 400);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    await ActivityLog.create({
      action: 'UPDATE',
      module: 'User',
      description: `User ${user.name} updated`,
      performedBy: req.user._id,
      referenceId: user._id,
      referenceModel: 'User',
      ipAddress: req.ip,
    });

    sendSuccess(res, { user }, 'User updated');
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (user._id.toString() === req.user._id.toString()) {
      return sendError(res, 'Cannot delete yourself', 400);
    }

    await user.softDelete();

    await ActivityLog.create({
      action: 'DELETE',
      module: 'User',
      description: `User ${user.name} deleted`,
      performedBy: req.user._id,
      referenceId: user._id,
      referenceModel: 'User',
      ipAddress: req.ip,
    });

    sendSuccess(res, null, 'User deleted');
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/toggle-active', protect, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    user.isActive = !user.isActive;
    await user.save();

    await ActivityLog.create({
      action: 'UPDATE',
      module: 'User',
      description: `User ${user.name} ${user.isActive ? 'activated' : 'deactivated'}`,
      performedBy: req.user._id,
      referenceId: user._id,
      referenceModel: 'User',
      ipAddress: req.ip,
    });

    sendSuccess(res, { user: user.toJSON() }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
