const Rate = require('../models/Rate');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { ensureFreshRates } = require('../services/rateScraper');

exports.getRates = async (req, res) => {
  try {
    const { page = 1, limit = 20, metalType, startDate, endDate } = req.query;
    const query = {};
    if (metalType) query.metalType = metalType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [rates, total] = await Promise.all([
      Rate.find(query).sort({ date: -1 }).skip(skip).limit(Number(limit)),
      Rate.countDocuments({ ...query, isDeleted: false }),
    ]);
    return paginatedResponse(res, rates, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// Each metal stores a tola row and a gram row under the same date, so sorting by
// date alone left the winner to storage order — callers label this value
// "Per Tola", so ask for tola explicitly and fall back to whatever exists.
const latestFor = async (metalType) => {
  const tola = await Rate.findOne({ metalType, unit: 'tola' }).sort({ date: -1 });
  if (tola) return tola;
  return Rate.findOne({ metalType }).sort({ date: -1 });
};

exports.getLatestRates = async (req, res) => {
  try {
    // Opening the site pulls a fresh rate when today's is missing or predates the
    // 11:31 NPT cutoff. A no-op otherwise, and internally throttled, so this stays
    // a plain database read on every load except the first one after 11:31.
    await ensureFreshRates();

    const [goldRate, silverRate] = await Promise.all([latestFor('gold'), latestFor('silver')]);
    return successResponse(res, { gold: goldRate || null, silver: silverRate || null });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createRate = async (req, res) => {
  try {
    const { metalType, rate, unit, date } = req.body;
    if (!metalType || rate === undefined || rate === null || rate === '' || !unit) {
      return errorResponse(res, 'Metal type, rate, and unit are required', 400);
    }
    if (!Number.isFinite(Number(rate)) || Number(rate) < 0) {
      return errorResponse(res, 'Rate must be a valid non-negative number', 400);
    }
    const newRate = await Rate.create({ metalType, rate, unit, date: date || new Date() });
    await ActivityLog.create({
      action: 'create',
      module: 'rate',
      description: `${metalType} rate ${rate}/${unit} added`,
      performedBy: req.user._id,
      referenceId: newRate._id,
      referenceModel: 'Rate',
    });
    return successResponse(res, newRate, 'Rate added successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateRate = async (req, res) => {
  try {
    const { metalType, rate, unit, date } = req.body;
    const existing = await Rate.findById(req.params.id);
    if (!existing) {
      return errorResponse(res, 'Rate not found', 404);
    }
    if (metalType) existing.metalType = metalType;
    if (rate !== undefined) existing.rate = rate;
    if (unit) existing.unit = unit;
    if (date) existing.date = date;
    await existing.save();
    await ActivityLog.create({
      action: 'update',
      module: 'rate',
      description: `Rate updated: ${existing.metalType} ${existing.rate}/${existing.unit}`,
      performedBy: req.user._id,
      referenceId: existing._id,
      referenceModel: 'Rate',
    });
    return successResponse(res, existing, 'Rate updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteRate = async (req, res) => {
  return errorResponse(res, 'Gold and silver rates cannot be deleted', 400);
};
