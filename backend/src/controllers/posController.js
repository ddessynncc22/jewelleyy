const Sale = require('../models/Sale');
const Item = require('../models/Item');
const LooseLotSale = require('../models/LooseLotSale');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Purchase = require('../models/Purchase');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { getNextPurchaseNumber } = require('../services/sequence');
const {
  processLotLine,
  getTolerancePercent,
  getLiveRatePerGram,
  syncParentItemStock,
  diamondRateFor,
  computeTaxes,
  getDiamondVatStatus,
} = require('./looseLotController');

exports.getDiamondVatStatus = getDiamondVatStatus;
exports.recordOldGoldPurchase = recordOldGoldPurchase;
exports.reverseOldGoldPurchase = reverseOldGoldPurchase;

const round = (n, decimals = 4) => {
  const f = Math.pow(10, decimals);
  return Math.round((Number(n) || 0) * f) / f;
};

// Keep only well-formed payment-method entries (method in cash|qr|cheque,
// amount > 0). Falls back to a single cash row for the given cash amount so
// legacy clients and older saved sales still have a receipt breakdown.
function sanitizePaymentMethods(paymentMethods, cashAmount) {
  const VALID = new Set(['cash', 'qr', 'cheque']);
  if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
    const cleaned = paymentMethods
      .filter((m) => m && VALID.has(m.method) && Number(m.amount) > 0)
      .map((m) => ({
        method: m.method,
        amount: Math.round(Number(m.amount) * 100) / 100,
        reference: m.reference ? String(m.reference).trim().slice(0, 100) : '',
      }));
    if (cleaned.length > 0) return cleaned;
  }
  const cash = Number(cashAmount) || 0;
  return cash > 0 ? [{ method: 'cash', amount: cash, reference: '' }] : [];
}

// When a POS sale carries an old-gold exchange (oldGoldDetails.weight > 0)
// the gold the customer handed over is functionally a customer buy-back:
// it enters the physical stock as unrefined metal and should be tracked as a
// Purchase so it shows up in the Purchases list / Gold-in-stock view and can
// be sent to the refinery like any other customer purchase.
async function recordOldGoldPurchase(sale, ogd, req) {
  if (!ogd || !ogd.weight || Number(ogd.weight) <= 0) return null;

  const karat = Number(ogd.purity) || 0;
  const purityPercent = karat > 0 && karat <= 24 ? Math.round((karat / 24) * 1000) : Math.round(Number(ogd.purityPercent || karat) || 0);
  const grossWeightG = round(ogd.weight);
  const fineWeightG = round((grossWeightG * purityPercent) / 1000);
  const value = round(ogd.value || 0, 2);

  let customerName = '';
  if (sale.customer) {
    const cust = await Customer.findById(sale.customer).lean().select('name');
    customerName = cust ? cust.name : '';
  }

  const purchaseNumber = await getNextPurchaseNumber(req.tenantId);

  const purchase = await Purchase.create({
    purchaseNumber,
    type: 'pos_exchange',
    date: sale.saleDate || new Date(),
    supplierName: '',
    customer: sale.customer || null,
    customerName,
    items: [
      {
        itemType: 'item',
        metalType: 'gold',
        purityPercent,
        karat: karat > 0 && karat <= 24 ? karat : 0,
        grossWeightG,
        stoneWeightG: 0,
        fineWeightG,
        ratePerGram: 0,
        value,
        description: `Old gold exchange via Sale ${sale.saleNumber}`,
        refineStatus: 'none',
        refineId: null,
      },
    ],
    totals: {
      grossWeightG,
      fineWeightG,
      goldValue: value,
      silverValue: 0,
      totalValue: value,
    },
    rateLocked: { goldPerGram: 0, silverPerGram: 0, source: 'manual', lockedAt: new Date() },
    payments: [],
    paidAmount: value,
    balanceDue: 0,
    paymentStatus: 'paid',
    notes: `Auto-created from POS sale ${sale.saleNumber} (old gold exchange)`,
    saleRef: sale._id,
  });

  // Physical metal movement: gold received from the customer (buy-back).
  await StockMovement.create({
    item: null,
    type: 'stockIn',
    category: 'Buy-back',
    quantity: 1,
    weight: grossWeightG,
    purity: purityPercent,
    reference: purchaseNumber,
    notes: `Old gold exchange via Sale ${sale.saleNumber} — ${purchaseNumber}`,
    performedBy: req.user._id,
    movementDate: sale.saleDate || new Date(),
  });

  return purchase;
}

