const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { validateSlug, slugify, shopUrlFor } = require('../middleware/host');
const jwt = require('jsonwebtoken');
const config = require('../config');

const generateToken = (id, tenantId) => {
  return jwt.sign({ id, tenantId }, config.jwtSecret, { expiresIn: config.jwtExpire });
};

exports.listTenants = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isActive, planType, sort = 'createdAt', order = 'desc' } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { storeName: { $regex: search, $options: 'i' } },
      ];
    }
    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true';
    }
    if (planType) {
      query.planType = planType;
    }

    const sortable = ['name', 'slug', 'planType', 'isActive', 'createdAt', 'tenantNumber', 'businessStartDate'];
    const sortField = sortable.includes(sort) ? sort : 'createdAt';
    const direction = order === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);
    const [tenants, total] = await Promise.all([
      Tenant.find(query)
        .select('-taxSettings')
        .sort({ [sortField]: direction })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Tenant.countDocuments(query),
    ]);

    const tenantNumbers = tenants.map((t) => t.tenantNumber).filter(Boolean);
    const usersAgg = tenantNumbers.length
      ? await User.aggregate([
          { $match: { tenantId: { $in: tenantNumbers }, role: { $ne: 'superadmin' }, isDeleted: false } },
          { $group: { _id: '$tenantId', count: { $sum: 1 } } },
        ])
      : [];
    const userCountMap = {};
    usersAgg.forEach((u) => { userCountMap[u._id] = u.count; });

    const rows = tenants.map((t) => ({
      ...t,
      userCount: userCountMap[t.tenantNumber] || 0,
      shopUrl: shopUrlFor(t.slug, req),
    }));

    return paginatedResponse(res, rows, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).select('-taxSettings').lean();
    if (!tenant) return errorResponse(res, 'Tenant not found', 404);
    return successResponse(res, { ...tenant, shopUrl: shopUrlFor(tenant.slug, req) });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.onboard = async (req, res) => {
  try {
    const { tenantName, adminName, adminEmail, adminPassword, adminPhone, slug } = req.body;

    if (!tenantName || !adminName || !adminEmail || !adminPassword) {
      return errorResponse(res, 'tenantName, adminName, adminEmail, and adminPassword are required', 400);
    }

    // The slug is the shop's subdomain (<slug>.example.com), so it must be a
    // valid DNS label and must not collide with an infrastructure hostname.
    let tenantSlug;
    if (slug) {
      // Explicitly chosen by the superadmin: fail loudly rather than silently
      // handing them a different URL than the one they asked for.
      const check = validateSlug(slug);
      if (!check.valid) return errorResponse(res, check.reason, 400);
      if (await Tenant.findOne({ slug: check.slug })) {
        return errorResponse(res, `The subdomain "${check.slug}" is already taken`, 400);
      }
      tenantSlug = check.slug;
    } else {
      // Derived from the shop name: repair it into something usable.
      const base = slugify(tenantName) || 'shop';
      let candidate = base.length < 3 ? `${base}-shop` : base;
      for (let attempt = 0; attempt < 5; attempt++) {
        const check = validateSlug(candidate);
        if (check.valid && !(await Tenant.findOne({ slug: check.slug }))) {
          tenantSlug = check.slug;
          break;
        }
        candidate = `${base}-${Math.random().toString(36).substring(2, 6)}`;
      }
      if (!tenantSlug) {
        return errorResponse(res, 'Could not derive an available subdomain from the shop name. Provide one explicitly.', 400);
      }
    }

    const existingEmail = await User.findOne({ email: adminEmail });
    if (existingEmail) {
      return errorResponse(res, 'Email already registered', 400);
    }

    const tenant = await Tenant.create({
      name: tenantName,
      slug: tenantSlug,
      contactEmail: req.body.contactEmail || adminEmail,
      contactPhone: req.body.contactPhone || '',
      address: req.body.address || '',
      storeName: req.body.storeName || tenantName,
      currency: req.body.currency || 'NPR',
      defaultPurity: req.body.defaultPurity || 916,
      defaultKarat: req.body.defaultKarat || 22,
      lowStockThreshold: req.body.lowStockThreshold || 5,
      planType: req.body.planType || 'standard',
      businessStartDate: req.body.businessStartDate || undefined,
      taxSettings: req.body.taxSettings || {},
      isActive: true,
    });

    const user = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      phone: adminPhone || '',
      role: 'admin',
      tenantId: tenant.tenantNumber,
    });

    await Settings.create({
      storeName: tenant.storeName,
      currency: tenant.currency,
      defaultPurity: tenant.defaultPurity,
      defaultKarat: tenant.defaultKarat,
      lowStockThreshold: tenant.lowStockThreshold,
      businessStartDate: tenant.businessStartDate,
      taxSettings: tenant.taxSettings,
      tenantId: tenant.tenantNumber,
    });

    const token = generateToken(user._id, tenant.tenantNumber);
    const shopUrl = shopUrlFor(tenant.slug, req);
    return successResponse(res, {
      tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug, shopUrl },
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token,
    }, shopUrl ? `Shop created. Its address is ${shopUrl}` : 'Tenant created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ tenantNumber: req.tenantId });
    if (!tenant) {
      return errorResponse(res, 'Tenant not found', 404);
    }
    return successResponse(res, tenant);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateTenant = async (req, res) => {
  try {
    const allowed = ['name', 'contactEmail', 'contactPhone', 'address', 'vatNumber', 'logoUrl', 'storeName', 'currency', 'defaultPurity', 'defaultKarat', 'lowStockThreshold', 'businessStartDate', 'planType', 'taxSettings', 'nepalTaxSettings'];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const tenantId = req.params.id || req.tenantId;
    if (!tenantId) return errorResponse(res, 'Tenant ID required', 400);
    const tenant = req.params.id
      ? await Tenant.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      : await Tenant.findOneAndUpdate({ tenantNumber: req.tenantId }, updates, { new: true, runValidators: true });
    if (!tenant) {
      return errorResponse(res, 'Tenant not found', 404);
    }
    return successResponse(res, tenant, 'Tenant updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
