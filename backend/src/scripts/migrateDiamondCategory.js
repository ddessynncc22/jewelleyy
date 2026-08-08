const mongoose = require('mongoose');
const config = require('../config');
const Item = require('../models/Item');
const Category = require('../models/Category');

// One-time backfill: existing items that carry diamond stones (metalType or
// stoneType) but predate the auto-category logic are moved under a top-level
// "Diamond" category so the dashboard Inventory Value groups them correctly.
async function migrate() {
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  const hasDiamondStone = {
    $or: [
      { metalType: { $in: ['diamond', 'gemstone'] } },
      { stoneType: 'diamond' },
    ],
  };

  const affected = await Item.find(hasDiamondStone).select('_id tenantId category metalType stoneType itemName').lean();
  console.log(`Items with diamond metal/stone: ${affected.length}`);

  const perTenant = {};
  for (const item of affected) {
    const tenantId = item.tenantId;
    if (!perTenant[tenantId]) perTenant[tenantId] = [];
    perTenant[tenantId].push(item);
  }

  let updated = 0;
  let created = 0;

  for (const [tenantId, items] of Object.entries(perTenant)) {
    let diamondCat = await Category.findOne({ tenantId: Number(tenantId), name: { $regex: '^diamond$', $options: 'i' } });
    if (!diamondCat) {
      diamondCat = await Category.create({ tenantId: Number(tenantId), name: 'Diamond' });
      created += 1;
      console.log(`Created "Diamond" category for tenant ${tenantId}`);
    }

    for (const item of items) {
      const cat = (item.category || '').toLowerCase();
      if (cat === 'diamond' || cat === 'gemstone') continue;
      await Item.updateOne(
        { _id: item._id },
        { $set: { category: diamondCat.name, subcategory: item.subcategory || 'Diamond' } }
      );
      updated += 1;
      console.log(`  #${item._id} "${item.itemName || item.SKU || ''}" -> category "${diamondCat.name}"`);
    }
  }

  console.log(`Done. Categories created: ${created}, items updated: ${updated}`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
