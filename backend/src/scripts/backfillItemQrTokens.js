// One-time backfill: mint a QR token for every item that predates the
// qrToken feature (or otherwise saved without one). The Item pre-save hook
// already assigns a token on save, so this only needs to re-save each missing
// item. Re-print barcode labels afterwards to embed the new QR codes.
//
// Usage: node src/scripts/backfillItemQrTokens.js
const mongoose = require('mongoose');
const config = require('../config');
const Item = require('../models/Item');

async function backfill() {
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  const missing = await Item.find({ $or: [{ qrToken: { $exists: false } }, { qrToken: null }, { qrToken: '' }] });
  let updated = 0;
  for (const item of missing) {
    await item.save();
    updated += 1;
  }
  console.log(`Minted QR tokens for ${updated} item(s) out of ${missing.length} scanned`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