// Reverse the purchase + stock movement created for an old-gold exchange
// when the originating sale is deleted. The purchase is soft-deleted so the
// audit trail stays intact; if it has already been sent to refine we leave it
// in place (the sale deletion already records a reversal stock movement).
async function reverseOldGoldPurchase(sale, req) {
  const purchase = await Purchase.findOne({ saleRef: sale._id });
  if (!purchase) return;

  await StockMovement.create({
    item: null,
    type: 'stockOut',
    category: 'Buy-back',
    quantity: 1,
    weight: purchase.totals?.grossWeightG || 0,
    purity: purchase.items?.[0]?.purityPercent || 0,
    reference: purchase.purchaseNumber,
    notes: `Reversal of old gold exchange via Sale ${sale.saleNumber} — ${purchase.purchaseNumber}`,
    performedBy: req.user._id,
  });

  await purchase.softDelete();
}

exports.createSale = async (req, res) => {
  try {
    const { items, paymentType, cashAmount, khaataAmount, oldGoldDetails, paymentBreakdown, paymentMethods, totalAmount, taxAmount, diamondTaxAmount, paidAmount, actualAmountReceived, discountAmount, customerId, customer: customerField, saleDate, cashierName } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0 || !paymentType || !totalAmount) {
      return errorResponse(res, 'Items, payment type, and total amount are required', 400);
    }
    const saleCount = await Sale.countDocuments({ isDeleted: false });
    const saleNumber = `SALE-${String(saleCount + 1).padStart(5, '0')}`;
    const saleItems = [];
    const updatedItems = [];
    let diamondAmount = 0;
    for (const si of items) {
      const itemId = si.itemId || si.item;
      if (!itemId) {
        return errorResponse(res, 'Item ID is required for each item', 400);
      }
      const item = await Item.findById(itemId);
      if (!item) {
        return errorResponse(res, `Item ${itemId} not found`, 404);
      }
      if (item.status !== 'In Stock') {
        return errorResponse(res, `Item ${item.SKU} is not in stock (status: ${item.status})`, 400);
      }
      const qty = si.quantity || si.qty || 1;
      const availableQty = item.quantity || 1;
      if (qty > availableQty) {
        return errorResponse(res, `Item ${item.SKU} only has ${availableQty} in stock`, 400);
      }
      item.quantity = availableQty - qty;
      if (item.quantity <= 0) {
        item.quantity = 0;
        item.status = 'Sold';
      }
      await item.save();
      updatedItems.push(item);
      saleItems.push({ item: item._id, quantity: qty, weight: si.weight || item.grossWeight || 0, price: si.price || item.sellingPrice || 0, purity: si.purity || item.purity || 0, makingCharge: si.makingCharge || si.sellingMakingCharge || 0, wastagePercent: si.wastagePercent || si.sellingWastagePercent || 5, ratePerGram: si.ratePerGram || 0, metalValue: si.metalValue || 0, stonePrice: si.stonePrice || 0 });
      if (item.metalType === 'diamond') diamondAmount += qty * (si.price || item.sellingPrice || 0);
      await StockMovement.create({
        item: item._id,
        type: 'stockOut',
        category: 'Sale',
        quantity: qty,
        weight: si.weight || item.grossWeight || 0,
        purity: item.purity || 0,
        reference: saleNumber,
        notes: `Sold in sale ${saleNumber}`,
        performedBy: req.user._id,
      });
    }
    const ogd = oldGoldDetails || paymentBreakdown?.oldGold || null;
    const diamondRate = await diamondRateFor(diamondAmount);
    const goldAmount = Number((Number(totalAmount) - diamondAmount).toFixed(2));
    const { serviceFee, diamondVat, totalTaxAmount, taxes } = computeTaxes(goldAmount, diamondAmount, diamondRate);
    let discount = Number(discountAmount) || 0;
    if (!discount && actualAmountReceived !== undefined && actualAmountReceived !== null && Number(actualAmountReceived) >= 0) {
      const received = Number(actualAmountReceived);
      const billTotal = Number(totalAmount) + totalTaxAmount;
      if (received < billTotal) {
        discount = Number((billTotal - received).toFixed(2));
      }
    }
    const adjustedTotal = Number((Number(totalAmount) + totalTaxAmount - discount).toFixed(2));
    const cash = Number(cashAmount || paymentBreakdown?.cash || 0);
    const khaata = Number(khaataAmount || paymentBreakdown?.khaata || 0);
    const methods = sanitizePaymentMethods(paymentMethods, cash);
    const saleData = {
      saleNumber,
      items: saleItems,
      paymentType,
      cashAmount: cash,
      khaataAmount: khaata,
      paymentMethods: methods,
      oldGoldDetails: ogd ? { description: '', weight: ogd.weight || 0, purity: ogd.purity || 0, deductionPercent: ogd.deductionPercent || 0, netWeight: ogd.netWeight || 0, value: ogd.value || 0, valuedAmount: ogd.valuedAmount || 0, deductibleAmount: ogd.deduction || ogd.deductibleAmount || 0 } : { description: '', weight: 0, purity: 0, deductionPercent: 0, netWeight: 0, value: 0, valuedAmount: 0, deductibleAmount: 0 },
      taxDetails: {
        totalTax: totalTaxAmount,
        discountAmount: discount,
        taxes,
      },
      totalAmount,
      diamondAmount: Number(diamondAmount.toFixed(2)),
      paidAmount: paidAmount !== undefined ? paidAmount : (paymentType === 'cash' ? adjustedTotal : 0),
      actualAmountReceived: actualAmountReceived !== undefined ? Number(actualAmountReceived) : undefined,
      discountAmount: discount,
      customer: customerId || customerField || null,
      soldBy: req.user._id,
      cashierName: cashierName ? String(cashierName).trim() : '',
      saleDate: saleDate || new Date(),
    };
    const sale = await Sale.create(saleData);
    const resolvedCustomer = customerId || customerField;
    const outstandingBalance = adjustedTotal - (paidAmount !== undefined ? paidAmount : (paymentType === 'cash' ? adjustedTotal : 0));
    if ((paymentType === 'khaata' || paymentType === 'partial') && resolvedCustomer) {
      const balance = outstandingBalance;
      if (balance > 0) {
        const customer = await Customer.findById(resolvedCustomer);
        if (customer) {
          const lastLedger = await CustomerLedger.findOne({ customer: resolvedCustomer }).sort({ transactionDate: -1 });
          const prevBalance = lastLedger ? lastLedger.balanceAfter : 0;
          await CustomerLedger.create({
            customer: resolvedCustomer,
            transactionType: 'credit',
            reference: saleNumber,
            referenceModel: 'Sale',
            referenceId: sale._id,
            amount: balance,
            balanceAfter: prevBalance + balance,
            note: `Sale ${saleNumber} - ${paymentType} payment`,
            transactionDate: new Date(),
          });
        }
      }
    }
    await ActivityLog.create({
      action: 'create',
      module: 'pos',
      description: `Sale ${saleNumber} created. Amount: ${totalAmount}`,
      performedBy: req.user._id,
      referenceId: sale._id,
      referenceModel: 'Sale',
    });
    await recordOldGoldPurchase(sale, sale.oldGoldDetails, req).catch((e) => {
      console.error(`Failed to record old gold purchase for sale ${saleNumber}:`, e.message);
    });
    return successResponse(res, sale, 'Sale created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate, dateFrom, dateTo, paymentType, customer, search, sort: sortField, order: sortOrder } = req.query;
    const query = {};
    if (paymentType) query.paymentType = paymentType;
    if (customer) query.customer = customer;
    const sd = startDate || dateFrom;
    const ed = endDate || dateTo;
    if (sd || ed) {
      query.saleDate = {};
      if (sd) query.saleDate.$gte = new Date(sd);
      if (ed) query.saleDate.$lte = new Date(ed);
    }
    if (search) {
      query.$or = [
        { saleNumber: { $regex: search, $options: 'i' } },
      ];
    }
    const sortObj = {};
    if (sortField) {
      sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj.saleDate = -1;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [sales, total] = await Promise.all([
      Sale.find(query).populate('items.item', 'SKU itemName category metalType purity').populate('customer', 'name phone customerCode').populate('soldBy', 'name').sort(sortObj).skip(skip).limit(Number(limit)),
      Sale.countDocuments({ ...query, isDeleted: false }),
    ]);
    return paginatedResponse(res, sales, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('items.item', 'SKU itemName category metalType purity grossWeight netMetalWeight stoneWeight karat hsCode carat images itemType').populate('customer', 'name phone customerCode address').populate('soldBy', 'name email');
    if (!sale) {
      return errorResponse(res, 'Sale not found', 404);
    }
    return successResponse(res, sale);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return errorResponse(res, 'Sale not found', 404);
    }
    if (sale.isDeleted) {
      return errorResponse(res, 'Sale already deleted', 400);
    }
    for (const si of sale.items) {
      const item = await Item.findById(si.item);
      if (item) {
        item.quantity = (item.quantity || 0) + (si.quantity || 1);
        if (item.quantity > 0) item.status = 'In Stock';
        await item.save();
      }
      await StockMovement.create({
        item: si.item,
        type: 'stockIn',
        category: 'Sale Return',
        quantity: si.quantity || 1,
        weight: si.weight || 0,
        purity: si.purity || 0,
        reference: sale.saleNumber,
        notes: `Reversal of sale ${sale.saleNumber}`,
        performedBy: req.user._id,
      });
    }
    if (sale.customer && (sale.paymentType === 'khaata' || sale.paymentType === 'partial')) {
      const ledgerEntries = await CustomerLedger.find({ referenceId: sale._id, referenceModel: 'Sale' }).sort({ transactionDate: -1 });
      let lastBalance = 0;
      for (const entry of ledgerEntries) {
        lastBalance = entry.balanceAfter;
      }
      for (const entry of ledgerEntries.reverse()) {
        lastBalance -= entry.amount;
        await CustomerLedger.create({
          customer: sale.customer,
          transactionType: 'payment',
          reference: `Reversal-${sale.saleNumber}`,
          referenceModel: 'Sale',
          referenceId: sale._id,
          amount: entry.amount,
          balanceAfter: Math.max(0, lastBalance),
          note: `Reversal of sale ${sale.saleNumber}`,
          transactionDate: new Date(),
        });
      }
    }
    await reverseOldGoldPurchase(sale, req).catch((e) => {
      console.error(`Failed to reverse old gold purchase for sale ${sale.saleNumber}:`, e.message);
    });
    await sale.softDelete();
    await ActivityLog.create({
      action: 'delete',
      module: 'pos',
      description: `Sale ${sale.saleNumber} deleted and inventory reversed`,
      performedBy: req.user._id,
      referenceId: sale._id,
      referenceModel: 'Sale',
    });
    return successResponse(res, null, 'Sale deleted and inventory reversed');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// Unified POS checkout: accepts BOTH tagged items[] and loose lot lotLines[] in
// one request and records them as a single Sale. Tagged items are sold exactly
// as in createSale; loose lots go through the shared processLotLine pipeline
// (tolerance gate + stock deduction + LooseLotSale records) so the loose-lot
// reconciliation reports stay accurate.
exports.createCombinedSale = async (req, res) => {
  try {
    const {
      items, lotLines, paymentType, cashAmount, khaataAmount, oldGoldDetails,
      paymentBreakdown, paymentMethods, taxAmount, diamondTaxAmount, paidAmount,
      actualAmountReceived, discountAmount, customerId, customer: customerField,
      saleDate, cashierName,
    } = req.body;

    if (!paymentType) return errorResponse(res, 'Payment type is required', 400);
    const hasItems = Array.isArray(items) && items.length > 0;
    const hasLines = Array.isArray(lotLines) && lotLines.length > 0;
    if (!hasItems && !hasLines) {
      return errorResponse(res, 'At least one item or loose lot line is required', 400);
    }

    const saleCount = await Sale.countDocuments({ isDeleted: false });
    const saleNumber = `SALE-${String(saleCount + 1).padStart(5, '0')}`;

    const saleItems = [];
    let diamondAmount = 0;
    if (hasItems) {
      for (const si of items) {
        const itemId = si.itemId || si.item;
        if (!itemId) {
          return errorResponse(res, 'Item ID is required for each item', 400);
        }
        const item = await Item.findById(itemId);
        if (!item) {
          return errorResponse(res, `Item ${itemId} not found`, 404);
        }
        if (item.status !== 'In Stock') {
          return errorResponse(res, `Item ${item.SKU} is not in stock (status: ${item.status})`, 400);
        }
        const qty = si.quantity || si.qty || 1;
        const availableQty = item.quantity || 1;
        if (qty > availableQty) {
          return errorResponse(res, `Item ${item.SKU} only has ${availableQty} in stock`, 400);
        }
        item.quantity = availableQty - qty;
        if (item.quantity <= 0) {
          item.quantity = 0;
          item.status = 'Sold';
        }
        await item.save();
        saleItems.push({
          item: item._id,
          quantity: qty,
          weight: si.weight || item.grossWeight || 0,
          price: si.price || item.sellingPrice || 0,
          purity: si.purity || item.purity || 0,
          makingCharge: si.makingCharge || si.sellingMakingCharge || 0,
          wastagePercent: si.wastagePercent || si.sellingWastagePercent || 5,
          ratePerGram: si.ratePerGram || 0,
          metalValue: si.metalValue || 0,
          stonePrice: si.stonePrice || 0,
        });
        if (item.metalType === 'diamond') diamondAmount += qty * (si.price || item.sellingPrice || 0);
        await StockMovement.create({
          item: item._id,
          type: 'stockOut',
          category: 'Sale',
          quantity: qty,
          weight: si.weight || item.grossWeight || 0,
          purity: item.purity || 0,
          reference: saleNumber,
          notes: `Sold in sale ${saleNumber}`,
          performedBy: req.user._id,
        });
      }
    }

    const tolerance = await getTolerancePercent();
    const liveRates = {
      gold: await getLiveRatePerGram('gold'),
      silver: await getLiveRatePerGram('silver'),
    };
    const processed = [];
    if (hasLines) {
      for (const line of lotLines) {
        if (!line.lotId) continue;
        const result = await processLotLine(line, { saleNumber, performedBy: req.user._id, tolerance, liveRates });
        processed.push(result);
      }
    }
    if (saleItems.length === 0 && processed.length === 0) {
      return errorResponse(res, 'No valid item or lot lines to bill', 400);
    }

    processed.forEach((r) => {
      if (r.lot?.metalType === 'diamond') diamondAmount += r.price || 0;
    });

    const affectedItems = [...new Set(processed.map((r) => String(r.lot.item)).filter(Boolean))];
    if (affectedItems.length) {
      await Promise.all(affectedItems.map((id) => syncParentItemStock(id)));
    }

    const itemSubtotal = saleItems.reduce((s, si) => s + (Number(si.price) || 0) * (si.quantity || 1), 0);
    const lotSubtotal = processed.reduce((s, r) => s + r.price, 0);
    const subtotal = Number((itemSubtotal + lotSubtotal).toFixed(2));

    const diamondRate = await diamondRateFor(diamondAmount);
    const goldAmount = Number((subtotal - diamondAmount).toFixed(2));
    const { serviceFee, diamondVat, totalTaxAmount, taxes } = computeTaxes(goldAmount, diamondAmount, diamondRate);

    let discount = Number(discountAmount) || 0;
    if (!discount && actualAmountReceived !== undefined && actualAmountReceived !== null && Number(actualAmountReceived) >= 0) {
      const received = Number(actualAmountReceived);
      const billTotal = subtotal + totalTaxAmount;
      if (received < billTotal) discount = Number((billTotal - received).toFixed(2));
    }
    const adjustedTotal = Number((subtotal + totalTaxAmount - discount).toFixed(2));
    const cash = Number(cashAmount || paymentBreakdown?.cash || 0);
    const khaata = Number(khaataAmount || paymentBreakdown?.khaata || 0);
    const methods = sanitizePaymentMethods(paymentMethods, cash);
    const ogd = oldGoldDetails || paymentBreakdown?.oldGold || null;
    const resolvedCustomer = customerId || customerField || null;
    const paid = paidAmount !== undefined ? Number(paidAmount) : (paymentType === 'cash' ? adjustedTotal : 0);

    const sale = await Sale.create({
      saleNumber,
      items: [
        ...saleItems,
        ...processed.map((r) => ({
          item: r.lot.item,
          quantity: r.lotSale.piecesSold,
          weight: r.lotSale.actualWeightSold,
          price: r.price,
          purity: r.purity,
          makingCharge: r.makingCharge,
          wastagePercent: 0,
          ratePerGram: r.ratePerGram,
          metalValue: r.metalValue,
          stonePrice: 0,
        })),
      ],
      paymentType,
      cashAmount: cash,
      khaataAmount: khaata,
      paymentMethods: methods,
      oldGoldDetails: ogd
        ? { description: '', weight: ogd.weight || 0, purity: ogd.purity || 0, deductionPercent: ogd.deductionPercent || 0, netWeight: ogd.netWeight || 0, value: ogd.value || 0, valuedAmount: ogd.valuedAmount || 0, deductibleAmount: ogd.deduction || ogd.deductibleAmount || 0 }
        : { description: '', weight: 0, purity: 0, deductionPercent: 0, netWeight: 0, value: 0, valuedAmount: 0, deductibleAmount: 0 },
      taxDetails: { totalTax: totalTaxAmount, discountAmount: discount, taxes },
      totalAmount: subtotal,
      diamondAmount: Number(diamondAmount.toFixed(2)),
      paidAmount: paid,
      actualAmountReceived: actualAmountReceived !== undefined ? Number(actualAmountReceived) : undefined,
      discountAmount: discount,
      customer: resolvedCustomer,
      soldBy: req.user._id,
      cashierName: cashierName ? String(cashierName).trim() : '',
      saleDate: saleDate ? new Date(saleDate) : new Date(),
    });

    if (processed.length) {
      await LooseLotSale.updateMany(
        { saleNumber, invoice: null, _id: { $in: processed.map((r) => r.lotSale._id) } },
        { $set: { invoice: sale._id } }
      );
    }

    const outstanding = adjustedTotal - paid;
    if ((paymentType === 'khaata' || paymentType === 'partial') && resolvedCustomer && outstanding > 0) {
      const customer = await Customer.findById(resolvedCustomer);
      if (customer) {
        const lastLedger = await CustomerLedger.findOne({ customer: resolvedCustomer }).sort({ transactionDate: -1 });
        const prevBalance = lastLedger ? lastLedger.balanceAfter : 0;
        await CustomerLedger.create({
          customer: resolvedCustomer,
          transactionType: 'credit',
          reference: saleNumber,
          referenceModel: 'Sale',
          referenceId: sale._id,
          amount: outstanding,
          balanceAfter: prevBalance + outstanding,
          note: `Sale ${saleNumber} - ${paymentType} payment`,
          transactionDate: new Date(),
        });
      }
    }

    await ActivityLog.create({
      action: 'create',
      module: 'pos',
      description: `Sale ${saleNumber} created. Amount: ${subtotal}`,
      performedBy: req.user._id,
      referenceId: sale._id,
      referenceModel: 'Sale',
    });
    await recordOldGoldPurchase(sale, sale.oldGoldDetails, req).catch((e) => {
      console.error(`Failed to record old gold purchase for sale ${saleNumber}:`, e.message);
    });

    return successResponse(
      res,
      { sale, lines: processed.map((r) => ({ lot: r.lot, lotSale: r.lotSale })) },
      'Sale created successfully',
      201
    );
  } catch (error) {
    return errorResponse(res, error.message, error.status || 500);
  }
};
