const Item = require('../models/Item');
const { scopeAggregate } = require('../utils/tenant');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const Rate = require('../models/Rate');
const Settings = require('../models/Settings');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { generateBarcode, generateSKU } = require('../services/barcode');
const { escapeRegex } = require('../utils/helpers');

exports.getItems = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, metalType, purity, karat, karigarId, sort, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (category) query.category = { $regex: category, $options: 'i' };
    if (metalType) query.metalType = metalType;
    if (purity) query.purity = Number(purity);
    if (karat) query.karat = Number(karat);
    if (karigarId) query.karigarId = karigarId;
    if (search) {
      const searchRegex = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [
        { SKU: searchRegex },
        { barcode: searchRegex },
        { designCode: searchRegex },
        { itemName: searchRegex },
      ];
    }
    const sortOption = sort ? sort.split(',').join(' ') : '-createdAt';
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Item.find(query).sort(sortOption).skip(skip).limit(Number(limit)),
      Item.countDocuments({ ...query, isDeleted: false }),
    ]);
    return paginatedResponse(res, items, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return errorResponse(res, 'Item not found', 404);
    }
    return successResponse(res, item);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

const createItemWithRetry = async (data, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      data.SKU = generateSKU(data.category, data.metalType, data.purity);
      data.barcode = generateBarcode();
      return await Item.create(data);
    } catch (error) {
      if (error.code === 11000 && attempt < retries - 1) continue;
      throw error;
    }
  }
};

