const Counter = require('../models/Counter');
const Customer = require('../models/Customer');

async function getNextCustomerCode(tenantId) {
  const key = `customer_${tenantId || 'global'}`;
  const existing = await Counter.findOne({ _id: key }).lean();
  if (!existing) {
    let max = 0;
    const docs = await Customer.find({ tenantId: tenantId || undefined })
      .select('customerCode')
      .lean();
    docs.forEach((d) => {
      const match = /^CUST-(\d+)$/.exec(String(d.customerCode || '').trim().toUpperCase());
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
  return `CUST-${String(counter.seq).padStart(5, '0')}`;
}

module.exports = { getNextCustomerCode };
