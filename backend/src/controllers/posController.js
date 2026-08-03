const Sale = require('../models/Sale');
const Item = require('../models/Item');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Settings = require('../models/Settings');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');

function getTaxSettings(settings) {
  const ts = settings?.taxSettings || {};
  if (!ts.enabled && ts.enabled !== undefined) return null;
  return ts;
}

function getNepalTaxSettings(settings) {
  const ns = settings?.nepalTaxSettings || {};
  if (!ns.enabled) return null;
  return ns;
}

function calculateTaxes(totalAmount, taxSettings) {
  if (!taxSettings || !taxSettings.taxes || !Array.isArray(taxSettings.taxes) || taxSettings.taxes.length === 0) {
    return { taxes: [], totalTax: 0 };
  }
  const taxes = [];
  let totalTax = 0;
  for (const t of taxSettings.taxes) {
    const rate = Number(t.rate) || 0;
    const taxableAmount = totalAmount;
    const amount = Number((taxableAmount * rate / 100).toFixed(2));
    taxes.push({ name: t.name || 'Tax', rate, amount });
    totalTax += amount;
  }
  totalTax = Number(totalTax.toFixed(2));
  return { taxes, totalTax: Number(totalTax.toFixed(2)) };
}

function calculateNepalTaxes(totalAmount, nepalTaxSettings) {
  if (!nepalTaxSettings) {
    return { taxes: [], totalTax: 0, luxuryTax: 0, vatAmount: 0 };
  }
  const taxes = [];
  let totalTax = 0;
  let luxuryTax = 0;
  let vatAmount = 0;
  const luxuryRate = Number(nepalTaxSettings.luxuryTax) || 0;
  const vatRate = Number(nepalTaxSettings.vatRate) || 0;
  const vatEnabled = nepalTaxSettings.vatEnabled !== false;
  if (luxuryRate > 0) {
    const ltAmount = Number((totalAmount * luxuryRate / 100).toFixed(2));
    taxes.push({ name: 'Luxury Tax', rate: luxuryRate, amount: ltAmount });
    luxuryTax = ltAmount;
    totalTax += ltAmount;
  }
  if (vatEnabled && vatRate > 0) {
    const vatBase = totalAmount + luxuryTax;
    const vatAmt = Number((vatBase * vatRate / 100).toFixed(2));
    taxes.push({ name: 'VAT', rate: vatRate, amount: vatAmt });
    vatAmount = vatAmt;
    totalTax += vatAmt;
  }
  totalTax = Number(totalTax.toFixed(2));
  return { taxes, totalTax, luxuryTax, vatAmount };
}

exports.createSale = async (req, res) => {
  try {
    const { items, paymentType, cashAmount, khaataAmount, oldGoldDetails, paymentBreakdown, totalAmount, paidAmount, actualAmountReceived, discountAmount, customerId, customer: customerField, saleDate } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0 || !paymentType || !totalAmount) {
      return errorResponse(res, 'Items, payment type, and total amount are required', 400);
    }
    const saleCount = await Sale.countDocuments({ isDeleted: false });
    const saleNumber = `SALE-${String(saleCount + 1).padStart(5, '0')}`;
    const saleItems = [];
    const updatedItems = [];
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
      saleItems.push({ item: item._id, quantity: qty, weight: si.weight || item.grossWeight || 0, price: si.price || item.sellingPrice || 0, purity: si.purity || item.purity || 0, makingCharge: si.makingCharge || si.sellingMakingCharge || 0, wastagePercent: si.wastagePercent || si.sellingWastagePercent || 5, ratePerGram: si.ratePerGram || 0, metalValue: si.metalValue || 0 });
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
    const settings = await Settings.getSettings();
    const taxSettings = getTaxSettings(settings);
    const nepalTaxSettings = getNepalTaxSettings(settings);
    const { taxes, totalTax } = calculateTaxes(totalAmount, taxSettings);
    const { taxes: nepalTaxes, totalTax: nepalTotalTax, luxuryTax, vatAmount } = calculateNepalTaxes(totalAmount, nepalTaxSettings);
    const allTaxes = [...taxes, ...nepalTaxes];
    const totalTaxAmount = Number((totalTax + nepalTotalTax).toFixed(2));
    let discount = Number(discountAmount) || 0;
    if (actualAmountReceived !== undefined && actualAmountReceived !== null && Number(actualAmountReceived) >= 0) {
      const received = Number(actualAmountReceived);
      const billTotal = Number(totalAmount) + totalTaxAmount;
      if (received < billTotal) {
        discount = Number((billTotal - received).toFixed(2));
      }
    }
    const adjustedTotal = Number((Number(totalAmount) + totalTaxAmount - discount).toFixed(2));
    const cash = Number(cashAmount || paymentBreakdown?.cash || 0);
    const khaata = Number(khaataAmount || paymentBreakdown?.khaata || 0);
    const saleData = {
      saleNumber,
      items: saleItems,
      paymentType,
      cashAmount: cash,
      khaataAmount: khaata,
      oldGoldDetails: ogd ? { description: '', weight: ogd.weight || 0, purity: ogd.purity || 0, deductibleAmount: ogd.deduction || ogd.deductibleAmount || 0 } : { description: '', weight: 0, purity: 0, deductibleAmount: 0 },
      taxDetails: {
        totalTax: totalTaxAmount,
        discountAmount: discount,
        taxes: allTaxes,
        luxuryTax,
        vatAmount,
        nepalTaxEnabled: !!nepalTaxSettings,
      },
      totalAmount,
      paidAmount: paidAmount !== undefined ? paidAmount : (paymentType === 'cash' ? adjustedTotal : 0),
      actualAmountReceived: actualAmountReceived !== undefined ? Number(actualAmountReceived) : undefined,
      discountAmount: discount,
      customer: customerId || customerField || null,
      soldBy: req.user._id,
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
    const sale = await Sale.findById(req.params.id).populate('items.item', 'SKU itemName category metalType purity grossWeight images').populate('customer', 'name phone customerCode address').populate('soldBy', 'name email');
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
