const mongoose = require('mongoose');
const config = require('../config');

// One-time purge of the entire purchase section (all tenants):
// purchases, buy-backs, purchase returns, suppliers, their stock
// movements / activity logs / counters / customer-ledger entries,
// and purchase-issued material lines left on karigars.
async function purge() {
  await mongoose.connect(config.mongodbUri);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB');

  const names = ['purchases', 'buybacks', 'purchasereturns', 'suppliers'];
  for (const name of names) {
    const res = await db.collection(name).deleteMany({});
    console.log(`Deleted ${res.deletedCount} documents from ${name}`);
  }

  const stockRes = await db.collection('stockmovements').deleteMany({
    category: { $in: ['Purchase Return', 'Buy-back', 'Buy-back Return'] },
  });
  console.log(`Deleted ${stockRes.deletedCount} stock movements (Purchase Return / Buy-back / Buy-back Return)`);

  const logRes = await db.collection('activitylogs').deleteMany({
    module: { $in: ['purchase', 'purchase-return', 'buyback', 'supplier'] },
  });
  console.log(`Deleted ${logRes.deletedCount} activity logs (purchase / purchase-return / buyback / supplier)`);

  const counterRes = await db.collection('counters').deleteMany({
    _id: { $regex: /^(purchase|buyback|purchaseReturn)_/ },
  });
  console.log(`Deleted ${counterRes.deletedCount} sequence counters`);

  const ledgerRes = await db.collection('customerledgers').deleteMany({
    referenceModel: { $in: ['Buyback', 'PurchaseReturn'] },
  });
  console.log(`Deleted ${ledgerRes.deletedCount} customer ledger entries (Buyback / PurchaseReturn)`);

  const karigars = await db.collection('karigars').find({}).toArray();
  let pulled = 0;
  for (const k of karigars) {
    const all = k.materials || [];
    const materials = all.filter((m) => !m.purchaseRef);
    const removed = all.length - materials.length;
    if (!removed) continue;
    pulled += removed;
    await db.collection('karigars').updateOne(
      { _id: k._id },
      {
        $set: {
          materials,
          pendingJobs: materials.filter((m) => m.status !== 'Returned').length,
          totalIssued: materials.reduce((s, m) => s + (m.grossWeight || 0), 0),
          totalReturned: materials.filter((m) => m.status === 'Returned').reduce((s, m) => s + (m.grossWeight || 0), 0),
        },
      }
    );
  }
  console.log(`Pulled ${pulled} purchase material line(s) off karigars`);

  await mongoose.disconnect();
  console.log('Done');
}

purge().catch((err) => {
  console.error(err);
  process.exit(1);
});
