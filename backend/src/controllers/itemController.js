const Item = require('../models/Item');
const LooseLot = require('../models/LooseLot');
const { scopeAggregate } = require('../utils/tenant');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const Rate = require('../models/Rate');
const Settings = require('../models/Settings');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { generateBarcode, generateSKU } = require('../services/barcode');
const { toPerGramRate } = require('../utils/rates');
const { escapeRegex } = require('../utils/helpers');

exports.getItems = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, metalType, purity, karat, karigarId, sort, search } = req.query;
    const query = {};
    if (req.query.itemType) {
      // Legacy tagged items may predate the itemType field and have it missing;
      // the schema default is 'tagged', so missing/null counts as tagged.
      query.itemType = req.query.itemType === 'tagged'
        ? { $in: ['tagged', null] }
        : req.query.itemType;
    }
    if (status) query.status = status;
    if (category) query.category = { $regex: category, $options: 'i' };
    if (metalType) query.metalType = metalType;
    if (purity) query.purity = Number(purity);
    if (karat) query.karat = Number(karat);
    if (karigarId) query.karigarId = karigarId;
    if (req.query.diamond === 'true' || req.query.diamond === '1') {
      query.$and = [{ $or: [{ metalType: 'diamond' }, { stoneType: 'diamond' }] }];
    }
    if (search) {
      const searchRegex = { $regex: escapeRegex(search), $options: 'i' };
      const searchOr = [
        { SKU: searchRegex },
        { barcode: searchRegex },
        { designCode: searchRegex },
        { itemName: searchRegex },
      ];
      if (query.$and) {
        query.$and.push({ $or: searchOr });
      } else {
        query.$or = searchOr;
      }
    }
    const sortOption = sort ? sort.split(',').join(' ') : '-createdAt';
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      sort
        ? Item.find(query).sort(sortOption).skip(skip).limit(Number(limit)).lean()
        : Item.aggregate(scopeAggregate([
            { $match: { isDeleted: false, ...query } },
            { $addFields: { _stockRank: { $cond: [{ $eq: ['$status', 'In Stock'] }, 0, 1] } } },
            { $sort: { _stockRank: 1, createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
          ])),
      Item.countDocuments({ ...query, isDeleted: false }),
    ]);
    // Loose aggregate items (parents of loose lots) carry no sellingPrice or
    // netMetalWeight, so give them a real display value derived from today's
    // rate x remaining weight so they are not shown as NPR 0.00, plus the
    // aggregated lot/stock info (lots count, remaining pieces/weight).
    if (items.some((it) => it.itemType === 'loose')) {
      const looseIds = items.filter((it) => it.itemType === 'loose').map((it) => it._id);
      const [goldLatest, silverLatest, lotAgg] = await Promise.all([
        Rate.findOne({ metalType: 'gold' }).sort({ date: -1 }),
        Rate.findOne({ metalType: 'silver' }).sort({ date: -1 }),
        LooseLot.aggregate(scopeAggregate([
          { $match: { item: { $in: looseIds }, isDeleted: false } },
          {
            $group: {
              _id: '$item',
              lotCount: { $sum: 1 },
              remainingPieces: { $sum: '$remainingPieces' },
              remainingWeight: { $sum: '$remainingWeight' },
            },
          },
        ])),
      ]);
      const goldRate = toPerGramRate(goldLatest);
      const silverRate = toPerGramRate(silverLatest);
      const lotMap = new Map(lotAgg.map((r) => [String(r._id), r]));
      items.forEach((it) => {
        if (it.itemType === 'loose') {
          const agg = lotMap.get(String(it._id));
          it.looseLotCount = agg?.lotCount || 0;
          it.looseRemainingPieces = agg?.remainingPieces || 0;
          it.looseRemainingWeight = agg?.remainingWeight || 0;
          const ratePerGram = it.metalType === 'gold' ? goldRate : silverRate;
          const weight = agg ? it.looseRemainingWeight : it.grossWeight || it.netMetalWeight || 0;
          it.loosePerGramRate = Math.round(ratePerGram);
          it.computedValue = Number((weight * ratePerGram * ((it.purity || 0) / 1000)).toFixed(2));
        }
      });
    }
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
    const { category, metalType, purity, karat, itemName, grossWeight, stoneWeight, netMetalWeight, designCode, description, stoneType, carat, stoneCarat, stoneWeightGram, stoneQuantity, stoneRate, stoneAmount, cut, clarity, certificationNumber, costPrice, costMakingCharge, costWastagePercent, costStonePrice, sellingPrice, sellingMakingCharge, sellingWastagePercent, sellingStonePrice, makingCharge, wastagePercent, tags, status, currentLocation, quantity, karigarId } = req.body;
    if (!category || !metalType || !purity || !itemName || !grossWeight) {
      return errorResponse(res, 'Category, metalType, purity, itemName, and grossWeight are required', 400);
    }
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((f) => `${req.uploadBaseUrl}/${f.filename}`);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create item', 400);
    const item = await createItemWithRetry({
      tenantId: req.tenantId, category, metalType, purity, karat, itemName, grossWeight, stoneWeight, netMetalWeight, designCode, description, stoneType, carat, stoneCarat, stoneWeightGram, stoneQuantity, stoneRate, stoneAmount, cut, clarity, certificationNumber, costPrice, costMakingCharge: costMakingCharge || 0, costWastagePercent: costWastagePercent || 0, costStonePrice: costStonePrice || 0, sellingPrice, sellingMakingCharge: sellingMakingCharge || 0, sellingWastagePercent: sellingWastagePercent || 0, sellingStonePrice: sellingStonePrice || 0, makingCharge: makingCharge || 0, wastagePercent: wastagePercent || 0, tags: tags || [], images, status: status || 'In Stock', currentLocation, quantity: quantity || 1, karigarId: karigarId || null,
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
    const allowedFields = ['itemType', 'category', 'metalType', 'purity', 'karat', 'itemName', 'grossWeight', 'stoneWeight', 'netMetalWeight', 'designCode', 'description', 'stoneType', 'carat', 'stoneCarat', 'stoneWeightGram', 'stoneQuantity', 'stoneRate', 'stoneAmount', 'cut', 'clarity', 'certificationNumber', 'costPrice', 'costMakingCharge', 'costWastagePercent', 'costStonePrice', 'sellingPrice', 'sellingMakingCharge', 'sellingWastagePercent', 'sellingStonePrice', 'makingCharge', 'wastagePercent', 'tags', 'status', 'currentLocation', 'quantity', 'karigarId'];
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

    // A loose parent retires all of its lots too, so they don't linger as
    // sellable in Loose POS with an orphaned parent item.
    if (item.itemType === 'loose') {
      const lots = await LooseLot.find({ item: item._id });
      await Promise.all(lots.map((lot) => lot.softDelete()));
    }

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
    const [latestGold, latestSilver, totalItems, totalQuantity, inStock, soldCount, withKarigar, pawnCollateral, damaged, melted, lowStockCount] = await Promise.all([
      Rate.findOne({ metalType: 'gold' }).sort({ date: -1 }),
      Rate.findOne({ metalType: 'silver' }).sort({ date: -1 }),
      Item.aggregate(scopeAggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, total: { $sum: '$quantity' } } }])),
      Item.aggregate(scopeAggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, total: { $sum: '$quantity' } } }])),
      Item.aggregate(scopeAggregate([{ $match: { status: 'In Stock', isDeleted: false } }, { $group: { _id: null, total: { $sum: '$quantity' } } }])),
      Item.countDocuments({ status: 'Sold', isDeleted: false }),
      Item.countDocuments({ status: 'With Karigar', isDeleted: false }),
      Item.countDocuments({ status: 'Pawn Collateral', isDeleted: false }),
      Item.countDocuments({ status: 'Damaged', isDeleted: false }),
      Item.countDocuments({ status: 'Melted', isDeleted: false }),
      Item.countDocuments({ status: 'In Stock', isDeleted: false, quantity: { $lte: lowThreshold } }),
    ]);
    const goldRate = toPerGramRate(latestGold);
    const silverRate = toPerGramRate(latestSilver);
    const inStockItems = await Item.find({ status: 'In Stock', isDeleted: false }).lean();
    const looseIds = inStockItems.filter((it) => it.itemType === 'loose').map((it) => it._id);
    const lotAgg = looseIds.length
      ? await LooseLot.aggregate(scopeAggregate([
          { $match: { item: { $in: looseIds }, isDeleted: false } },
          { $group: { _id: '$item', remainingWeight: { $sum: '$remainingWeight' } } },
        ]))
      : [];
    const remainingWeightByItem = new Map(lotAgg.map((r) => [String(r._id), r.remainingWeight]));
    const inventoryValue = inStockItems.reduce((sum, item) => {
      const rate = item.metalType === 'gold' ? goldRate : silverRate;
      if (item.itemType === 'loose') {
        // Loose items are tracked by lot; grossWeight is the whole-lot total,
        // so value = remaining lot weight x rate x purity (no quantity factor).
        const weight = (remainingWeightByItem.get(String(item._id)) ?? item.grossWeight) || 0;
        return sum + weight * rate * ((item.purity || 0) / 1000);
      }
      const weight = item.netMetalWeight || 0;
      return sum + weight * rate * ((item.purity || 0) / 1000) * (item.quantity || 1);
    }, 0);
    return successResponse(res, {
      totalItems: totalItems[0]?.total || 0,
      totalQuantity: totalQuantity[0]?.total || 0,
      inStock: inStock[0]?.total || 0,
      soldCount, withKarigar, pawnCollateral, damaged, melted,
      inventoryValue,
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
