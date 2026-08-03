const StockMovement = require('../models/StockMovement');
const { scopeAggregate } = require('../utils/tenant');
const Item = require('../models/Item');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');

exports.getStockMovements = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, category, startDate, endDate, item } = req.query;
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
      StockMovement.find(query).populate('item', 'SKU itemName category metalType purity').populate('performedBy', 'name email').sort({ movementDate: -1 }).skip(skip).limit(Number(limit)),
      StockMovement.countDocuments(query),
    ]);
    return paginatedResponse(res, movements, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createStockIn = async (req, res) => {
  try {
    const { itemId, category, quantity, weight, purity, reference, notes, movementDate } = req.body;
    if (!itemId || !category) {
      return errorResponse(res, 'Item ID and category are required', 400);
    }
    const item = await Item.findById(itemId);
    if (!item) {
      return errorResponse(res, 'Item not found', 404);
    }
    const validInCategories = ['Purchase', 'Manufacturing', 'Return from Karigar', 'Pawn Redemption', 'Sale Return', 'Transfer In', 'Adjustment'];
    if (!validInCategories.includes(category)) {
      return errorResponse(res, 'Invalid stock-in category', 400);
    }
    const movement = await StockMovement.create({
      item: itemId,
      type: 'stockIn',
      category,
      quantity: quantity || 1,
      weight: weight || item.grossWeight || 0,
      purity: purity || item.purity || 0,
      reference: reference || '',
      notes: notes || '',
      performedBy: req.user._id,
      movementDate: movementDate ? new Date(movementDate) : undefined,
    });
    item.quantity = (item.quantity || 0) + Number(quantity || 1);
    if (category === 'Pawn Redemption') {
      item.status = 'In Stock';
    }
    await item.save();
    await ActivityLog.create({
      action: 'stockIn',
      module: 'stock',
      description: `Stock in: ${item.SKU} - ${category}`,
      performedBy: req.user._id,
      referenceId: movement._id,
      referenceModel: 'StockMovement',
    });
    return successResponse(res, movement, 'Stock-in recorded successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createStockOut = async (req, res) => {
  try {
    const { itemId, category, quantity, weight, purity, reference, notes, movementDate } = req.body;
    if (!itemId || !category) {
      return errorResponse(res, 'Item ID and category are required', 400);
    }
    const item = await Item.findById(itemId);
    if (!item) {
      return errorResponse(res, 'Item not found', 404);
    }
    const validOutCategories = ['Sale', 'Branch Transfer', 'Damaged', 'With Karigar', 'Custom Order', 'Pawn Issuance', 'Melted', 'Purchase Return', 'Transfer Out', 'Adjustment'];
    if (!validOutCategories.includes(category)) {
      return errorResponse(res, 'Invalid stock-out category', 400);
    }
    const movement = await StockMovement.create({
      item: itemId,
      type: 'stockOut',
      category,
      quantity: quantity || 1,
      weight: weight || item.grossWeight || 0,
      purity: purity || item.purity || 0,
      reference: reference || '',
      notes: notes || '',
      performedBy: req.user._id,
      movementDate: movementDate ? new Date(movementDate) : undefined,
    });
    const statusMap = {
      'Sale': 'Sold',
      'Branch Transfer': 'Branch Transfer',
      'Damaged': 'Damaged',
      'With Karigar': 'With Karigar',
      'Pawn Issuance': 'Pawn Collateral',
      'Melted': 'Melted',
    };
    item.quantity = Math.max(0, (item.quantity || 0) - Number(quantity || 1));
    if (category === 'Sale') {
      if (item.quantity <= 0) {
        item.status = 'Sold';
      }
    } else if (statusMap[category]) {
      item.status = statusMap[category];
    }
    await item.save();
    await ActivityLog.create({
      action: 'stockOut',
      module: 'stock',
      description: `Stock out: ${item.SKU} - ${category}`,
      performedBy: req.user._id,
      referenceId: movement._id,
      referenceModel: 'StockMovement',
    });
    return successResponse(res, movement, 'Stock-out recorded successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getStockHistory = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const query = { item: itemId };
    const skip = (Number(page) - 1) * Number(limit);
    const [movements, total] = await Promise.all([
      StockMovement.find(query).populate('performedBy', 'name').sort({ movementDate: -1 }).skip(skip).limit(Number(limit)),
      StockMovement.countDocuments(query),
    ]);
    return paginatedResponse(res, movements, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getStockSummary = async (req, res) => {
  try {
    const [byStatus, byMetalType, byCategory] = await Promise.all([
      Item.aggregate(scopeAggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 }, totalWeight: { $sum: '$grossWeight' } } },
        { $sort: { _id: 1 } },
      ])),
      Item.aggregate(scopeAggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$metalType', count: { $sum: 1 }, totalWeight: { $sum: '$grossWeight' } } },
        { $sort: { _id: 1 } },
      ])),
      Item.aggregate(scopeAggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$category', count: { $sum: 1 }, totalWeight: { $sum: '$grossWeight' }, totalCost: { $sum: '$costPrice' } } },
        { $sort: { _id: 1 } },
      ])),
    ]);
    return successResponse(res, { byStatus, byMetalType, byCategory });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
