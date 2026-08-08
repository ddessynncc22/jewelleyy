const Refine = require('../models/Refine');
const Purchase = require('../models/Purchase');
const Rate = require('../models/Rate');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { toPerGramRate } = require('../utils/rates');
const { getNextRefineNumber } = require('../services/sequence');
const { recordRefinedStock } = require('../services/refinedStock');

const METAL_LABEL = { gold: 'Gold', silver: 'Silver' };

const round = (n, decimals = 2) => {
  const f = Math.pow(10, decimals);
  return Math.round((Number(n) || 0) * f) / f;
};

async function latestPerGram(metalType) {
  const tola = await Rate.findOne({ metalType, unit: 'tola' }).sort({ date: -1 }).lean();
  const row = tola || (await Rate.findOne({ metalType }).sort({ date: -1 }).lean());
  return toPerGramRate(row);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
exports.getRefines = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, startDate, endDate } = req.query;
    const query = {};
    if (status && ['pending', 'received'].includes(status)) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(`${startDate}T00:00:00.000`);
      if (endDate) query.createdAt.$lte = new Date(`${endDate}T23:59:59.999`);
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ refineNumber: regex }, { description: regex }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [rows, total] = await Promise.all([
      Refine.find(query)
        .populate('purchaseId', 'purchaseNumber type supplierName customerName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Refine.countDocuments(query),
    ]);
    return paginatedResponse(res, rows, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Refine candidates — unrefined gold items bought from customers, offered on
// the Refine page so they can be auto-selected when creating an entry.
// ---------------------------------------------------------------------------
exports.getRefineCandidates = async (req, res) => {
  try {
    const purchases = await Purchase.find({
      type: 'customer',
      'items.refineStatus': 'none',
      'items.metalType': 'gold',
    })
      .select('purchaseNumber customerName date items')
      .sort({ date: -1, createdAt: -1 })
      .limit(50)
      .lean();

    const candidates = [];
    for (const purchase of purchases) {
      purchase.items.forEach((item, index) => {
        if (item.refineStatus === 'none' && item.metalType === 'gold') {
          candidates.push({
            purchaseId: purchase._id,
            purchaseItemIndex: index,
            purchaseNumber: purchase.purchaseNumber,
            customerName: purchase.customerName || 'Walk-in customer',
            purchaseDate: purchase.date,
            metalType: item.metalType,
            purityPercent: item.purityPercent,
            karat: item.karat,
            grossWeightG: item.grossWeightG,
            fineWeightG: item.fineWeightG,
            deductionPercent: item.deductionPercent || 0,
            givenWeightG: item.givenWeightG || item.fineWeightG,
            description: item.description,
          });
        }
      });
    }

    return successResponse(res, candidates);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Create — either manual ("create a refine material on their own") or linked
// to a purchase item line (send-to-refine).
// ---------------------------------------------------------------------------
exports.createRefine = async (req, res) => {
  try {
    const { purchaseId, purchaseItemIndex, metalType = 'gold', description, actualWeightG, givenWeightG, purityPercent, karat, notes } = req.body;
    if (actualWeightG === undefined || actualWeightG === '' || Number(actualWeightG) < 0) {
      return errorResponse(res, 'Actual gold weight is required', 400);
    }
    if (givenWeightG === undefined || givenWeightG === '' || Number(givenWeightG) < 0) {
      return errorResponse(res, 'Gold weight given to customer is required', 400);
    }

    let purchase = null;
    let item = null;
    if (purchaseId) {
      purchase = await Purchase.findById(purchaseId);
      if (!purchase) return errorResponse(res, 'Purchase not found', 404);
      if (purchaseItemIndex === undefined || !purchase.items[purchaseItemIndex]) {
        return errorResponse(res, 'Invalid purchase item index', 400);
      }
      item = purchase.items[purchaseItemIndex];
      if (item.refineStatus === 'pending' || item.refineStatus === 'refined') {
        return errorResponse(res, 'This purchase item is already sent to refine', 400);
      }
    }

    const refineNumber = await getNextRefineNumber(req.tenantId);
    const metal = purchase ? item.metalType : metalType;
    const rateAtIssue = await latestPerGram(metal);
    const refine = await Refine.create({
      refineNumber,
      sourceType: purchase ? 'purchase' : 'manual',
      purchaseId: purchase ? purchase._id : null,
      purchaseItemIndex: purchase ? Number(purchaseItemIndex) : -1,
      metalType: metal,
      description: description || (item ? `${METAL_LABEL[item.metalType]} ${item.purityPercent} — ${purchase.purchaseNumber}` : ''),
      actualWeightG: Number(actualWeightG),
      givenWeightG: Number(givenWeightG),
      purityPercent: purchase ? item.purityPercent : Number(purityPercent) || 0,
      karat: purchase ? item.karat : Number(karat) || 0,
      status: 'pending',
      ratePerGram: rateAtIssue,
      rateLockedAt: new Date(),
      notes: notes || '',
    });

    // Link the purchase line back to this refine entry.
    if (purchase) {
      purchase.items[purchaseItemIndex].refineStatus = 'pending';
      purchase.items[purchaseItemIndex].refineId = refine._id;
      await purchase.save();
    }

    // Physical movement: gold leaves the shop for the refinery.
    await StockMovement.create({
      item: null,
      type: 'stockOut',
      category: 'Refinery',
      quantity: 1,
      weight: Number(actualWeightG),
      purity: purchase ? item.purityPercent : Number(purityPercent) || 0,
      reference: refineNumber,
      notes: `Sent to refinery: ${description || refine.description} (${refineNumber})`,
      performedBy: req.user._id,
    });

    await ActivityLog.create({
      action: 'create',
      module: 'refine',
      description: `Refine ${refineNumber} created — ${actualWeightG} g given (${purchase ? 'from ' + purchase.purchaseNumber : 'manual'})`,
      performedBy: req.user._id,
      referenceId: refine._id,
      referenceModel: 'Refine',
    });

    return successResponse(res, refine, 'Refine entry created', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Receive — the refinery returns the gold. Entered on a later visit.
// Profit = received - given, valued at the rate locked on this receive.
// ---------------------------------------------------------------------------
exports.receiveRefine = async (req, res) => {
  try {
    const refine = await Refine.findById(req.params.id);
    if (!refine) return errorResponse(res, 'Refine entry not found', 404);
    if (refine.status === 'received') return errorResponse(res, 'Refine entry already received', 400);

    const { receivedWeightG, receivedPurity, receivedDate } = req.body;
    if (receivedWeightG === undefined || receivedWeightG === '' || Number(receivedWeightG) < 0) {
      return errorResponse(res, 'Received gold weight is required', 400);
    }

    // Profit is booked at the rate locked when the item was issued to the
    // refinery — never at today's (changing) rate.
    const profitG = round(Number(receivedWeightG) - refine.givenWeightG, 4);
    const profitAmount = round(profitG * (refine.ratePerGram || 0));

    refine.status = 'received';
    refine.receivedWeightG = Number(receivedWeightG);
    refine.receivedPurity = Number(receivedPurity) || 0;
    refine.receivedDate = receivedDate ? new Date(receivedDate) : new Date();
    refine.profitG = profitG;
    refine.profitAmount = profitAmount;
    await refine.save();

    // Mark the originating purchase line as refined.
    if (refine.purchaseId) {
      const purchase = await Purchase.findById(refine.purchaseId);
      if (purchase && purchase.items[refine.purchaseItemIndex]) {
        const item = purchase.items[refine.purchaseItemIndex];
        item.refineStatus = 'refined';
        await purchase.save();
      }
    }

    // Refined gold returns and is added to the refined-gold stock.
    await recordRefinedStock({
      tenantId: req.tenantId,
      performedBy: req.user._id,
      type: 'in',
      source: 'refine',
      sourceId: refine._id,
      referenceNumber: refine.refineNumber,
      weightG: Number(receivedWeightG),
      note: `Refinery returned ${receivedWeightG} g for ${refine.refineNumber}`,
      date: refine.receivedDate,
    });

    await StockMovement.create({
      item: null,
      type: 'stockIn',
      category: 'Refinery',
      quantity: 1,
      weight: Number(receivedWeightG),
      purity: Number(receivedPurity) || 999,
      reference: refine.refineNumber,
      notes: `Received from refinery: ${refine.refineNumber} (${receivedWeightG} g)`,
      performedBy: req.user._id,
    });

    await ActivityLog.create({
      action: 'receive',
      module: 'refine',
      description: `Refine ${refine.refineNumber} received — ${receivedWeightG} g back (profit ${profitG} g / ${profitAmount})`,
      performedBy: req.user._id,
      referenceId: refine._id,
      referenceModel: 'Refine',
    });

    return successResponse(res, refine, 'Refined gold received');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Delete. A received entry reverses the refined-gold stock it added.
// ---------------------------------------------------------------------------
exports.deleteRefine = async (req, res) => {
  try {
    const refine = await Refine.findById(req.params.id);
    if (!refine) return errorResponse(res, 'Refine entry not found', 404);

    // Unlink the purchase line.
    if (refine.purchaseId) {
      const purchase = await Purchase.findById(refine.purchaseId);
      if (purchase && purchase.items[refine.purchaseItemIndex]) {
        const item = purchase.items[refine.purchaseItemIndex];
        item.refineStatus = 'none';
        item.refineId = null;
        await purchase.save();
      }
    }

    // Reverse the stock the receive added (if it was received).
    if (refine.status === 'received' && refine.receivedWeightG > 0) {
      await recordRefinedStock({
        tenantId: req.tenantId,
        performedBy: req.user._id,
        type: 'out',
        source: 'reversal',
        sourceId: refine._id,
        referenceNumber: refine.refineNumber,
        weightG: refine.receivedWeightG,
        note: `Reversal of refine ${refine.refineNumber}`,
      });
    }

    await refine.softDelete();
    await ActivityLog.create({
      action: 'delete',
      module: 'refine',
      description: `Refine ${refine.refineNumber} deleted`,
      performedBy: req.user._id,
      referenceId: refine._id,
      referenceModel: 'Refine',
    });
    return successResponse(res, null, 'Refine entry deleted');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
