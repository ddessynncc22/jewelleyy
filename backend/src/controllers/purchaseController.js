const Purchase = require('../models/Purchase');
const Refine = require('../models/Refine');
const RefinedStockEntry = require('../models/RefinedStockEntry');
const Rate = require('../models/Rate');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const CustomerLedger = require('../models/CustomerLedger');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { toPerGramRate } = require('../utils/rates');
const { scopeAggregate } = require('../utils/tenant');
const { getNextPurchaseNumber } = require('../services/sequence');
const { getRefinedStockBalance, recordRefinedStock } = require('../services/refinedStock');

const METAL_LABEL = { gold: 'Gold', silver: 'Silver' };

const round = (n, decimals = 2) => {
  const f = Math.pow(10, decimals);
  return Math.round((Number(n) || 0) * f) / f;
};

// ---------------------------------------------------------------------------
// Rate lock: the purchase snapshot. Client-provided rates win (that is what
// was quoted at the counter); otherwise we fall back to the latest master
// rate. Either way the chosen rate is copied into the document.
// ---------------------------------------------------------------------------
async function latestRateFor(metalType) {
  const tola = await Rate.findOne({ metalType, unit: 'tola' }).sort({ date: -1 }).lean();
  const row = tola || (await Rate.findOne({ metalType }).sort({ date: -1 }).lean());
  return row || null;
}

async function resolveRateLock(body) {
  const supplied = (body && body.rateLocked) || {};
  const hasGold = supplied.goldPerGram !== undefined && supplied.goldPerGram !== '' && Number(supplied.goldPerGram) >= 0;
  const hasSilver = supplied.silverPerGram !== undefined && supplied.silverPerGram !== '' && Number(supplied.silverPerGram) >= 0;
  const goldRow = hasGold ? null : await latestRateFor('gold');
  const silverRow = hasSilver ? null : await latestRateFor('silver');
  return {
    goldPerGram: hasGold ? Number(supplied.goldPerGram) : toPerGramRate(goldRow),
    silverPerGram: hasSilver ? Number(supplied.silverPerGram) : toPerGramRate(silverRow),
    goldRateId: goldRow ? goldRow._id : null,
    silverRateId: silverRow ? silverRow._id : null,
    source: hasGold || hasSilver ? 'manual' : 'live',
    lockedAt: new Date(),
  };
}

// Fine-weight normalization: gross x purity is computed once, server-side.
// The value is the user-entered amount — the rate is reference only and is
// never multiplied into a price.
function normalizeItem(item, rateLock) {
  const metalType = item.metalType;
  const gross = round(item.grossWeightG, 4);
  const purity = Math.min(1000, Math.max(1, round(item.purityPercent, 2)));
  const stone = Math.min(gross, round(item.stoneWeightG || 0, 4));
  const fine = round((gross * purity) / 1000, 4);
  // On customer buy-backs a weight deduction % is applied — the customer is
  // credited for the fine weight after the deduction.
  const deductionPercent = Math.min(100, Math.max(0, round(item.deductionPercent || 0, 2)));
  const given = round(fine * (1 - deductionPercent / 100), 4);
  const hasRate = item.ratePerGram !== undefined && item.ratePerGram !== '' && Number(item.ratePerGram) >= 0;
  const rate = hasRate ? round(item.ratePerGram, 2) : round(metalType === 'gold' ? rateLock.goldPerGram : rateLock.silverPerGram, 2);
  const value = item.value !== undefined && item.value !== '' && Number(item.value) >= 0
    ? round(Number(item.value), 2)
    : round(given * rate);
  return {
    itemType: item.itemType === 'item' ? 'item' : 'bar',
    metalType,
    purityPercent: purity,
    karat: Math.min(24, Math.max(0, Number(item.karat) || 0)),
    grossWeightG: gross,
    stoneWeightG: stone,
    fineWeightG: fine,
    deductionPercent,
    givenWeightG: given,
    ratePerGram: rate,
    value,
    description: (item.description || '').trim(),
    refineStatus: 'none',
    refineId: null,
  };
}

function computeTotals(items) {
  let grossWeightG = 0;
  let fineWeightG = 0;
  let givenWeightG = 0;
  let goldValue = 0;
  let silverValue = 0;
  items.forEach((it) => {
    grossWeightG = round(grossWeightG + it.grossWeightG, 4);
    fineWeightG = round(fineWeightG + it.fineWeightG, 4);
    givenWeightG = round(givenWeightG + it.givenWeightG, 4);
    if (it.metalType === 'gold') goldValue = round(goldValue + it.value);
    else silverValue = round(silverValue + it.value);
  });
  return { grossWeightG, fineWeightG, givenWeightG, goldValue, silverValue, totalValue: round(goldValue + silverValue) };
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'At least one item is required';
  }
  for (const item of items) {
    if (!['gold', 'silver'].includes(item.metalType)) return 'Invalid metal type';
    if (Number(item.grossWeightG) <= 0) return 'Gross weight must be greater than zero for every item';
    if (!Number(item.purityPercent) || Number(item.purityPercent) < 1 || Number(item.purityPercent) > 1000) {
      return 'Purity must be between 1 and 1000 (e.g. 999, 916, 750)';
    }
  }
  return null;
}

