const Item = require('../models/Item');
const PawnLoan = require('../models/PawnLoan');
const Karigar = require('../models/Karigar');
const StockMovement = require('../models/StockMovement');
const Rate = require('../models/Rate');
const Settings = require('../models/Settings');
const { successResponse, errorResponse } = require('../utils/response');
const { scopeAggregate } = require('../utils/tenant');
const { toPerGramRate } = require('../utils/rates');

exports.getDashboardStats = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const lowThreshold = settings?.lowStockThreshold || 5;
    const [totalInventory, latestGold, latestSilver, activePawnLoans, pendingKarigarJobs, lowStockItems, recentActivities, itemsByStatus, itemsByMetal] = await Promise.all([
      Item.countDocuments({ status: 'In Stock', isDeleted: false }),
      Rate.findOne({ metalType: 'gold' }).sort({ date: -1 }),
      Rate.findOne({ metalType: 'silver' }).sort({ date: -1 }),
      PawnLoan.countDocuments({ status: { $in: ['Active', 'Renewed'] }, isDeleted: false }),
      Karigar.aggregate(scopeAggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, totalPending: { $sum: '$pendingJobs' } } }])),
      Item.find({ status: 'In Stock', quantity: { $lte: lowThreshold } }).select('itemName SKU quantity metalType').lean(),
      StockMovement.find().populate('item', 'SKU itemName category').populate('performedBy', 'name').sort({ movementDate: -1 }).limit(10).lean(),
      Item.aggregate(scopeAggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$status', count: { $sum: 1 } } }])),
      Item.aggregate(scopeAggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$metalType', count: { $sum: 1 } } }])),
    ]);
    const allItems = await Item.find({ status: 'In Stock' }).lean();
    const goldRate = { rate: toPerGramRate(latestGold), unit: 'gram' };
    const silverRate = { rate: toPerGramRate(latestSilver), unit: 'gram' };
    const totalValue = allItems.reduce((sum, item) => {
      const rate = item.metalType === 'gold' ? goldRate.rate : silverRate.rate;
      return sum + ((item.netMetalWeight || 0) * rate * ((item.purity || 0) / 1000));
    }, 0);
    return successResponse(res, {
      totalInventory,
      totalValue,
      goldRate,
      silverRate,
      activePawnLoans,
      pendingKarigarJobs: pendingKarigarJobs[0]?.totalPending || 0,
      lowStockItems: lowStockItems.length,
      lowStockItemList: lowStockItems,
      recentActivities,
      itemsByStatus,
      itemsByMetal,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

function itemValue(item, goldRate, silverRate) {
  const rate = item.metalType === 'gold' ? goldRate.rate : silverRate.rate;
  return {
    ...item,
    rate,
    value: (item.netMetalWeight || 0) * rate * ((item.purity || 0) / 1000),
  };
}

exports.getInventoryValue = async (req, res) => {
  try {
    const [latestGold, latestSilver] = await Promise.all([
      Rate.findOne({ metalType: 'gold' }).sort({ date: -1 }),
      Rate.findOne({ metalType: 'silver' }).sort({ date: -1 }),
    ]);
    const goldRate = { rate: toPerGramRate(latestGold), unit: 'gram' };
    const silverRate = { rate: toPerGramRate(latestSilver), unit: 'gram' };

    const allItems = await Item.find({ status: 'In Stock' }).lean();
    const goldItems = allItems
      .filter((i) => i.metalType === 'gold' && i.stoneType !== 'diamond')
      .map((i) => itemValue(i, goldRate, silverRate));
    const goldDiamondItems = allItems
      .filter((i) => i.metalType === 'gold' && i.stoneType === 'diamond')
      .map((i) => itemValue(i, goldRate, silverRate));
    const silverItems = allItems
      .filter((i) => i.metalType === 'silver')
      .map((i) => itemValue(i, goldRate, silverRate));
    const otherItems = allItems
      .filter((i) => i.metalType !== 'gold' && i.metalType !== 'silver')
      .map((i) => itemValue(i, goldRate, silverRate));

    const buildGroup = (key, label, items, rate) => ({
      key,
      label,
      count: items.length,
      totalWeight: items.reduce((s, i) => s + (i.netMetalWeight || 0), 0),
      rate,
      totalValue: items.reduce((s, i) => s + i.value, 0),
      items,
    });

    const groups = [
      buildGroup('gold', 'Gold', goldItems, goldRate.rate),
      buildGroup('gold-diamond', 'Gold & Diamond', goldDiamondItems, goldRate.rate),
      buildGroup('silver', 'Silver', silverItems, silverRate.rate),
      buildGroup('other', 'Diamond / Gemstone', otherItems, 0),
    ];

    return successResponse(res, {
      goldRate,
      silverRate,
      totalValue: groups.reduce((s, g) => s + g.totalValue, 0),
      groups,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
