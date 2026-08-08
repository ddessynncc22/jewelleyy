const RefinedStockEntry = require('../models/RefinedStockEntry');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { recordRefinedStock } = require('../services/refinedStock');

// ---------------------------------------------------------------------------
// List — the full running ledger of refined (fine) gold stock.
// ---------------------------------------------------------------------------
exports.getEntries = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, source, startDate, endDate } = req.query;
    const query = {};
    if (type && ['in', 'out'].includes(type)) query.type = type;
    if (source) query.source = source;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(`${startDate}T00:00:00.000`);
      if (endDate) query.date.$lte = new Date(`${endDate}T23:59:59.999`);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [rows, total] = await Promise.all([
      RefinedStockEntry.find(query)
        .populate('performedBy', 'name')
        .sort({ date: -1, _id: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      RefinedStockEntry.countDocuments(query),
    ]);
    return paginatedResponse(res, rows, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Create — manual ledger entry. Used to bring OLD refined stock (gold the
// shop already had before this system) onto the books, and for corrections.
// ---------------------------------------------------------------------------
exports.createEntry = async (req, res) => {
  try {
    const { type, weightG, note, referenceNumber, date } = req.body;
    if (!['in', 'out'].includes(type)) return errorResponse(res, 'Type must be in or out', 400);
    if (weightG === undefined || weightG === '' || Number(weightG) <= 0) {
      return errorResponse(res, 'A positive weight is required', 400);
    }

    const entry = await recordRefinedStock({
      tenantId: req.tenantId,
      performedBy: req.user._id,
      type,
      source: 'manual',
      referenceNumber: (referenceNumber || '').trim(),
      weightG: Number(weightG),
      note: note || '',
      date: date ? new Date(date) : new Date(),
    });

    await ActivityLog.create({
      action: 'create',
      module: 'refined-stock',
      description: `Manual refined stock ${type === 'in' ? 'added' : 'removed'} — ${weightG} g${referenceNumber ? ` (${referenceNumber})` : ''}`,
      performedBy: req.user._id,
      referenceId: entry._id,
      referenceModel: 'RefinedStockEntry',
    });

    return successResponse(res, entry, `Refined stock ${type === 'in' ? 'added' : 'removed'}`, 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
