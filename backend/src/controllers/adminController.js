const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Rate = require('../models/Rate');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');

exports.getDashboardStats = async (req, res) => {
  try {
    const [totalTenants, activeTenants, inactiveTenants] = await Promise.all([
      Tenant.countDocuments({}),
      Tenant.countDocuments({ isActive: true }),
      Tenant.countDocuments({ isActive: { $ne: true } }),
    ]);
    return successResponse(res, { totalTenants, activeTenants, inactiveTenants });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.toggleTenantStatus = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return errorResponse(res, 'Tenant not found', 404);
    tenant.isActive = !tenant.isActive;
    await tenant.save();
    return successResponse(res, tenant, `Tenant ${tenant.isActive ? 'activated' : 'deactivated'}`);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};


exports.getTenantUsers = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return errorResponse(res, 'Tenant not found', 404);
    const users = await User.find({ tenantId: tenant.tenantNumber, role: { $ne: 'superadmin' } }).select('-password').sort({ createdAt: -1 });
    return successResponse(res, users);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createTenantUser = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return errorResponse(res, 'Tenant not found', 404);
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) return errorResponse(res, 'Name, email, and password are required', 400);
    const existing = await User.findOne({ email });
    if (existing) return errorResponse(res, 'Email already in use', 400);
    const user = await User.create({ name, email, password, role: role || 'staff', phone: phone || '', tenantId: tenant.tenantNumber });
    const { password: _, ...userData } = user.toObject();
    return successResponse(res, userData, 'User created', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateTenantUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return errorResponse(res, 'User not found', 404);
    const { name, role, phone, isActive, password } = req.body;
    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.password = password;
    await user.save();
    const { password: _, ...userData } = user.toObject();
    const msg = password ? 'User updated and password reset' : 'User updated';
    return successResponse(res, userData, msg);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createBroadcastNotification = async (req, res) => {
  try {
    const { title, message, type } = req.body;
    if (!title || !message) return errorResponse(res, 'Title and message are required', 400);
    const notification = await Notification.create({
      title, message, type: type || 'announcement',
      isBroadcast: true, tenantId: null, createdBy: req.user._id,
    });
    return successResponse(res, notification, 'Broadcast sent', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getBroadcastNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ isBroadcast: true }).sort({ createdAt: -1 }).limit(50);
    return successResponse(res, notifications);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const filter = {
      $or: [
        { isBroadcast: true },
        { tenantId: req.user.tenantId },
      ],
    };
    if (req.user.tenantId) {
      const tenant = await Tenant.findOne({ tenantNumber: req.user.tenantId });
      if (tenant) {
        filter.$or = [
          { isBroadcast: true, createdAt: { $gte: tenant.createdAt } },
          { tenantId: req.user.tenantId },
        ];
      }
    }
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(20);
    return successResponse(res, notifications);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return errorResponse(res, 'Notification not found', 404);
    if (!notification.readBy.includes(req.user._id)) {
      notification.readBy.push(req.user._id);
      await notification.save();
    }
    return successResponse(res, notification);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getRateHistory = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    const rates = await Rate.find({ date: { $gte: since } }).sort({ date: -1 }).lean();
    const grouped = {};
    rates.forEach(r => {
      const key = new Date(r.date).toISOString().split('T')[0];
      if (!grouped[key]) grouped[key] = { date: key, gold: null, silver: null };
      if (r.metalType === 'gold') grouped[key].gold = { rate: r.rate, unit: r.unit };
      if (r.metalType === 'silver') grouped[key].silver = { rate: r.rate, unit: r.unit };
    });
    return successResponse(res, Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
