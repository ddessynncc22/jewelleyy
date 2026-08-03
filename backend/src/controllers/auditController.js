const ActivityLog = require('../models/ActivityLog');
const StockMovement = require('../models/StockMovement');
const { scopeAggregate } = require('../utils/tenant');
const Item = require('../models/Item');
const { escapeRegex } = require('../utils/helpers');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');

exports.getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, module, action, user, referenceId, startDate, endDate, search } = req.query;
    const query = {};
    if (module) query.module = module;
    if (action) query.action = action;
    if (user) query.performedBy = user;
    if (referenceId) query.referenceId = referenceId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { action: searchRegex },
        { module: searchRegex },
        { description: searchRegex },
        { 'metadata.email': searchRegex },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(query).populate('performedBy', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      ActivityLog.countDocuments(query),
    ]);
    return paginatedResponse(res, logs, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getInventoryLog = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, category, item, startDate, endDate } = req.query;
    const query = {};
    if (type) query.type = type;
    if (category) query.category = category;
    if (item) query.item = item;
    if (startDate || endDate) {
      query.movementDate = {};
      if (startDate) query.movementDate.$gte = new Date(startDate);
      if (endDate) query.movementDate.$lte = new Date(endDate);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [movements, total] = await Promise.all([
      StockMovement.find(query).populate('item', 'SKU itemName category metalType purity').populate('performedBy', 'name').sort({ movementDate: -1 }).skip(skip).limit(Number(limit)),
      StockMovement.countDocuments(query),
    ]);
    return paginatedResponse(res, movements, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getStockReconciliation = async (req, res) => {
  try {
    const [inMovements, outMovements, inStockItems] = await Promise.all([
      StockMovement.aggregate(scopeAggregate([
        { $match: { type: 'stockIn' } },
        { $group: { _id: '$item', totalIn: { $sum: { $ifNull: ['$quantity', 1] } } } },
      ])),
      StockMovement.aggregate(scopeAggregate([
        { $match: { type: 'stockOut' } },
        { $group: { _id: '$item', totalOut: { $sum: { $ifNull: ['$quantity', 1] } } } },
      ])),
      Item.find({ isDeleted: false, status: 'In Stock' }).select('SKU itemName status').lean(),
    ]);
    const inMap = {};
    inMovements.forEach((m) => { inMap[m._id.toString()] = m.totalIn; });
    const outMap = {};
    outMovements.forEach((m) => { outMap[m._id.toString()] = m.totalOut; });
    const discrepancies = [];
    for (const item of inStockItems) {
      const netIn = inMap[item._id.toString()] || 0;
      const netOut = outMap[item._id.toString()] || 0;
      if (netIn - netOut <= 0) {
        discrepancies.push({ item: { _id: item._id, SKU: item.SKU, itemName: item.itemName, status: item.status }, expectedQuantity: netIn - netOut, note: 'Item marked In Stock but no net inward movements' });
      }
    }
    return successResponse(res, {
      totalItemsChecked: inStockItems.length,
      discrepancies,
      totalDiscrepancies: discrepancies.length,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getDeletedRecords = async (req, res) => {
  try {
    const { model } = req.query;
    const results = {};
    const models = {
      Item: Item,
    };
    if (model && models[model]) {
      results[model] = await models[model].find({ isDeleted: true }).sort({ deletedAt: -1 }).limit(100).lean();
    } else {
      for (const [name, Model] of Object.entries(models)) {
        results[name] = await Model.find({ isDeleted: true }).sort({ deletedAt: -1 }).limit(50).lean();
      }
    }
    const logs = await ActivityLog.find({ action: 'delete' }).populate('performedBy', 'name').sort({ createdAt: -1 }).limit(50).lean();
    return successResponse(res, { deletedRecords: results, recentDeleteLogs: logs });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getSystemLog = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(query).populate('performedBy', 'name email').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      ActivityLog.countDocuments(query),
    ]);
    return paginatedResponse(res, logs, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
