const Counter = require('../models/Counter');
const Customer = require('../models/Customer');
const CustomOrder = require('../models/CustomOrder');
const Voucher = require('../models/Voucher');
const Purchase = require('../models/Purchase');
const Refine = require('../models/Refine');
const Sale = require('../models/Sale');

// Generic counter-backed number generator. Model must expose `find` scoped to
// the ambient tenant and `_id`, the regex base is `<prefix>-<digits>`.
async function getNextNumber(tenantId, model, field, prefix, counterSuffix) {
  const key = `${counterSuffix}_${tenantId || 'global'}`;
  const existing = await Counter.findOne({ _id: key }).lean();
  if (!existing) {
    let max = 0;
    const docs = await model
      .find({ tenantId: tenantId || undefined, isDeleted: { $in: [true, false] } })
      .select(field)
      .lean();
    docs.forEach((d) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(String(d[field] || '').trim().toUpperCase());
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    });
    await Counter.updateOne(
      { _id: key },
      { $setOnInsert: { seq: max } },
      { upsert: true }
    );
  }
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${String(counter.seq).padStart(5, '0')}`;
}

async function getNextCustomerCode(tenantId) {
  return getNextNumber(tenantId, Customer, 'customerCode', 'CUST', 'customer');
}

async function getNextCustomOrderNumber(tenantId) {
  return getNextNumber(tenantId, CustomOrder, 'orderNumber', 'CO', 'customOrder');
}

async function getNextVoucherNumber(tenantId, type) {
  const prefixMap = {
    payment: 'PMT',
    receipt: 'REC',
    contra: 'CTR',
    journal: 'JRN',
    metal_to_cash: 'MTC',
  };
  const prefix = prefixMap[type] || 'VCH';
  return getNextNumber(tenantId, Voucher, 'voucherNumber', prefix, `voucher_${type}`);
}

function getNextPurchaseNumber(tenantId) {
  return getNextNumber(tenantId, Purchase, 'purchaseNumber', 'PRCH', 'purchase');
}

function getNextRefineNumber(tenantId) {
  return getNextNumber(tenantId, Refine, 'refineNumber', 'RFL', 'refine');
}

function getNextSaleNumber(tenantId) {
  return getNextNumber(tenantId, Sale, 'saleNumber', 'SALE', 'sale');
}

module.exports = {
  getNextCustomerCode,
  getNextCustomOrderNumber,
  getNextVoucherNumber,
  getNextPurchaseNumber,
  getNextRefineNumber,
  getNextSaleNumber,
};