function normalizePayments(payments, totalValue) {
  const list = Array.isArray(payments) ? payments : [];
  let paid = 0;
  const normalized = [];
  for (const p of list) {
    const method = p && p.method ? p.method : 'cash';
    const amount = round(p && p.amount !== undefined && p.amount !== '' ? Number(p.amount) : 0);
    if (amount <= 0) continue;
    normalized.push({
      method,
      amount,
      reference: (p && p.reference) || '',
      date: (p && p.date) ? new Date(p.date) : new Date(),
    });
    paid = round(paid + amount);
  }
  const total = round(totalValue);
  paid = Math.min(paid, total);
  return {
    payments: normalized,
    paidAmount: paid,
    balanceDue: round(total - paid),
    paymentStatus: paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'credit',
  };
}

function partyName(purchase) {
  return purchase.type === 'supplier' ? purchase.supplierName : purchase.customerName;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
exports.getPurchases = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, search, startDate, endDate } = req.query;
    const query = {};
    if (type && ['supplier', 'customer', 'pos_exchange'].includes(type)) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(`${startDate}T00:00:00.000`);
      if (endDate) query.date.$lte = new Date(`${endDate}T23:59:59.999`);
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ purchaseNumber: regex }, { supplierName: regex }, { customerName: regex }, { vatInvoiceNo: regex }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [rows, total] = await Promise.all([
      Purchase.find(query)
        .populate('customer', 'name phone customerCode')
        .populate('saleRef', 'saleNumber saleDate')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Purchase.countDocuments(query),
    ]);
    const data = rows.map((p) => ({
      ...p,
      partyName: partyName(p),
    }));
    return paginatedResponse(res, data, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------
exports.getPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('customer', 'name phone customerCode')
      .populate('saleRef', 'saleNumber saleDate totalAmount paymentType')
      .lean();
    if (!purchase) return errorResponse(res, 'Purchase not found', 404);
    const refines = await Refine.find({ purchaseId: purchase._id }).sort({ createdAt: -1 }).lean();
    return successResponse(res, { purchase, refines });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
exports.createPurchase = async (req, res) => {
  try {
    const { type = 'supplier', date, supplierName, vatInvoiceNo, customer, customerName, items, payments, rateLocked, notes } = req.body;
    if (!['supplier', 'customer', 'pos_exchange'].includes(type)) return errorResponse(res, 'Purchase type must be supplier, customer or pos_exchange', 400);
    const itemError = validateItems(items);
    if (itemError) return errorResponse(res, itemError, 400);
    if (type === 'supplier' && !(supplierName || '').trim()) {
      return errorResponse(res, 'Supplier name is required for supplier purchases', 400);
    }

    const lock = await resolveRateLock(req.body);
    const normalizedItems = items.map((it) => normalizeItem({ ...it, itemType: type === 'supplier' ? 'bar' : 'item' }, lock));
    const totals = computeTotals(normalizedItems);
    const paymentInfo = normalizePayments(payments, totals.totalValue);

    const purchaseNumber = await getNextPurchaseNumber(req.tenantId);
    const purchase = await Purchase.create({
      purchaseNumber,
      type,
      date: date ? new Date(date) : new Date(),
       supplierName: type === 'supplier' ? String(supplierName || '').trim() : '',
       vatInvoiceNo: type === 'supplier' ? String(vatInvoiceNo || '').trim() : '',
       customer: (type === 'customer' || type === 'pos_exchange') && customer ? customer : null,
       customerName: (type === 'customer' || type === 'pos_exchange') ? String(customerName || '').trim() : '',
      items: normalizedItems,
      totals,
      rateLocked: lock,
      payments: paymentInfo.payments,
      paidAmount: paymentInfo.paidAmount,
      balanceDue: paymentInfo.balanceDue,
      paymentStatus: paymentInfo.paymentStatus,
      notes: notes || '',
    });

    // Physical metal movements (raw metal, no Item document).
    const movementCategory = type === 'supplier' ? 'Purchase' : 'Buy-back';
    const stockMovements = normalizedItems.map((it) =>
      StockMovement.create({
        item: null,
        type: 'stockIn',
        category: movementCategory,
        quantity: 1,
        weight: it.grossWeightG,
        purity: it.purityPercent,
        reference: purchaseNumber,
        notes: `${METAL_LABEL[it.metalType]} ${it.purityPercent} — ${purchaseNumber} (${type === 'supplier' ? 'supplier' : 'customer'} purchase)`,
        performedBy: req.user._id,
        movementDate: purchase.date,
      })
    );

    // Supplier purchases are refined bars: they immediately add fine gold
    // to the refined-gold stock. Customer purchases are unrefined items
    // and only add to stock once the refinery returns gold.
    let refinedAdded = 0;
    if (type === 'supplier') {
      const goldFine = normalizedItems.filter((it) => it.metalType === 'gold').reduce((s, it) => s + it.fineWeightG, 0);
      if (goldFine > 0) {
        await recordRefinedStock({
          tenantId: req.tenantId,
          performedBy: req.user._id,
          type: 'in',
          source: 'purchase',
          sourceId: purchase._id,
          referenceNumber: purchaseNumber,
          weightG: goldFine,
          note: `Supplier purchase ${purchaseNumber} — refined gold bars`,
          date: purchase.date,
        });
        refinedAdded = goldFine;
      }
    }

    await Promise.all(stockMovements);

    // Customer purchases with an outstanding balance put the shop in credit
    // to the customer (khaata). Append to the running ledger.
    if (type === 'customer' && purchase.balanceDue > 0 && purchase.customer) {
      const customerDoc = await Customer.findById(purchase.customer);
      if (customerDoc) {
        const lastLedger = await CustomerLedger.findOne({ customer: purchase.customer }).sort({ transactionDate: -1 });
        const prevBalance = lastLedger ? lastLedger.balanceAfter : 0;
        await CustomerLedger.create({
          customer: purchase.customer,
          transactionType: 'credit',
          reference: purchaseNumber,
          referenceModel: 'Purchase',
          referenceId: purchase._id,
          amount: purchase.balanceDue,
          balanceAfter: prevBalance + purchase.balanceDue,
          note: `Customer purchase ${purchaseNumber} — ${purchase.balanceDue} payable`,
          transactionDate: purchase.date,
        });
      }
    }

    await ActivityLog.create({
      action: 'create',
      module: 'purchase',
      description: `${type === 'supplier' ? 'Supplier' : 'Customer'} purchase ${purchaseNumber} (${totals.grossWeightG} g, ${totals.totalValue})`,
      performedBy: req.user._id,
      referenceId: purchase._id,
      referenceModel: 'Purchase',
    });

    return successResponse(res, { purchase, refinedAdded }, 'Purchase recorded successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Delete (soft). Blocked while any of its lines are pending/refined.
// ---------------------------------------------------------------------------
exports.deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return errorResponse(res, 'Purchase not found', 404);
    const linkedRefines = await Refine.countDocuments({ purchaseId: purchase._id });
    if (linkedRefines > 0) {
      return errorResponse(res, `Cannot delete: ${linkedRefines} refine entr${linkedRefines === 1 ? 'y' : 'ies'} linked to this purchase. Delete the refine entr${linkedRefines === 1 ? 'y' : 'ies'} first.`, 400);
    }

    // Reverse the refined-gold stock added by supplier gold bars.
    if (purchase.type === 'supplier') {
      const goldFine = purchase.items.filter((it) => it.metalType === 'gold').reduce((s, it) => s + (it.fineWeightG || 0), 0);
      if (goldFine > 0) {
        await recordRefinedStock({
          tenantId: req.tenantId,
          performedBy: req.user._id,
          type: 'out',
          source: 'reversal',
          sourceId: purchase._id,
          referenceNumber: purchase.purchaseNumber,
          weightG: goldFine,
          note: `Reversal of purchase ${purchase.purchaseNumber}`,
        });
      }
    }

    // Remove the physical metal movements that this purchase created.
    await StockMovement.deleteMany({ reference: purchase.purchaseNumber, referenceModel: { $exists: false } });

    await purchase.softDelete();
    await ActivityLog.create({
      action: 'delete',
      module: 'purchase',
      description: `Purchase ${purchase.purchaseNumber} deleted`,
      performedBy: req.user._id,
      referenceId: purchase._id,
      referenceModel: 'Purchase',
    });
    return successResponse(res, null, 'Purchase deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Purchase summary — gold bought from every source (supplier, customer
// walk-in, POS old-gold exchange) plus the current refined-gold balance.
// ---------------------------------------------------------------------------
exports.getPurchaseSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateMatch = {};
    if (startDate || endDate) {
      dateMatch.date = {};
      if (startDate) dateMatch.date.$gte = new Date(`${startDate}T00:00:00.000`);
      if (endDate) dateMatch.date.$lte = new Date(`${endDate}T23:59:59.999`);
    }

    const empty = { count: 0, grossWeightG: 0, fineWeightG: 0, goldValue: 0, silverValue: 0, totalValue: 0 };

    const [supplierAgg, customerAgg, refinedReceivedAgg] = await Promise.all([
      Purchase.aggregate(scopeAggregate([
        { $match: { isDeleted: false, type: 'supplier', ...dateMatch } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            grossWeightG: { $sum: '$totals.grossWeightG' },
            fineWeightG: { $sum: '$totals.fineWeightG' },
            goldValue: { $sum: '$totals.goldValue' },
            silverValue: { $sum: '$totals.silverValue' },
            totalValue: { $sum: '$totals.totalValue' },
          },
        },
      ])),
      Purchase.aggregate(scopeAggregate([
        { $match: { isDeleted: false, type: 'customer', ...dateMatch } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            grossWeightG: { $sum: '$totals.grossWeightG' },
            fineWeightG: { $sum: '$totals.fineWeightG' },
            goldValue: { $sum: '$totals.goldValue' },
            silverValue: { $sum: '$totals.silverValue' },
            totalValue: { $sum: '$totals.totalValue' },
            unpaidBalance: { $sum: '$balanceDue' },
          },
        },
      ])),
      RefinedStockEntry.aggregate(scopeAggregate([
        {
          $match: {
            type: 'in',
            source: { $in: ['purchase', 'refine'] },
            ...(startDate || endDate ? { date: {} } : {}),
            ...(startDate ? { date: { $gte: new Date(`${startDate}T00:00:00.000`) } } : {}),
            ...(endDate ? { date: { $lte: new Date(`${endDate}T23:59:59.999`) } } : {}),
          },
        },
        { $group: { _id: null, weightG: { $sum: '$weightG' } } },
      ])),
    ]);

    // POS old gold is stored on Sale.oldGoldDetails, so filter the sales
    // in the period that actually carried old gold.
    const saleMatch = { isDeleted: false, 'oldGoldDetails.weight': { $gt: 0 } };
    if (startDate || endDate) {
      saleMatch.saleDate = {};
      if (startDate) saleMatch.saleDate.$gte = new Date(`${startDate}T00:00:00.000`);
      if (endDate) saleMatch.saleDate.$lte = new Date(`${endDate}T23:59:59.999`);
    }
    const posAggRes = await Sale.aggregate(scopeAggregate([
      { $match: saleMatch },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          grossWeightG: { $sum: '$oldGoldDetails.weight' },
          netWeightG: { $sum: '$oldGoldDetails.netWeight' },
          value: { $sum: '$oldGoldDetails.value' },
          deductibleAmount: { $sum: '$oldGoldDetails.deductibleAmount' },
        },
      },
    ]));

    const posSales = await Sale.find({ ...saleMatch })
      .sort({ saleDate: -1 })
      .limit(200)
      .select('saleNumber saleDate customer totalAmount oldGoldDetails')
      .lean();

    const supplier = supplierAgg[0] || { ...empty };
    const customer = customerAgg[0] || { ...empty };
    const pos = posAggRes[0] || { count: 0, grossWeightG: 0, netWeightG: 0, value: 0, deductibleAmount: 0 };
    pos.sales = posSales.map((s) => ({
      _id: s._id,
      saleNumber: s.saleNumber,
      saleDate: s.saleDate,
      customer: s.customer,
      totalAmount: s.totalAmount,
      grossWeightG: s.oldGoldDetails?.weight || 0,
      netWeightG: s.oldGoldDetails?.netWeight || 0,
      value: s.oldGoldDetails?.value || 0,
      deductibleAmount: s.oldGoldDetails?.deductibleAmount || 0,
    }));
    const refinedReceived = refinedReceivedAgg[0] ? refinedReceivedAgg[0].weightG : 0;
    const refinedStock = await getRefinedStockBalance(req.tenantId);

    return successResponse(res, {
      supplier,
      customer,
      pos,
      totals: {
        count: (supplier.count || 0) + (customer.count || 0) + (pos.count || 0),
        grossWeightG: round((supplier.grossWeightG || 0) + (customer.grossWeightG || 0) + (pos.grossWeightG || 0), 4),
        goldValue: round((supplier.goldValue || 0) + (customer.goldValue || 0) + (pos.value || 0)),
        totalValue: round((supplier.totalValue || 0) + (customer.totalValue || 0) + (pos.value || 0)),
      },
      refinedStock: {
        balanceG: refinedStock,
        receivedInPeriodG: round(refinedReceived, 4),
        runsOut: refinedStock <= 0,
      },
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
