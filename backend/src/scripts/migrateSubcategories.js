// One-time migration for the subcategory feature. The old unique index
// `{ tenantId, name }` on categories is replaced by `{ tenantId, parent, name }`
// (see the Category model). Run BEFORE saving any subcategories, otherwise the
// stale unique index rejects duplicate names across different parents.
//
// Usage: node src/scripts/migrateSubcategories.js
const mongoose = require('mongoose');
const config = require('../config');
require('../models/Category');

async function migrate() {
  await mongoose.connect(config.mongodbUri);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB');

  const coll = db.collection('categories');
  try {
    await coll.dropIndex('tenantId_1_name_1');
    console.log('Dropped old unique index tenantId_1_name_1 on categories');
  } catch (err) {
    if (err.code === 27) {
      console.log('Index tenantId_1_name_1 not found on categories, nothing to drop');
    } else {
      throw err;
    }
  }

  // Let mongoose recreate indexes from the model (parent-scoped unique).
  await mongoose.connection.model('Category').syncIndexes();
  console.log('Rebuilt category indexes');

  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
