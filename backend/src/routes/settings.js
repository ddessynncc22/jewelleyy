const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadSingleImage } = require('../middleware/upload');
const { sendSuccess } = require('../utils/response');
const Settings = require('../models/Settings');
const ActivityLog = require('../models/ActivityLog');

const defaults = {
  storeName: 'My Jewellery Store', address: '', phone: '', email: '',
  currency: 'NPR', defaultPurity: 916, defaultKarat: 22,
  lowStockThreshold: 5, panNumber: '', logoUrl: '',
  goldTransportCharge: 0, silverTransportCharge: 0,
  looseWeightTolerancePercent: 15,
};

// Whitelist — a caller can never smuggle in tenantId (cross-tenant write) or
// fields outside the settings schema through mass assignment.
const UPDATABLE_FIELDS = Object.keys(defaults);
const pickSettingsFields = (body) => {
  const out = {};
  for (const f of UPDATABLE_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
};

router.get('/', protect, async (req, res, next) => {
  try {
    if (!req.tenantId) return sendSuccess(res, { settings: defaults });
    let settings = await Settings.findOne({ tenantId: req.tenantId });
    if (!settings) {
      settings = await Settings.create({ tenantId: req.tenantId, ...defaults });
    }
    sendSuccess(res, { settings });
  } catch (error) {
    next(error);
  }
});

router.put('/', protect, authorize('admin', 'manager'), uploadSingleImage, async (req, res, next) => {
  try {
    const updates = pickSettingsFields(req.body);
    if (req.file) updates.logoUrl = `${req.uploadBaseUrl}/${req.file.filename}`;
    if (!req.tenantId) return sendSuccess(res, { settings: { ...defaults, ...updates } });
    let settings = await Settings.findOne({ tenantId: req.tenantId });
    if (!settings) {
      settings = await Settings.create({ tenantId: req.tenantId, ...defaults, ...updates });
    } else {
      Object.keys(updates).forEach(k => { settings[k] = updates[k]; });
      await settings.save();
    }
    await ActivityLog.create({
      action: 'UPDATE', module: 'Settings',
      description: 'Settings updated', performedBy: req.user._id, ipAddress: req.ip,
    });
    sendSuccess(res, { settings });
  } catch (error) {
    next(error);
  }
});

router.patch('/', protect, authorize('admin', 'manager'), uploadSingleImage, async (req, res, next) => {
  try {
    const updates = pickSettingsFields(req.body);
    if (req.file) updates.logoUrl = `${req.uploadBaseUrl}/${req.file.filename}`;
    if (!req.tenantId) return sendSuccess(res, { settings: { ...defaults, ...updates } });
    let settings = await Settings.findOne({ tenantId: req.tenantId });
    if (!settings) {
      settings = await Settings.create({ tenantId: req.tenantId, ...defaults, ...updates });
    } else {
      Object.keys(updates).forEach(k => { settings[k] = updates[k]; });
      await settings.save();
    }
    await ActivityLog.create({
      action: 'UPDATE', module: 'Settings',
      description: 'Settings updated', performedBy: req.user._id, ipAddress: req.ip,
    });
    sendSuccess(res, { settings });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
