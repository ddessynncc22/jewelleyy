const crypto = require('crypto');
const LooseLot = require('../models/LooseLot');
const LooseLotSale = require('../models/LooseLotSale');
const Item = require('../models/Item');
const Sale = require('../models/Sale');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Rate = require('../models/Rate');
const Settings = require('../models/Settings');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { toPerGramRate } = require('../utils/rates');
const { generateSKU } = require('../services/barcode');
const { escapeRegex } = require('../utils/helpers');
const { scopeAggregate } = require('../utils/tenant');

function makeLotBarcode() {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `LOOSE-${timestamp}${random}`;
}

function buildSaleNumber() {
  // Same counter style as posController.createSale.
  return Sale.countDocuments({ isDeleted: false }).then((count) => {
    return `SALE-${String(count + 1).padStart(5, '0')}`;
  });
}

// Live per-gram rate from the (global, un-tenant-scoped) Rate collection.
async function getLiveRatePerGram(metalType) {
  const latest = await Rate.findOne({ metalType }).sort({ date: -1 });
  return latest ? toPerGramRate(latest) : 0;
}

async function getTolerancePercent() {
  const settings = await Settings.getSettings();
  return Number(settings?.looseWeightTolerancePercent) || 15;
}

function metalValueOf(weight, ratePerGram, purity) {
  return Number((weight * ratePerGram * (purity / 1000)).toFixed(2));
}

// Diamond VAT rule: below a tenant's annual diamond-sales threshold the 0.5%
// service fee applies (same as gold/silver); once cumulative diamond sales for
// the year pass this amount, 13% VAT kicks in automatically.
const DIAMOND_VAT_THRESHOLD = 4900000;
const DIAMOND_VAT_RATE = 13;
const SERVICE_FEE_RATE = 0.5;

async function annualDiamondTotal() {
  const start = new Date(new Date().getFullYear(), 0, 1);
  const rows = await Sale.aggregate(
    scopeAggregate([
      { $match: { saleDate: { $gte: start } } },
      { $group: { _id: null, total: { $sum: '$diamondAmount' } } },
    ])
  );
  return rows[0]?.total || 0;
}

async function diamondRateFor(amount) {
  const past = await annualDiamondTotal();
  return past + amount > DIAMOND_VAT_THRESHOLD ? DIAMOND_VAT_RATE : SERVICE_FEE_RATE;
}

// Authoritative tax computation: gold/silver plus diamonds below the threshold
// are charged the 0.5% service fee; diamonds above the threshold get 13% VAT.
// Diamond taxes are emitted as their own line ('Service Fee (Diamond)' at 0.5%
// or 'VAT (Diamond)' at 13%) so reports can show the exact rate applied.
function computeTaxes(goldAmount, diamondAmount, diamondRate) {
  const vatMode = diamondRate >= DIAMOND_VAT_RATE;
  const goldFee = Number((goldAmount * SERVICE_FEE_RATE / 100).toFixed(2));
  const diamondFee = vatMode ? 0 : Number((diamondAmount * SERVICE_FEE_RATE / 100).toFixed(2));
  const diamondVat = vatMode ? Number((diamondAmount * DIAMOND_VAT_RATE / 100).toFixed(2)) : 0;
  const serviceFee = Number((goldFee + diamondFee).toFixed(2));
  const totalTax = Number((serviceFee + diamondVat).toFixed(2));
  const taxes = [];
  if (goldFee > 0) taxes.push({ name: 'Service Fee', rate: SERVICE_FEE_RATE, amount: goldFee });
  if (diamondFee > 0) taxes.push({ name: 'Service Fee (Diamond)', rate: SERVICE_FEE_RATE, amount: diamondFee });
  if (diamondVat > 0) taxes.push({ name: 'VAT (Diamond)', rate: DIAMOND_VAT_RATE, amount: diamondVat });
  return { serviceFee, diamondVat, totalTax, taxes };
}

