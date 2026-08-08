const RefinedStockEntry = require('../models/RefinedStockEntry');

const round = (n, decimals = 4) => {
  const f = Math.pow(10, decimals);
  return Math.round((Number(n) || 0) * f) / f;
};

// Current refined (fine) gold balance in grams for a tenant.
async function getRefinedStockBalance(tenantId) {
  const last = await RefinedStockEntry.findOne({ tenantId }).sort({ date: -1, _id: -1 }).lean();
  return last ? last.balanceAfter : 0;
}

// Append a movement to the refined-gold ledger. Balance is read from the
// most recent entry and the new balanceAfter is written on the new row.
async function recordRefinedStock({ tenantId, performedBy, type, source, sourceId = null, referenceNumber = '', weightG, note = '', date = new Date() }) {
  const last = await RefinedStockEntry.findOne({ tenantId }).sort({ date: -1, _id: -1 }).lean();
  const prevBalance = last ? last.balanceAfter : 0;
  const delta = type === 'in' ? Number(weightG) : -Number(weightG);
  const balanceAfter = round(prevBalance + delta);
  return RefinedStockEntry.create({
    tenantId,
    type,
    source,
    sourceId,
    referenceNumber,
    weightG: round(weightG),
    balanceAfter,
    note,
    date,
    performedBy,
  });
}

module.exports = {
  getRefinedStockBalance,
  recordRefinedStock,
};
