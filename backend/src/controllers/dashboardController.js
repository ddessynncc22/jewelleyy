const Item = require('../models/Item');
const LooseLot = require('../models/LooseLot');
const PawnLoan = require('../models/PawnLoan');
const Karigar = require('../models/Karigar');
const StockMovement = require('../models/StockMovement');
const Sale = require('../models/Sale');
const Rate = require('../models/Rate');
const Settings = require('../models/Settings');
const { successResponse, errorResponse } = require('../utils/response');
const { scopeAggregate } = require('../utils/tenant');
const { toPerGramRate } = require('../utils/rates');
const { getRefinedStockBalance } = require('../services/refinedStock');

const NEPAL_TIMEZONE = 'Asia/Kathmandu';

function getNepalTodayStr() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NEPAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

// Interpret a YYYY-MM-DD string as a *Nepal* calendar date and return the
// absolute instant. Falls back to today's Nepal date when absent/invalid.
function rangeInstants(startStr, endStr) {
  const todayStr = getNepalTodayStr();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startStr || '') ? startStr : todayStr;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(endStr || '') ? endStr : todayStr;
  return {
    start: new Date(`${start}T00:00:00+05:45`),
    end: new Date(`${end}T23:59:59+05:45`),
  };
}

exports.getDashboardStats = async (req, res) => {
  try {
    const { start: rangeStart, end: rangeEnd } = rangeInstants(req.query.startDate, req.query.endDate);
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
    const totalValue = allItems.reduce((sum, item) => sum + itemValue(item, goldRate, silverRate, looseWeightByItem).value, 0);
    const salesByHourAgg = await Sale.aggregate(scopeAggregate([
      {
        $match: {
          isDeleted: false,
          saleDate: { $gte: rangeStart, $lte: rangeEnd },
        },
      },
      {
        $group: {
          _id: { $hour: { date: '$saleDate', timezone: 'Asia/Kathmandu' } },
          count: { $sum: 1 },
        },
      },
    ]));
    const hourCounts = new Map(salesByHourAgg.map((h) => [h._id, h.count]));
    const salesByHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourCounts.get(i) || 0 }));
    const peakSalesHours = [...salesByHour]
      .sort((a, b) => b.count - a.count || a.hour - b.hour)
      .slice(0, 3);
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
      peakSalesHours,
      salesByHour,
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

function isDiamondItem(item) {
  const metal = (item.metalType || '').toLowerCase();
  const category = (item.category || '').toLowerCase();
  const stone = (item.stoneType || '').toLowerCase();
  return metal === 'diamond' || metal === 'gemstone' || category === 'diamond' || category === 'gemstone' || stone === 'diamond' || stone === 'gemstone';
}

// Only gold and silver have a live per-gram market rate. metalType also allows
// 'diamond' and 'gemstone', which have no market rate and fall back to their
// own recorded costPrice.
function metalRateFor(item, goldRate, silverRate) {
  if (item.metalType === 'gold') return goldRate.rate;
  if (item.metalType === 'silver') return silverRate.rate;
  return 0;
}

function itemValue(item, goldRate, silverRate, looseMap) {
  const rate = metalRateFor(item, goldRate, silverRate);

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
  const qty = item.quantity || 1;
  const metalValue = (item.netMetalWeight || 0) * rate * ((item.purity || 0) / 1000) * qty;
  const stoneValue = Number(item.stoneAmount || 0) * qty;
  return {
    ...item,
    rate,
    weight: (item.netMetalWeight || 0) * qty,
    pieces: qty,
    value: rate ? metalValue + stoneValue : (item.costPrice || 0) * qty,
  };
}

exports.getInventoryValue = async (req, res) => {
  try {
    const [latestGold, latestSilver, refinedBalanceG] = await Promise.all([
      Rate.findOne({ metalType: 'gold' }).sort({ date: -1 }),
      Rate.findOne({ metalType: 'silver' }).sort({ date: -1 }),
      getRefinedStockBalance(req.tenantId),
    ]);
    const goldRate = { rate: toPerGramRate(latestGold), unit: 'gram' };
    const silverRate = { rate: toPerGramRate(latestSilver), unit: 'gram' };
    const refinedStockValue = Math.round((refinedBalanceG || 0) * goldRate.rate * 100) / 100;

    const allItems = await Item.find({ status: 'In Stock' }).lean();
    const looseMap = await getLooseStockMap(allItems);

    const metals = [
      { key: 'gold', label: 'Gold', match: (i) => i.metalType === 'gold' && !isDiamondItem(i) },
      { key: 'silver', label: 'Silver', match: (i) => i.metalType === 'silver' && !isDiamondItem(i) },
      { key: 'diamond', label: 'Diamond / Gemstone', match: isDiamondItem },
    ];
    const metalRates = { gold: goldRate.rate, silver: silverRate.rate, diamond: 0 };

    const metalGroups = metals.map((metal) => {
      const filtered = allItems.filter(metal.match);

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
        key: metal.key,
        label: metal.label,
        rate: metalRates[metal.key],
        totalValue: metalTotalValue,
        totalWeight: metalTotalWeight,
        totalQuantity: metalTotalQuantity,
        totalPieces: metalTotalPieces,
        categories,
      };
    });

    const totalValue = metalGroups.reduce((s, m) => s + m.totalValue, 0) + refinedStockValue;
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
      refinedStock: {
        balanceG: refinedBalanceG || 0,
        value: refinedStockValue,
      },
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
