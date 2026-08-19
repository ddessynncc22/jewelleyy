const Item = require('../models/Item');
const LooseLot = require('../models/LooseLot');
const Settings = require('../models/Settings');
const { scopeAggregate } = require('./tenant');

// Merged low-stock list for dashboards/alerts. Tagged items compare their
// piece count against the tenant-wide lowStockThreshold. Loose lots are
// grouped by parent item and flagged when remainingPieces drops to their
// per-lot pieces threshold (falling back to the tenant threshold when 0/off)
// or when remainingWeight drops to an explicitly set weight threshold.
async function getLowStockList(options = {}) {
  const settings = await Settings.getSettings();
  const lowThreshold = settings?.lowStockThreshold || 5;

  const [taggedItems, looseGroups] = await Promise.all([
    Item.find({ status: 'In Stock', itemType: { $ne: 'loose' }, quantity: { $lte: lowThreshold } })
      .select('itemName SKU quantity metalType')
      .sort({ quantity: 1 })
      .lean(),
    LooseLot.aggregate(scopeAggregate([
      { $match: { status: 'active', isDeleted: false } },
      {
        $addFields: {
          isLow: {
            $or: [
              {
                $lte: [
                  '$remainingPieces',
                  {
                    $cond: [
                      { $gt: ['$lowStockPiecesThreshold', 0] },
                      '$lowStockPiecesThreshold',
                      lowThreshold,
                    ],
                  },
                ],
              },
              {
                $and: [
                  { $gt: ['$lowStockWeightThreshold', 0] },
                  { $lte: ['$remainingWeight', '$lowStockWeightThreshold'] },
                ],
              },
            ],
          },
        },
      },
      { $match: { isLow: true } },
      {
        $group: {
          _id: '$item',
          quantity: { $sum: '$remainingPieces' },
          remainingWeight: { $sum: '$remainingWeight' },
          lowLots: { $sum: 1 },
        },
      },
      { $lookup: { from: 'items', localField: '_id', foreignField: '_id', as: 'parent' } },
      { $unwind: { path: '$parent', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          quantity: 1,
          remainingWeight: { $round: ['$remainingWeight', 3] },
          lowLots: 1,
          itemName: { $ifNull: ['$parent.itemName', ''] },
          SKU: { $ifNull: ['$parent.SKU', ''] },
          metalType: { $ifNull: ['$parent.metalType', ''] },
        },
      },
      { $sort: { quantity: 1 } },
    ])),
  ]);

  const taggedRows = taggedItems.map((item) => ({ ...item, itemType: 'tagged' }));
  const looseRows = looseGroups.map((lot) => ({
    _id: lot._id,
    itemName: lot.itemName,
    SKU: lot.SKU,
    metalType: lot.metalType,
    quantity: lot.quantity,
    remainingWeight: lot.remainingWeight,
    itemType: 'loose',
    lowLots: lot.lowLots,
  }));

  const merged = [...taggedRows, ...looseRows].sort((a, b) => a.quantity - b.quantity);
  const list = options.limit ? merged.slice(0, options.limit) : merged;
  return { lowStockItems: merged.length, lowStockItemList: list, lowStockThreshold: lowThreshold };
}

module.exports = { getLowStockList };