exports.getDiamondVatStatus = async (req, res) => {
  try {
    const annualDiamond = await annualDiamondTotal();
    return successResponse(res, {
      threshold: DIAMOND_VAT_THRESHOLD,
      annualDiamondSales: Number(Number(annualDiamond).toFixed(2)),
      applies: annualDiamond > DIAMOND_VAT_THRESHOLD,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.diamondRateFor = diamondRateFor;
exports.computeTaxes = computeTaxes;

// Recompute the parent Item's available stock from its ACTIVE (sellable) lots,
// so the Items module and the loose-lot module never drift apart. Uses
// item.save() so the pre-save hook recomputes grossWeightInLaal too.
async function syncParentItemStock(itemId) {
  const [lots, item] = await Promise.all([
    LooseLot.find({ item: itemId, status: 'active' }),
    Item.findById(itemId),
  ]);
  if (!item) return;
  item.quantity = lots.reduce((sum, lot) => sum + (lot.remainingPieces || 0), 0);
  item.grossWeight = Number(lots.reduce((sum, lot) => sum + (lot.remainingWeight || 0), 0).toFixed(4));
  await item.save();
}

// Process one sale line against a lot: validates the quantity/weight, applies
// the tolerance gate, deducts stock, and records the LooseLotSale entry plus a
// StockMovement. Shared by POST /loose-lots/sell and POST /loose-lots/bill.
async function processLotLine(line, { sale = null, saleNumber = '', performedBy, tolerance, liveRates = {} }) {
  const lot = await LooseLot.findById(line.lotId);
  if (!lot) {
    const err = new Error('Loose lot not found');
    err.status = 404;
    throw err;
  }
  if (lot.status !== 'active') {
    throw new Error(`Lot ${lot.lotBarcode} is ${lot.status}`);
  }
  const pieces = Math.floor(Number(line.piecesSold));
  const actualWeight = Number(line.actualWeightSold);
  if (!pieces || pieces <= 0) throw new Error('piecesSold must be a positive integer');
  if (pieces > lot.remainingPieces) {
    throw new Error(`Only ${lot.remainingPieces} piece(s) remaining in lot ${lot.lotBarcode}`);
  }
  if (!actualWeight || actualWeight <= 0) throw new Error('actualWeightSold must be greater than 0');
  if (actualWeight > lot.remainingWeight) {
    throw new Error(`Only ${lot.remainingWeight.toFixed(3)} g remaining in lot ${lot.lotBarcode}`);
  }

  const expectedWeight = Number((lot.avgWeightPerPiece * pieces).toFixed(4));
  const deviationPercent =
    expectedWeight > 0
      ? Number((Math.abs(actualWeight - expectedWeight) / expectedWeight) * 100).toFixed(2)
      : 0;

  if (Number(deviationPercent) > tolerance) {
    if (!line.overrideReason || !line.managerApproved) {
      const err = new Error(
        `Weighed weight (${actualWeight.toFixed(3)} g) deviates ${deviationPercent}% from expected ` +
          `${expectedWeight.toFixed(3)} g — above the ${tolerance}% tolerance. Enter a reason and ` +
          'manager approval to proceed.'
      );
      err.code = 'WEIGHT_TOLERANCE_EXCEEDED';
      err.data = { deviationPercent: Number(deviationPercent), expectedWeight, actualWeight, tolerance };
      throw err;
    }
  }

  const weightSource = line.weightSource || 'manual_weighed';
  const ratePerGram =
    Number(line.ratePerGram) > 0 ? Number(line.ratePerGram) : (liveRates[lot.metalType] ?? await getLiveRatePerGram(lot.metalType));
  const purity = lot.purity || 0;
  const metalValue = metalValueOf(actualWeight, ratePerGram, purity);
  const makingCharge = Number(line.makingCharge) || 0;
  const price = Number((metalValue + makingCharge).toFixed(2));

  lot.remainingPieces -= pieces;
  lot.remainingWeight = Number((lot.remainingWeight - actualWeight).toFixed(4));
  if (lot.remainingPieces <= 0) {
    lot.remainingPieces = 0;
    lot.remainingWeight = 0;
    lot.status = 'closed';
  } else if (line.recalculateAvg !== false && lot.remainingPieces > 0) {
    lot.avgWeightPerPiece = Number((lot.remainingWeight / lot.remainingPieces).toFixed(4));
  }
  await lot.save();

  const lotSale = await LooseLotSale.create({
    lot: lot._id,
    invoice: sale?._id || null,
    saleNumber,
    piecesSold: pieces,
    actualWeightSold: actualWeight,
    expectedWeight,
    weightSource,
    deviationPercent: Number(deviationPercent),
    ratePerGram,
    metalValue,
    makingCharge,
    price,
    overrideReason: line.overrideReason || '',
    managerApproved: !!line.managerApproved,
    performedBy,
    soldAt: line.soldAt ? new Date(line.soldAt) : new Date(),
  });

  await StockMovement.create({
    item: null,
    type: 'stockOut',
    category: 'Sale',
    quantity: pieces,
    weight: actualWeight,
    purity,
    reference: saleNumber || lot.lotBarcode,
    notes: `Loose lot sale (${lot.lotBarcode})`,
    performedBy,
  });

  return { lotSale, lot, price, metalValue, makingCharge, ratePerGram, purity, deviationPercent: Number(deviationPercent), expectedWeight };
}

exports.listLots = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, metalType, purity, category, subcategory, lowStock } = req.query;
    const query = {};
    if (req.query.item) query.item = req.query.item;
    if (status) query.status = status;
    if (metalType) query.metalType = metalType;
    if (purity) query.purity = Number(purity);
    if (category) query.category = { $regex: escapeRegex(category), $options: 'i' };
    if (subcategory) query.subcategory = { $regex: escapeRegex(subcategory), $options: 'i' };
    if (search) {
      const searchRegex = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [
        { lotBarcode: searchRegex },
        { lotNumber: searchRegex },
        { designCode: searchRegex },
        { itemName: searchRegex },
      ];
    }
    if (lowStock === 'true' || lowStock === '1') {
      const lowStockOr = [
        { $expr: { $and: [{ $gt: ['$lowStockPiecesThreshold', 0] }, { $lte: ['$remainingPieces', '$lowStockPiecesThreshold'] }] } },
        { $expr: { $and: [{ $gt: ['$lowStockWeightThreshold', 0] }, { $lte: ['$remainingWeight', '$lowStockWeightThreshold'] }] } },
      ];
      if (query.$or) query.$or.push({ $or: lowStockOr });
      else query.$or = lowStockOr;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [lots, total] = await Promise.all([
      LooseLot.find(query)
        .populate('item', 'SKU itemName images itemType')
        .populate('karigarId', 'name phone specialization')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      LooseLot.countDocuments(query),
    ]);
    return paginatedResponse(res, lots, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getLot = async (req, res) => {
  try {
    const lot = await LooseLot.findById(req.params.id).populate('item').populate('karigarId', 'name phone specialization');
    if (!lot) return errorResponse(res, 'Loose lot not found', 404);
    const sales = await LooseLotSale.find({ lot: lot._id }).populate('performedBy', 'name').sort({ soldAt: -1 }).limit(100);
    return successResponse(res, { lot, sales });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getLotByBarcode = async (req, res) => {
  try {
    const lot = await LooseLot.findOne({ lotBarcode: req.params.barcode }).populate('item').populate('karigarId', 'name phone specialization');
    if (!lot) return errorResponse(res, 'Loose lot not found with this barcode', 404);
    return successResponse(res, lot);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

async function createLooseItem(data, totalGrossWeight, totalPieces) {
  const payload = {
    tenantId: data.tenantId,
    itemType: 'loose',
    SKU: generateSKU(data.category, data.metalType, data.purity),
    barcode: '',
    category: data.category,
    subcategory: data.subcategory || '',
    designCode: data.designCode || '',
    itemName: data.itemName || data.designCode || 'Loose Lot',
    metalType: data.metalType,
    purity: Number(data.purity),
    karat: Number(data.karat) || 0,
    length: Number(data.length) || 0,
    diameter: Number(data.diameter) || 0,
    grossWeight: Number(totalGrossWeight),
    quantity: Number(totalPieces),
    status: 'In Stock',
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await Item.create(payload);
    } catch (error) {
      if (error.code === 11000 && attempt < 2) {
        payload.SKU = generateSKU(data.category, data.metalType, data.purity);
        continue;
      }
      throw error;
    }
  }
}

exports.createLot = async (req, res) => {
  try {
    const {
      itemId, designCode, itemName, category, subcategory, metalType, purity, karat,
      karigarId, totalGrossWeight, totalPieces, lotBarcode, lotNumber,
      makingChargeType, makingChargeValue, ratePerGram,
      lowStockPiecesThreshold, lowStockWeightThreshold, notes,
      length, lengthUnit, diameter,
    } = req.body;

    if (!Number(totalGrossWeight) || Number(totalGrossWeight) <= 0) {
      return errorResponse(res, 'Total gross weight must be greater than 0', 400);
    }
    if (!Number(totalPieces) || Number(totalPieces) < 1) {
      return errorResponse(res, 'Total pieces must be at least 1', 400);
    }

    let item = null;
    if (itemId) {
      item = await Item.findById(itemId);
      if (!item) return errorResponse(res, 'Item not found', 404);
      if (item.itemType !== 'loose') {
        item.itemType = 'loose';
        await item.save();
      }
    } else {
      if (!category || !metalType || !purity) {
        return errorResponse(res, 'category, metalType, and purity are required when not linking an existing item', 400);
      }
        item = await createLooseItem(
        { tenantId: req.tenantId, category, subcategory, metalType, purity, karat, designCode, itemName, length, lengthUnit, diameter },
        totalGrossWeight,
        totalPieces
      );
    }

    // Try the caller's barcode first, otherwise generate one; retry on the
    // compound unique key (tenantId + lotBarcode).
    let finalBarcode = (lotBarcode || '').trim().toUpperCase();
    if (!finalBarcode) finalBarcode = makeLotBarcode();
    let lot;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        lot = await LooseLot.create({
          item: item._id,
          lotBarcode: finalBarcode,
          lotNumber: lotNumber || '',
          itemName: item.itemName || '',
          designCode: item.designCode || '',
          category: item.category || '',
          subcategory: item.subcategory || '',
          metalType: item.metalType,
          purity: item.purity,
           karat: item.karat || 0,
           karigarId: karigarId || null,
           length: Number(length) || 0,
           lengthUnit: lengthUnit || 'mm',
           diameter: Number(diameter) || 0,
          totalGrossWeight: Number(totalGrossWeight),
          totalPieces: Number(totalPieces),
          remainingPieces: Number(totalPieces),
          remainingWeight: Number(totalGrossWeight),
          ratePerGram: Number(ratePerGram) || 0,
          makingChargeType: makingChargeType || 'per_piece',
          makingChargeValue: Number(makingChargeValue) || 0,
          lowStockPiecesThreshold: Number(lowStockPiecesThreshold) || 0,
          lowStockWeightThreshold: Number(lowStockWeightThreshold) || 0,
          notes: notes || '',
          status: 'active',
        });
        break;
      } catch (error) {
        if (error.code === 11000 && attempt < 3) {
          finalBarcode = makeLotBarcode();
          continue;
        }
        throw error;
      }
    }

    await StockMovement.create({
      item: null,
      type: 'stockIn',
      category: 'Purchase',
      quantity: Number(totalPieces),
      weight: Number(totalGrossWeight),
      purity: item.purity,
      reference: lot.lotBarcode,
      notes: 'Loose lot created',
      performedBy: req.user._id,
    });

    await syncParentItemStock(item._id);
    await Item.updateOne({ _id: item._id }, { $set: { karigarId: karigarId || null } });

    await ActivityLog.create({
      action: 'create',
      module: 'loose-lot',
      description: `Loose lot ${lot.lotBarcode} created (${totalPieces} pcs, ${totalGrossWeight} g)`,
      performedBy: req.user._id,
      referenceId: lot._id,
      referenceModel: 'LooseLot',
    });

    return successResponse(res, await LooseLot.findById(lot._id).populate('item'), 'Loose lot created', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateLot = async (req, res) => {
  try {
    const lot = await LooseLot.findById(req.params.id);
    if (!lot) return errorResponse(res, 'Loose lot not found', 404);

    const allowed = [
      'designCode', 'itemName', 'category', 'subcategory', 'metalType', 'purity', 'karat', 'karigarId',
      'makingChargeType', 'makingChargeValue',
      'lowStockPiecesThreshold', 'lowStockWeightThreshold', 'notes', 'status',
      'length', 'lengthUnit', 'diameter',
    ];
    if (req.body.status === 'active' && lot.remainingPieces <= 0) {
      return errorResponse(res, 'Cannot reopen an empty lot', 400);
    }
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) lot[field] = req.body[field];
    });
    await lot.save();

    // Keep the parent loose Item's design fields in sync when they change here.
    const item = await Item.findById(lot.item);
    if (item) {
      const sync = ['designCode', 'itemName', 'category', 'subcategory', 'metalType', 'purity', 'karat', 'karigarId'];
      let changed = false;
      sync.forEach((field) => {
        if (req.body[field] !== undefined && String(item[field] || '') !== String(lot[field] || '')) {
          item[field] = lot[field];
          changed = true;
        }
      });
      if (changed) await item.save();
    }

    // Reflect status changes (reopen/close) on the parent Item's available stock.
    await syncParentItemStock(lot.item);

    await ActivityLog.create({
      action: 'update',
      module: 'loose-lot',
      description: `Loose lot ${lot.lotBarcode} updated`,
      performedBy: req.user._id,
      referenceId: lot._id,
      referenceModel: 'LooseLot',
    });
    return successResponse(res, await LooseLot.findById(lot._id).populate('item'), 'Loose lot updated');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteLot = async (req, res) => {
  try {
    const lot = await LooseLot.findById(req.params.id);
    if (!lot) return errorResponse(res, 'Loose lot not found', 404);
    await lot.softDelete();

    // If this was the last lot for its parent item, retire the parent item too
    // so it no longer appears in the Items module. Otherwise just refresh stock.
    const remainingLots = await LooseLot.countDocuments({ item: lot.item });
    if (remainingLots === 0) {
      const item = await Item.findById(lot.item);
      if (item) await item.softDelete();
    } else {
      await syncParentItemStock(lot.item);
    }

    await ActivityLog.create({
      action: 'delete',
      module: 'loose-lot',
      description: `Loose lot ${lot.lotBarcode} deleted`,
      performedBy: req.user._id,
      referenceId: lot._id,
      referenceModel: 'LooseLot',
    });
    return successResponse(res, null, 'Loose lot deleted');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.sellLots = async (req, res) => {
  try {
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [req.body];
    if (lines.length === 0 || lines.every((l) => !l.lotId)) {
      return errorResponse(res, 'At least one lot line is required', 400);
    }
    const tolerance = await getTolerancePercent();
    const results = [];
    for (const line of lines) {
      if (!line.lotId) continue;
      const result = await processLotLine(line, { performedBy: req.user._id, tolerance });
      results.push({ lotSale: result.lotSale, lot: result.lot });
    }

    const affectedItems = [...new Set(results.map((r) => String(r.lot.item)).filter(Boolean))];
    await Promise.all(affectedItems.map((id) => syncParentItemStock(id)));

    await ActivityLog.create({
      action: 'sale',
      module: 'loose-lot',
      description: `Sold ${results.length} loose lot line(s) without invoice`,
      performedBy: req.user._id,
    });
    return successResponse(res, results, 'Loose lot sale recorded', 201);
  } catch (error) {
    return errorResponse(res, error.message, error.status || 500);
  }
};

exports.createLooseBill = async (req, res) => {
  try {
    const {
      lines, paymentType, cashAmount, khaataAmount, paidAmount,
      actualAmountReceived, discountAmount, customerId, customer: customerField,
      saleDate, taxAmount, diamondTaxAmount,
    } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return errorResponse(res, 'Lines are required', 400);
    }
    if (!paymentType) return errorResponse(res, 'Payment type is required', 400);

    const tolerance = await getTolerancePercent();
    const liveRates = {
      gold: await getLiveRatePerGram('gold'),
      silver: await getLiveRatePerGram('silver'),
    };

    const processed = [];
    for (const line of lines) {
      if (!line.lotId) continue;
      const result = await processLotLine(line, { performedBy: req.user._id, tolerance, liveRates });
      processed.push(result);
    }
    if (processed.length === 0) {
      return errorResponse(res, 'No valid lot lines to bill', 400);
    }

    const affectedItems = [...new Set(processed.map((r) => String(r.lot.item)).filter(Boolean))];
    await Promise.all(affectedItems.map((id) => syncParentItemStock(id)));

    const saleNumber = await buildSaleNumber();
    const subtotal = Number(processed.reduce((sum, r) => sum + r.price, 0).toFixed(2));
    const diamondAmount = processed.reduce((s, r) => s + (r.lot?.metalType === 'diamond' ? (r.price || 0) : 0), 0);
    const diamondRate = await diamondRateFor(diamondAmount);
    const { serviceFee, diamondVat, totalTaxAmount, taxes } = computeTaxes(
      Number((subtotal - diamondAmount).toFixed(2)),
      diamondAmount,
      diamondRate
    );

    let discount = Number(discountAmount) || 0;
    if (!discount && actualAmountReceived !== undefined && actualAmountReceived !== null && Number(actualAmountReceived) >= 0) {
      const received = Number(actualAmountReceived);
      const billTotal = subtotal + totalTaxAmount;
      if (received < billTotal) discount = Number((billTotal - received).toFixed(2));
    }
    const adjustedTotal = Number((subtotal + totalTaxAmount - discount).toFixed(2));
    const cash = Number(cashAmount || 0);
    const khaata = Number(khaataAmount || 0);
    const resolvedCustomer = customerId || customerField || null;
    const paid =
      paidAmount !== undefined
        ? Number(paidAmount)
        : paymentType === 'cash'
          ? adjustedTotal
          : 0;

    const sale = await Sale.create({
      saleNumber,
      items: processed.map((r) => ({
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
      paymentType,
      cashAmount: cash,
      khaataAmount: khaata,
      oldGoldDetails: { description: '', weight: 0, purity: 0, deductionPercent: 0, netWeight: 0, deductibleAmount: 0 },
      taxDetails: { totalTax: totalTaxAmount, discountAmount: discount, taxes },
      totalAmount: subtotal,
      diamondAmount: Number(diamondAmount.toFixed(2)),
      paidAmount: paid,
      actualAmountReceived: actualAmountReceived !== undefined ? Number(actualAmountReceived) : undefined,
      discountAmount: discount,
      customer: resolvedCustomer,
      soldBy: req.user._id,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
    });

    // Attach the sale to the just-recorded lot-sale entries.
    await LooseLotSale.updateMany(
      { saleNumber: '', invoice: null, _id: { $in: processed.map((r) => r.lotSale._id) } },
      { $set: { saleNumber, invoice: sale._id } }
    );

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
          note: `Loose sale ${saleNumber} - ${paymentType} payment`,
          transactionDate: new Date(),
        });
      }
    }

    await ActivityLog.create({
      action: 'create',
      module: 'loose-pos',
      description: `Loose sale ${saleNumber} created. Amount: ${subtotal}`,
      performedBy: req.user._id,
      referenceId: sale._id,
      referenceModel: 'Sale',
    });

    return successResponse(res, { sale, lines: processed.map((r) => ({ lot: r.lot, lotSale: r.lotSale })) }, 'Sale completed', 201);
  } catch (error) {
    return errorResponse(res, error.message, error.status || 500);
  }
};

exports.getLooseBill = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('items.item', 'SKU itemName category metalType purity grossWeight netMetalWeight stoneWeight karat hsCode carat images')
      .populate('customer', 'name phone customerCode address')
      .populate('soldBy', 'name email');
    if (!sale) {
      return errorResponse(res, 'Sale not found', 404);
    }
    const lines = await LooseLotSale.find({ invoice: sale._id })
      .populate('lot', 'lotBarcode itemName designCode metalType purity avgWeightPerPiece')
      .sort({ soldAt: 1 });
    return successResponse(res, { sale, lines });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getLowStock = async (req, res) => {
  try {
    const lots = await LooseLot.find({
      status: 'active',
      $or: [
        { lowStockPiecesThreshold: { $gt: 0 }, $expr: { $lte: ['$remainingPieces', '$lowStockPiecesThreshold'] } },
        { lowStockWeightThreshold: { $gt: 0 }, $expr: { $lte: ['$remainingWeight', '$lowStockWeightThreshold'] } },
      ],
    }).populate('item', 'itemName SKU').sort({ remainingPieces: 1 });
    return successResponse(res, lots);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getStockReport = async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    const lots = await LooseLot.find(query).sort({ designCode: 1, lotBarcode: 1 });    const liveRates = {
      gold: await getLiveRatePerGram('gold'),
      silver: await getLiveRatePerGram('silver'),
    };

    let totalPieces = 0;
    let totalWeight = 0;
    let totalValue = 0;
    const rows = lots.map((lot) => {
      const ratePerGram = lot.ratePerGram || liveRates[lot.metalType] || 0;
      const value = metalValueOf(lot.remainingWeight, ratePerGram, lot.purity);
      totalPieces += lot.remainingPieces;
      totalWeight += lot.remainingWeight;
      totalValue += value;
      return {
        _id: lot._id,
        lotBarcode: lot.lotBarcode,
        lotNumber: lot.lotNumber,
        itemName: lot.itemName,
        designCode: lot.designCode,
        category: lot.category,
        metalType: lot.metalType,
        purity: lot.purity,
        karat: lot.karat,
        totalPieces: lot.totalPieces,
        remainingPieces: lot.remainingPieces,
        remainingWeight: lot.remainingWeight,
        avgWeightPerPiece: lot.avgWeightPerPiece,
        ratePerGram,
        value: Number(value.toFixed(2)),
        status: lot.status,
        lowStock:
          (lot.lowStockPiecesThreshold > 0 && lot.remainingPieces <= lot.lowStockPiecesThreshold) ||
          (lot.lowStockWeightThreshold > 0 && lot.remainingWeight <= lot.lowStockWeightThreshold),
        lowStockPiecesThreshold: lot.lowStockPiecesThreshold,
        lowStockWeightThreshold: lot.lowStockWeightThreshold,
      };
    });

    return successResponse(res, {
      rows,
      summary: {
        lots: rows.length,
        totalPieces,
        totalWeight: Number(totalWeight.toFixed(4)),
        totalValue: Number(totalValue.toFixed(2)),
        lowStockCount: rows.filter((r) => r.lowStock).length,
      },
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// Lightweight aggregate used by the Lots list header cards — returns summary
// numbers only, without building the full per-lot report rows.
exports.getStockSummary = async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    const [agg, lots, liveRates] = await Promise.all([
      LooseLot.aggregate(scopeAggregate([
        { $match: { isDeleted: false, ...query } },
        {
          $group: {
            _id: null,
            lots: { $sum: 1 },
            totalPieces: { $sum: '$remainingPieces' },
            totalWeight: { $sum: '$remainingWeight' },
          },
        },
      ])),
      LooseLot.find(query)
        .select('metalType ratePerGram remainingPieces remainingWeight purity lowStockPiecesThreshold lowStockWeightThreshold')
        .lean(),
      Promise.all([getLiveRatePerGram('gold'), getLiveRatePerGram('silver')]),
    ]);
    const live = { gold: liveRates[0], silver: liveRates[1] };
    let totalValue = 0;
    let lowStockCount = 0;
    for (const lot of lots) {
      totalValue += metalValueOf(lot.remainingWeight, lot.ratePerGram || live[lot.metalType] || 0, lot.purity);
      if (
        (lot.lowStockPiecesThreshold > 0 && lot.remainingPieces <= lot.lowStockPiecesThreshold) ||
        (lot.lowStockWeightThreshold > 0 && lot.remainingWeight <= lot.lowStockWeightThreshold)
      ) {
        lowStockCount += 1;
      }
    }
    return successResponse(res, {
      summary: {
        lots: lots.length,
        totalPieces: agg?.[0]?.totalPieces || 0,
        totalWeight: Number((agg?.[0]?.totalWeight || 0).toFixed(4)),
        totalValue: Number(totalValue.toFixed(2)),
        lowStockCount,
      },
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getDayEndReport = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    if (isNaN(date.getTime())) return errorResponse(res, 'Invalid date', 400);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400000);
    const tolerance = await getTolerancePercent();

    const [lots, saleAgg] = await Promise.all([
      LooseLot.find({}).sort({ designCode: 1, lotBarcode: 1 }).lean(),
      LooseLotSale.aggregate(scopeAggregate([
        { $match: { soldAt: { $gte: start, $lt: end }, isDeleted: false } },
        {
          $group: {
            _id: '$lot',
            soldPieces: { $sum: '$piecesSold' },
            soldWeight: { $sum: '$actualWeightSold' },
            expectedSoldWeight: { $sum: '$expectedWeight' },
          },
        },
      ])),
    ]);
    const saleByLot = new Map(saleAgg.map((r) => [String(r._id), r]));
    const rows = [];
    let totalOpeningWeight = 0;
    let totalSoldWeight = 0;
    let totalClosingWeight = 0;

    for (const lot of lots) {
      const saleInfo = saleByLot.get(String(lot._id)) || { soldPieces: 0, soldWeight: 0, expectedSoldWeight: 0 };
      const soldPieces = saleInfo.soldPieces;
      const soldWeight = Number(Number(saleInfo.soldWeight).toFixed(4));
      const expectedSoldWeight = Number(Number(saleInfo.expectedSoldWeight).toFixed(4));
      const deviationWeight = Number((soldWeight - expectedSoldWeight).toFixed(4));

      const createdToday = lot.createdAt >= start && lot.createdAt < end;
      const openingPieces = lot.remainingPieces + soldPieces - (createdToday ? lot.totalPieces : 0);
      const openingWeight = Number(
        (lot.remainingWeight + soldWeight - (createdToday ? lot.totalGrossWeight : 0)).toFixed(4)
      );
      const closingPieces = lot.remainingPieces;
      const closingWeight = Number(lot.remainingWeight.toFixed(4));

      const bookVariance = Number((openingWeight - closingWeight - soldWeight).toFixed(4));
      const flag =
        (expectedSoldWeight > 0 &&
          (Math.abs(deviationWeight) / expectedSoldWeight) * 100 > tolerance) ||
        Math.abs(bookVariance) > 0.001;

      totalOpeningWeight += openingWeight;
      totalSoldWeight += soldWeight;
      totalClosingWeight += closingWeight;

      rows.push({
        _id: lot._id,
        lotBarcode: lot.lotBarcode,
        itemName: lot.itemName,
        designCode: lot.designCode,
        purity: lot.purity,
        status: lot.status,
        openingPieces,
        openingWeight,
        soldPieces,
        soldWeight,
        expectedSoldWeight,
        deviationWeight,
        closingPieces,
        closingWeight,
        bookVariance,
        flagged: flag,
      });
    }

    return successResponse(res, {
      date: start.toISOString(),
      tolerance,
      rows,
      summary: {
        totalOpeningWeight: Number(totalOpeningWeight.toFixed(4)),
        totalSoldWeight: Number(totalSoldWeight.toFixed(4)),
        totalClosingWeight: Number(totalClosingWeight.toFixed(4)),
        flaggedCount: rows.filter((r) => r.flagged).length,
      },
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// Re-exported helpers so the unified POS checkout (posController) can reuse the
// loose-lot processing pipeline (tolerance gate, stock deduction, lot-sales).
exports.getLiveRatePerGram = getLiveRatePerGram;
exports.getTolerancePercent = getTolerancePercent;
exports.syncParentItemStock = syncParentItemStock;
exports.processLotLine = processLotLine;
