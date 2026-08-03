const Item = require('../models/Item');
const PawnLoan = require('../models/PawnLoan');
const Settings = require('../models/Settings');
const { successResponse, errorResponse } = require('../utils/response');

exports.getAlerts = async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const settings = await Settings.getSettings();
    const lowThreshold = settings?.lowStockThreshold || 5;
    const [lowStock, slowMoving, approachingDue] = await Promise.all([
      Item.find({ status: 'In Stock', netMetalWeight: { $lte: lowThreshold } }).limit(20).lean(),
      Item.find({ status: 'In Stock', updatedAt: { $lte: sixMonthsAgo } }).limit(20).lean(),
      PawnLoan.find({ status: 'Active', dueDate: { $lte: thirtyDaysFromNow, $gte: new Date() } }).limit(20).lean(),
    ]);

    return successResponse(res, { lowStock, slowMoving, approachingDue });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
