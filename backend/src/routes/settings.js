const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');
const Settings = require('../models/Settings');
const ActivityLog = require('../models/ActivityLog');

const defaults = {
  storeName: 'My Jewellery Store', address: '', phone: '', email: '',
  currency: 'NPR', defaultPurity: 916, defaultKarat: 22,
  lowStockThreshold: 5, taxSettings: {},
  nepalTaxSettings: { enabled: false, luxuryTax: 0, vatRate: 13, vatEnabled: true, irdPrintEnabled: true, fiscalYearStart: '04', panNumber: '', includeInInvoice: true },
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

router.put('/', protect, async (req, res, next) => {
  try {
    if (!req.tenantId) return sendSuccess(res, { settings: { ...defaults, ...req.body } });
    let settings = await Settings.findOne({ tenantId: req.tenantId });
    if (!settings) {
      settings = await Settings.create({ tenantId: req.tenantId, ...defaults, ...req.body });
    } else {
      Object.keys(req.body).forEach(k => { settings[k] = req.body[k]; });
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

router.patch('/', protect, async (req, res, next) => {
  try {
    if (!req.tenantId) return sendSuccess(res, { settings: { ...defaults, ...req.body } });
    let settings = await Settings.findOne({ tenantId: req.tenantId });
    if (!settings) {
      settings = await Settings.create({ tenantId: req.tenantId, ...defaults, ...req.body });
    } else {
      Object.keys(req.body).forEach(k => { settings[k] = req.body[k]; });
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
