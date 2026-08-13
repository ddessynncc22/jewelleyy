const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendSuccess, sendError } = require('../utils/response');
const { Sale, Item, StockMovement, CustomerLedger, ActivityLog } = require('../models');
const { generateSaleNumber, getPagination, escapeRegex } = require('../utils/helpers');

// Whitelist for PUT /:id — prevents overwriting identifiers, auditors, ledger
// state, or soft-delete flags through mass assignment.
const SALE_UPDATABLE_FIELDS = ['paymentType', 'totalAmount', 'paidAmount', 'cashAmount', 'khaataAmount', 'customer', 'saleDate', 'note', 'notes', 'taxDetails', 'discountAmount'];
const saleUpdateData = (body) => {
  const out = {};
  for (const f of SALE_UPDATABLE_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
};

router.get('/', protect, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.search) {
      const searchRegex = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ saleNumber: searchRegex }];
    }
    if (req.query.paymentType) filter.paymentType = req.query.paymentType;
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.startDate || req.query.endDate) {
      filter.saleDate = {};
      if (req.query.startDate) filter.saleDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.saleDate.$lte = new Date(req.query.endDate);
    }

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate('items.item', 'SKU itemName category')
        .populate('customer', 'name phone')
        .populate('soldBy', 'name')
        .sort({ saleDate: -1 })
        .skip(skip)
        .limit(limit),
      Sale.countDocuments(filter),
    ]);

    sendSuccess(res, { sales, total, page, limit, totalPages: Math.ceil(total / limit) }, 'Sales retrieved');
  } catch (error) {
    next(error);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('items.item', 'SKU itemName category images')
      .populate('customer', 'name phone customerCode')
      .populate('soldBy', 'name');

    if (!sale) {
      return sendError(res, 'Sale not found', 404);
    }

    sendSuccess(res, { sale }, 'Sale retrieved');
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  protect,
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('paymentType').isIn(['cash', 'khaata', 'partial', 'oldGoldExchange']).withMessage('Invalid payment type'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const saleNumber = generateSaleNumber();

      const paidAmount = req.body.paymentType === 'cash'
        ? req.body.totalAmount
        : (req.body.paidAmount || 0);

      const saleData = {
        ...req.body,
        saleNumber,
        paidAmount,
        balance: req.body.totalAmount - paidAmount,
        soldBy: req.user._id,
      };

      const sale = await Sale.create(saleData);

      for (const itemData of sale.items) {
        const item = await Item.findById(itemData.item);
        if (item) {
          item.status = 'Sold';
          await item.save();

          await StockMovement.create({
            item: item._id,
            type: 'stockOut',
            category: 'Sale',
            quantity: itemData.quantity || 1,
            weight: itemData.weight || item.grossWeight,
            purity: itemData.purity || item.purity,
            reference: saleNumber,
            referenceModel: 'Sale',
            notes: `Sold via sale ${saleNumber}`,
            performedBy: req.user._id,
          });
        }
      }

      if (req.body.customer && (req.body.paymentType === 'khaata' || req.body.paymentType === 'partial')) {
        const lastEntry = await CustomerLedger.findOne({ customer: req.body.customer })
          .sort({ transactionDate: -1 });
        const lastBalance = lastEntry ? lastEntry.balanceAfter : 0;

        await CustomerLedger.create({
          customer: req.body.customer,
          transactionType: 'credit',
          reference: saleNumber,
          referenceModel: 'Sale',
          referenceId: sale._id,
          amount: sale.balance,
          balanceAfter: lastBalance + sale.balance,
          note: `Sale ${saleNumber} - remaining balance`,
          transactionDate: new Date(),
        });

        if (paidAmount > 0) {
          await CustomerLedger.create({
            customer: req.body.customer,
            transactionType: 'payment',
            reference: saleNumber,
            referenceModel: 'Sale',
            referenceId: sale._id,
            amount: paidAmount,
            balanceAfter: lastBalance + sale.balance,
            note: `Sale ${saleNumber} - payment received`,
            transactionDate: new Date(),
          });
        }
      }

      await ActivityLog.create({
        action: 'CREATE',
        module: 'Sale',
        description: `Sale ${saleNumber} created (${req.body.paymentType})`,
        performedBy: req.user._id,
        referenceId: sale._id,
        referenceModel: 'Sale',
        ipAddress: req.ip,
      });

      sendSuccess(res, { sale }, 'Sale created', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id', protect, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const sale = await Sale.findByIdAndUpdate(req.params.id, saleUpdateData(req.body), { new: true, runValidators: true });
    if (!sale) {
      return sendError(res, 'Sale not found', 404);
    }

    await ActivityLog.create({
      action: 'UPDATE',
      module: 'Sale',
      description: `Sale ${sale.saleNumber} updated`,
      performedBy: req.user._id,
      referenceId: sale._id,
      referenceModel: 'Sale',
      ipAddress: req.ip,
    });

    sendSuccess(res, { sale }, 'Sale updated');
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return sendError(res, 'Sale not found', 404);
    }

    await sale.softDelete();

    await ActivityLog.create({
      action: 'DELETE',
      module: 'Sale',
      description: `Sale ${sale.saleNumber} deleted`,
      performedBy: req.user._id,
      referenceId: sale._id,
      referenceModel: 'Sale',
      ipAddress: req.ip,
    });

    sendSuccess(res, null, 'Sale deleted');
  } catch (error) {
    next(error);
  }
});

router.post('/:id/payment', protect, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return sendError(res, 'Sale not found', 404);
    }

    if (sale.balance <= 0) {
      return sendError(res, 'Sale already fully paid', 400);
    }

    const requestedAmount = Number(req.body.amount);
    const paymentAmount = Math.min(
      Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : sale.balance,
      sale.balance
    );
    sale.paidAmount += paymentAmount;
    sale.balance = Math.max(0, sale.balance - paymentAmount);
    await sale.save();

    if (req.body.customer) {
      const lastEntry = await CustomerLedger.findOne({ customer: req.body.customer })
        .sort({ transactionDate: -1 });
      const lastBalance = lastEntry ? lastEntry.balanceAfter : 0;

      await CustomerLedger.create({
        customer: req.body.customer,
        transactionType: 'payment',
        reference: sale.saleNumber,
        referenceModel: 'Sale',
        referenceId: sale._id,
        amount: paymentAmount,
        balanceAfter: lastBalance - paymentAmount,
        note: req.body.note || `Payment for sale ${sale.saleNumber}`,
        transactionDate: new Date(),
      });
    }

    await ActivityLog.create({
      action: 'PAYMENT',
      module: 'Sale',
      description: `Payment of ${paymentAmount} received for sale ${sale.saleNumber}`,
      performedBy: req.user._id,
      referenceId: sale._id,
      referenceModel: 'Sale',
      ipAddress: req.ip,
    });

    sendSuccess(res, { sale }, 'Payment recorded');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
