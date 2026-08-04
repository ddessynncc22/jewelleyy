const mongoose = require('mongoose');
const config = require('../config');
require('../models/Counter');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

const oldUniqueIndexes = {
  items: ['SKU_1'],
  sales: ['saleNumber_1'],
  pawnloans: ['loanNumber_1'],
  customers: ['customerCode_1'],
  categories: ['name_1'],
  users: ['email_1'],
};

async function dropOldIndexes(db) {
  for (const [collection, indexes] of Object.entries(oldUniqueIndexes)) {
    for (const indexName of indexes) {
      try {
        await db.collection(collection).dropIndex(indexName);
        console.log(`Dropped old index ${indexName} on ${collection}`);
      } catch (err) {
        if (err.code === 27) {
          console.log(`Index ${indexName} on ${collection} not found, skipping`);
        } else {
          console.error(`Failed to drop index ${indexName} on ${collection}:`, err.message);
        }
      }
    }
  }
}

async function migrate() {
  await mongoose.connect(config.mongodbUri);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB');

  let tenant = await Tenant.findOne({ slug: 'default-shop' });
  if (!tenant) {
    const settingsDoc = await db.collection('settings').findOne({});
    tenant = await Tenant.create({
      name: 'Default Shop',
      slug: 'default-shop',
      contactEmail: settingsDoc?.email || '',
      contactPhone: settingsDoc?.phone || '',
      address: settingsDoc?.address || '',
      storeName: settingsDoc?.storeName || 'My Jewellery Store',
      currency: settingsDoc?.currency || 'NPR',
      defaultPurity: settingsDoc?.defaultPurity || 916,
      defaultKarat: settingsDoc?.defaultKarat || 22,
      lowStockThreshold: settingsDoc?.lowStockThreshold || 5,
      businessStartDate: settingsDoc?.businessStartDate || new Date(),
      isActive: true,
    });
    console.log(`Created tenant: ${tenant.name} (number ${tenant.tenantNumber})`);

    await db.collection('settings').updateOne(
      { _id: settingsDoc._id },
      { $set: { tenantId: tenant.tenantNumber } }
    );
    console.log('Backfilled settings.tenantId');
  } else {
    console.log(`Tenant already exists: ${tenant.name} (number ${tenant.tenantNumber})`);
  }

  await dropOldIndexes(db);

  const collections = [
    'items', 'categories', 'customers', 'customerledgers',
    'sales', 'stockmovements', 'karigars', 'pawnloans',
    'rates', 'activitylogs', 'settings', 'users',
  ];

  for (const name of collections) {
    const result = await db.collection(name).updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: tenant.tenantNumber } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Backfilled ${result.modifiedCount} documents in ${name}`);
    } else {
      console.log(`No documents needed backfill in ${name}`);
    }

    try {
      await db.collection(name).createIndex({ tenantId: 1 });
    } catch (e) {
    }
  }

  const userCount = await User.countDocuments({ tenantId: tenant.tenantNumber });
  console.log(`Migration complete. ${userCount} users linked to tenant ${tenant.name}`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
