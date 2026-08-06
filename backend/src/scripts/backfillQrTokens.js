// One-time: give every existing item a qr_token so printed QR tags resolve.
// Run from backend/:  node src/scripts/backfillQrTokens.js
const mongoose = require('mongoose');
const config = require('../config');
const Item = require('../models/Item');
const { generateQrToken } = require('../services/barcode');

async function backfill() {
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  const cursor = Item.find({
    $or: [{ qrToken: { $exists: false } }, { qrToken: null }, { qrToken: '' }],
  }).cursor();

  let updated = 0;
  let doc = await cursor.next();
  while (doc) {
    doc.qrToken = generateQrToken();
    await doc.save();
    updated += 1;
    doc = await cursor.next();
  }

  console.log(`Backfilled qrToken for ${updated} items`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
