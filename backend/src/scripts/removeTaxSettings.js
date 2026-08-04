// One-time script: remove the now-unused tax settings fields
// (taxSettings, nepalTaxSettings) from the settings and tenants collections.
// Run from backend/:  node src/scripts/removeTaxSettings.js
const mongoose = require('mongoose');
const config = require('../config');

const TAX_FIELDS = ['taxSettings', 'nepalTaxSettings'];

async function run() {
  await mongoose.connect(config.mongodbUri);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB');

  for (const collectionName of ['settings', 'tenants']) {
    const unset = {};
    TAX_FIELDS.forEach((f) => { unset[f] = ''; });
    const result = await db.collection(collectionName).updateMany({}, { $unset: unset });
    console.log(`Removed tax fields from ${result.modifiedCount} documents in ${collectionName}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