exports.createItem = async (req, res) => {
  try {
    const { category, metalType, purity, karat, itemName, grossWeight, stoneWeight, netMetalWeight, designCode, description, stoneType, carat, cut, clarity, certificationNumber, costPrice, costMakingCharge, costWastagePercent, costStonePrice, sellingPrice, sellingMakingCharge, sellingWastagePercent, sellingStonePrice, makingCharge, wastagePercent, tags, status, currentLocation, quantity, karigarId } = req.body;
    if (!category || !metalType || !purity || !itemName || !grossWeight) {
      return errorResponse(res, 'Category, metalType, purity, itemName, and grossWeight are required', 400);
    }
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((f) => `${req.uploadBaseUrl}/${f.filename}`);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create item', 400);
    const item = await createItemWithRetry({
      tenantId: req.tenantId, category, metalType, purity, karat, itemName, grossWeight, stoneWeight, netMetalWeight, designCode, description, stoneType, carat, cut, clarity, certificationNumber, costPrice, costMakingCharge: costMakingCharge || 0, costWastagePercent: costWastagePercent || 0, costStonePrice: costStonePrice || 0, sellingPrice, sellingMakingCharge: sellingMakingCharge || 0, sellingWastagePercent: sellingWastagePercent || 0, sellingStonePrice: sellingStonePrice || 0, makingCharge: makingCharge || 0, wastagePercent: wastagePercent || 0, tags: tags || [], images, status: status || 'In Stock', currentLocation, quantity: quantity || 1, karigarId: karigarId || null,
    });
    await StockMovement.create({
      item: item._id,
      type: 'stockIn',
      category: 'Purchase',
      quantity: 1,
      weight: grossWeight,
      purity,
      notes: 'Item created',
      performedBy: req.user._id,
    });
    await ActivityLog.create({
      action: 'create',
      module: 'item',
      description: `Item ${item.SKU} created`,
      performedBy: req.user._id,
      referenceId: item._id,
      referenceModel: 'Item',
    });
    return successResponse(res, item, 'Item created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};


exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return errorResponse(res, 'Item not found', 404);
    }
    const allowedFields = ['category', 'metalType', 'purity', 'karat', 'itemName', 'grossWeight', 'stoneWeight', 'netMetalWeight', 'designCode', 'description', 'stoneType', 'carat', 'cut', 'clarity', 'certificationNumber', 'costPrice', 'costMakingCharge', 'costWastagePercent', 'costStonePrice', 'sellingPrice', 'sellingMakingCharge', 'sellingWastagePercent', 'sellingStonePrice', 'makingCharge', 'wastagePercent', 'tags', 'status', 'currentLocation', 'quantity', 'karigarId'];
    const previousStatus = item.status;
    const previousQuantity = item.quantity || 0;
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'costPrice' || field === 'sellingPrice' || field === 'costStonePrice' || field === 'sellingStonePrice') {
          const oldVal = item[field];
          const newVal = Number(req.body[field]);
          if (oldVal !== newVal) {
            item.priceHistory.push({ field, oldValue: oldVal, newValue: newVal, changedBy: req.user._id, changedAt: new Date() });
          }
        }
        item[field] = field === 'karigarId' ? req.body[field] || null : req.body[field];
      }
    });
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((f) => `${req.uploadBaseUrl}/${f.filename}`);
      item.images = [...item.images, ...newImages];
    }
    if (req.body.removeImages) {
      const removeList = Array.isArray(req.body.removeImages) ? req.body.removeImages : [req.body.removeImages];
      item.images = item.images.filter((img) => !removeList.includes(img));
    }
    if (req.body.images && Array.isArray(req.body.images)) {
      item.images = req.body.images;
    }
    await item.save();
    if (req.body.status && req.body.status !== previousStatus) {
      await StockMovement.create({
        item: item._id,
        type: req.body.status === 'In Stock' ? 'stockIn' : 'stockOut',
        category: 'Adjustment',
        quantity: item.quantity || 1,
        weight: item.grossWeight,
        purity: item.purity,
        notes: `Status changed from ${previousStatus} to ${req.body.status}`,
        performedBy: req.user._id,
      });
    }
    const newQuantity = item.quantity || 0;
    if (req.body.quantity !== undefined && Number(req.body.quantity) !== previousQuantity) {
      const delta = newQuantity - previousQuantity;
      await StockMovement.create({
        item: item._id,
        type: delta > 0 ? 'stockIn' : 'stockOut',
        category: 'Adjustment',
        quantity: Math.abs(delta),
        weight: item.grossWeight,
        purity: item.purity,
        notes: `Quantity adjusted from ${previousQuantity} to ${newQuantity}`,
        performedBy: req.user._id,
      });
    }
    await ActivityLog.create({
      action: 'update',
      module: 'item',
      description: `Item ${item.SKU} updated`,
      performedBy: req.user._id,
      referenceId: item._id,
      referenceModel: 'Item',
    });
    return successResponse(res, item, 'Item updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return errorResponse(res, 'Item not found', 404);
    }
    await item.softDelete();
    await ActivityLog.create({
      action: 'delete',
      module: 'item',
      description: `Item ${item.SKU} deleted`,
      performedBy: req.user._id,
      referenceId: item._id,
      referenceModel: 'Item',
    });
    return successResponse(res, null, 'Item deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getItemByBarcode = async (req, res) => {
  try {
    const item = await Item.findOne({ barcode: req.params.barcode });
    if (!item) {
      return errorResponse(res, 'Item not found with this barcode', 404);
    }
    return successResponse(res, item);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getLowStock = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const threshold = Number(req.query.threshold) || settings?.lowStockThreshold || 5;
    const items = await Item.find({ status: 'In Stock', quantity: { $lte: threshold } }).sort({ quantity: 1 });
    return successResponse(res, items, 'Low stock items retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.cloneItem = async (req, res) => {
  try {
    const source = await Item.findById(req.params.id);
    if (!source) return errorResponse(res, 'Item not found', 404);

    const data = source.toObject();
    delete data._id;
    delete data.__v;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.isDeleted;
    delete data.deletedAt;
    delete data.priceHistory;
    data.itemName = `${source.itemName} (Copy)`;
    data.status = 'In Stock';
    data.images = [];

    const item = await createItemWithRetry(data);
    await StockMovement.create({ item: item._id, type: 'stockIn', category: 'Purchase', quantity: 1, weight: item.grossWeight, purity: item.purity, notes: 'Cloned item', performedBy: req.user._id });
    await ActivityLog.create({ action: 'create', module: 'item', description: `Item ${item.SKU} cloned from ${source.SKU}`, performedBy: req.user._id, referenceId: item._id, referenceModel: 'Item' });
    return successResponse(res, item, 'Item cloned successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.bulkUpdateItems = async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return errorResponse(res, 'ids array is required', 400);
    if (!updates || typeof updates !== 'object') return errorResponse(res, 'updates object is required', 400);

    const allowed = ['status', 'costPrice', 'costMakingCharge', 'costWastagePercent', 'sellingPrice', 'sellingMakingCharge', 'sellingWastagePercent', 'currentLocation', 'makingCharge', 'wastagePercent', 'quantity'];
    const setData = {};
    for (const key of Object.keys(updates)) {
      if (allowed.includes(key)) setData[key] = updates[key];
    }
    if (Object.keys(setData).length === 0) return errorResponse(res, 'No valid fields to update', 400);

    const result = await Item.updateMany({ _id: { $in: ids }, isDeleted: false }, { $set: setData });
    await ActivityLog.create({ action: 'bulk-update', module: 'item', description: `Bulk updated ${result.modifiedCount} items`, performedBy: req.user._id, ipAddress: req.ip });
    return successResponse(res, { modifiedCount: result.modifiedCount }, `${result.modifiedCount} items updated`);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.bulkDeleteItems = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return errorResponse(res, 'ids array is required', 400);

    const items = await Item.find({ _id: { $in: ids }, isDeleted: false });
    if (items.length === 0) return errorResponse(res, 'No items found', 404);

    await Promise.all(items.map((item) => item.softDelete()));

    const logs = items.map((item) => ({
      action: 'delete',
      module: 'item',
      description: `Item ${item.SKU} deleted via bulk`,
      performedBy: req.user._id,
      referenceId: item._id,
      referenceModel: 'Item',
    }));
    await ActivityLog.insertMany(logs);

    return successResponse(res, { deletedCount: items.length }, `${items.length} items deleted successfully`);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getDashboardItemStats = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const lowThreshold = settings?.lowStockThreshold || 5;
    const [totalItems, inStock, soldCount, withKarigar, pawnCollateral, damaged, melted, totalValue, lowStockCount] = await Promise.all([
      Item.countDocuments({ isDeleted: false }),
      Item.countDocuments({ status: 'In Stock', isDeleted: false }),
      Item.countDocuments({ status: 'Sold', isDeleted: false }),
      Item.countDocuments({ status: 'With Karigar', isDeleted: false }),
      Item.countDocuments({ status: 'Pawn Collateral', isDeleted: false }),
      Item.countDocuments({ status: 'Damaged', isDeleted: false }),
      Item.countDocuments({ status: 'Melted', isDeleted: false }),
      Item.aggregate(scopeAggregate([{ $match: { status: 'In Stock', isDeleted: false } }, { $group: { _id: null, total: { $sum: { $multiply: ['$sellingPrice', '$quantity'] } } } }])),
      Item.countDocuments({ status: 'In Stock', isDeleted: false, quantity: { $lte: lowThreshold } }),
    ]);
    return successResponse(res, {
      totalItems, inStock, soldCount, withKarigar, pawnCollateral, damaged, melted,
      inventoryValue: totalValue[0]?.total || 0,
      lowStockCount,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.bulkCreateItems = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Items array is required', 400);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required', 400);
    const createdItems = [];
    const stockMovements = [];
    const activityLogs = [];
    for (const data of items) {
      const item = await createItemWithRetry({ tenantId: req.tenantId, ...data, images: [] });
      createdItems.push(item);
      stockMovements.push({
        item: item._id,
        type: 'stockIn',
        category: 'Purchase',
        quantity: 1,
        weight: data.grossWeight || 0,
        purity: data.purity || 0,
        notes: 'Bulk create',
        performedBy: req.user._id,
      });
      activityLogs.push({
        action: 'create',
        module: 'item',
        description: `Item ${item.SKU} created via bulk`,
        performedBy: req.user._id,
        referenceId: item._id,
        referenceModel: 'Item',
      });
    }
    if (stockMovements.length > 0) {
      await StockMovement.insertMany(stockMovements);
    }
    if (activityLogs.length > 0) {
      await ActivityLog.insertMany(activityLogs);
    }
    return successResponse(res, createdItems, `${createdItems.length} items created successfully`, 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
