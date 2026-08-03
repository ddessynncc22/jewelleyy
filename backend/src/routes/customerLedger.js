const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendSuccess, sendError } = require('../utils/response');
const { CustomerLedger, ActivityLog } = require('../models');
const { getPagination } = require('../utils/helpers');

router.get('/', protect, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.transactionType) filter.transactionType = req.query.transactionType;
    if (req.query.startDate || req.query.endDate) {
      filter.transactionDate = {};
      if (req.query.startDate) filter.transactionDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.transactionDate.$lte = new Date(req.query.endDate);
    }

    const [entries, total] = await Promise.all([
      CustomerLedger.find(filter)
        .populate('customer', 'name phone customerCode')
        .sort({ transactionDate: -1 })
        .skip(skip)
        .limit(limit),
      CustomerLedger.countDocuments(filter),
    ]);

    sendSuccess(res, { entries, total, page, limit, totalPages: Math.ceil(total / limit) }, 'Ledger entries retrieved');
  } catch (error) {
    next(error);
  }
});

router.get('/customer/:customerId', protect, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { customer: req.params.customerId };

    const [entries, total] = await Promise.all([
      CustomerLedger.find(filter)
        .populate('customer', 'name phone customerCode')
        .sort({ transactionDate: -1 })
        .skip(skip)
        .limit(limit),
      CustomerLedger.countDocuments(filter),
    ]);

    const balance = entries.length > 0 ? entries[0].balanceAfter : 0;

    sendSuccess(res, { entries, total, balance, page, limit, totalPages: Math.ceil(total / limit) }, 'Customer ledger entries retrieved');
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  protect,
  [
    body('customer').notEmpty().withMessage('Customer is required'),
    body('transactionType').isIn(['credit', 'payment']).withMessage('Transaction type must be credit or payment'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const lastEntry = await CustomerLedger.findOne({ customer: req.body.customer })
        .sort({ transactionDate: -1 });

      const lastBalance = lastEntry ? lastEntry.balanceAfter : 0;
      const balanceAfter = req.body.transactionType === 'credit'
        ? lastBalance + req.body.amount
        : lastBalance - req.body.amount;

      if (req.body.transactionType === 'payment' && balanceAfter < 0) {
        return sendError(res, 'Insufficient balance for this payment', 400);
      }

      const entryData = {
        ...req.body,
        balanceAfter,
        transactionDate: req.body.transactionDate || new Date(),
      };

      const entry = await CustomerLedger.create(entryData);

      await ActivityLog.create({
        action: 'CREATE',
        module: 'CustomerLedger',
        description: `Ledger entry of ${req.body.amount} for customer ${req.body.customer}`,
        performedBy: req.user._id,
        referenceId: entry._id,
        referenceModel: 'CustomerLedger',
        ipAddress: req.ip,
      });

      sendSuccess(res, { entry }, 'Ledger entry created', 201);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
