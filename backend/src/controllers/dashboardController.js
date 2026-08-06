const Item = require('../models/Item');
const LooseLot = require('../models/LooseLot');
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
      Item.aggregate(scopeAggregate([{ $match: { status: 'In Stock', isDeleted: false } }, { $group: { _id: null, total: { $sum: '$quantity' } } }])),
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
    const looseWeightByItem = await getLooseStockMap(allItems);
    // Reuse itemValue() rather than repeating the formula: the two copies had
    // already drifted, so the dashboard total and the Inventory Value page could
    // disagree for the same stock.
    const totalValue = allItems.reduce(
      (sum, item) => sum + itemValue(item, goldRate, silverRate, looseWeightByItem).value,
      0
    );
    return successResponse(res, {
      totalInventory: totalInventory[0]?.total || 0,
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

async function getLooseStockMap(items) {
  const looseIds = items.filter((i) => i.itemType === 'loose').map((i) => i._id);
  if (looseIds.length === 0) return new Map();
  const lotAgg = await LooseLot.aggregate(scopeAggregate([
    { $match: { item: { $in: looseIds }, isDeleted: false } },
    {
      $group: {
        _id: '$item',
        remainingPieces: { $sum: '$remainingPieces' },
        remainingWeight: { $sum: '$remainingWeight' },
      },
    },
  ]));
  return new Map(lotAgg.map((r) => [String(r._id), r]));
}

// Only gold and silver have a live per-gram market rate. metalType also allows
// 'diamond' and 'gemstone', and the old `metalType === 'gold' ? gold : silver`
// ternary priced those off the SILVER rate — a stone's weight times the silver
// rate is a meaningless number. They fall back to their own recorded costPrice.
function metalRateFor(item, goldRate, silverRate) {
  if (item.metalType === 'gold') return goldRate.rate;
  if (item.metalType === 'silver') return silverRate.rate;
  return 0;
}

function itemValue(item, goldRate, silverRate, looseMap) {
  const rate = metalRateFor(item, goldRate, silverRate);
  const quantity = item.quantity || 1;

  if (item.itemType === 'loose') {
    const info = looseMap.get(String(item._id));
    const weight = (info?.remainingWeight ?? item.grossWeight) || 0;
    const pieces = (info?.remainingPieces ?? item.quantity) || 0;
    return {
      ...item,
      rate,
      weight,
      pieces,
      value: rate
        ? weight * rate * ((item.purity || 0) / 1000)
        : (item.costPrice || 0) * pieces,
    };
  }
  return {
    ...item,
    rate,
    weight: (item.netMetalWeight || 0) * quantity,
    pieces: item.quantity || 0,
    value: rate
      ? (item.netMetalWeight || 0) * rate * ((item.purity || 0) / 1000) * quantity
      : (item.costPrice || 0) * quantity,
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
    const looseMap = await getLooseStockMap(allItems);

    const metals = ['gold', 'silver', 'diamond'];
    const metalLabels = { gold: 'Gold', silver: 'Silver', diamond: 'Diamond / Gemstone' };
    const metalRates = { gold: goldRate.rate, silver: silverRate.rate, diamond: 0 };

    const metalGroups = metals.map((metal) => {
      const filtered = allItems.filter((i) => {
        if (metal === 'diamond') return i.metalType !== 'gold' && i.metalType !== 'silver';
        return i.metalType === metal;
      });

      const categoryMap = new Map();
      for (const item of filtered) {
        const cat = item.category || 'Uncategorized';
        const subcat = item.subcategory || null;
        if (!categoryMap.has(cat)) categoryMap.set(cat, new Map());
        const subMap = categoryMap.get(cat);
        if (!subMap.has(subcat)) subMap.set(subcat, []);
        subMap.get(subcat).push(itemValue(item, goldRate, silverRate, looseMap));
      }

      const categories = [];
      for (const [catName, subMap] of categoryMap) {
        let catTotalValue = 0;
        let catTotalWeight = 0;
        let catTotalQuantity = 0;
        let catTotalPieces = 0;

        const subcategories = [];
        for (const [subcatName, items] of subMap) {
          const subValue = items.reduce((s, i) => s + i.value, 0);
          const subWeight = items.reduce((s, i) => s + i.weight, 0);
          const subPieces = items.reduce((s, i) => s + i.pieces, 0);
          catTotalValue += subValue;
          catTotalWeight += subWeight;
          catTotalQuantity += items.length;
          catTotalPieces += subPieces;
          subcategories.push({
            key: subcatName,
            label: subcatName || '(no subcategory)',
            totalValue: subValue,
            totalWeight: subWeight,
            totalQuantity: items.length,
            totalPieces: subPieces,
            items,
          });
        }

        categories.push({
          key: catName,
          label: catName,
          totalValue: catTotalValue,
          totalWeight: catTotalWeight,
          totalQuantity: catTotalQuantity,
          totalPieces: catTotalPieces,
          subcategories,
        });
      }

      const metalTotalValue = categories.reduce((s, c) => s + c.totalValue, 0);
      const metalTotalWeight = categories.reduce((s, c) => s + c.totalWeight, 0);
      const metalTotalQuantity = categories.reduce((s, c) => s + c.totalQuantity, 0);
      const metalTotalPieces = categories.reduce((s, c) => s + c.totalPieces, 0);

      return {
        key: metal,
        label: metalLabels[metal],
        rate: metalRates[metal],
        totalValue: metalTotalValue,
        totalWeight: metalTotalWeight,
        totalQuantity: metalTotalQuantity,
        totalPieces: metalTotalPieces,
        categories,
      };
    });

    const totalValue = metalGroups.reduce((s, m) => s + m.totalValue, 0);
    const totalQuantity = metalGroups.reduce((s, m) => s + m.totalQuantity, 0);
    const totalPieces = metalGroups.reduce((s, m) => s + m.totalPieces, 0);
    const totalWeight = metalGroups.reduce((s, m) => s + m.totalWeight, 0);

    return successResponse(res, {
      goldRate,
      silverRate,
      totalValue,
      totalQuantity,
      totalPieces,
      totalWeight,
      metals: metalGroups,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
