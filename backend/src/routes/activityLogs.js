const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');
const { ActivityLog } = require('../models');
const { getPagination } = require('../utils/helpers');

router.get('/', protect, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.action) filter.action = req.query.action;
    if (req.query.module) filter.module = req.query.module;
    if (req.query.performedBy) filter.performedBy = req.query.performedBy;
    if (req.query.referenceId) filter.referenceId = req.query.referenceId;
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('performedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ]);

    sendSuccess(res, { logs, total, page, limit, totalPages: Math.ceil(total / limit) }, 'Activity logs retrieved');
  } catch (error) {
    next(error);
  }
});

router.get('/modules', protect, async (req, res, next) => {
  try {
    const modules = await ActivityLog.distinct('module');
    sendSuccess(res, { modules }, 'Modules retrieved');
  } catch (error) {
    next(error);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const log = await ActivityLog.findById(req.params.id)
      .populate('performedBy', 'name email role');

    if (!log) {
      return res.status(404).json({ success: false, message: 'Activity log not found', data: null, errors: null });
    }

    sendSuccess(res, { log }, 'Activity log retrieved');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
