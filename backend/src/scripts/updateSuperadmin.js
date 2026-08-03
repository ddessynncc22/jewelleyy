const mongoose = require('mongoose');
const config = require('../config');
const bcrypt = require('bcryptjs');

(async () => {
  await mongoose.connect(config.mongodbUri);
  const db = mongoose.connection.db;

  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@jewellery.com';
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password || password.length < 8) {
    console.error('SUPERADMIN_PASSWORD env var is required (min 8 chars)');
    await mongoose.disconnect();
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  const result = await db.collection('users').updateOne(
    { email, role: 'superadmin' },
    { $set: { password: hash, isActive: true } }
  );
  if (result.matchedCount === 0) {
    console.error(`No superadmin user found with email ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Superadmin password updated for ${email}`);
  await mongoose.disconnect();
})();
