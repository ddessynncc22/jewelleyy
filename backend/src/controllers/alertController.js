const Item = require('../models/Item');
const PawnLoan = require('../models/PawnLoan');
const { successResponse, errorResponse } = require('../utils/response');
const { getLowStockList } = require('../utils/lowStock');

exports.getAlerts = async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [lowStockResult, slowMoving, approachingDue] = await Promise.all([
      getLowStockList({ limit: 20 }),
      Item.find({ status: 'In Stock', updatedAt: { $lte: sixMonthsAgo } }).limit(20).lean(),
      PawnLoan.find({ status: 'Active', dueDate: { $lte: thirtyDaysFromNow, $gte: new Date() } }).limit(20).lean(),
    ]);

    return successResponse(res, { lowStock: lowStockResult.lowStockItemList, slowMoving, approachingDue });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
