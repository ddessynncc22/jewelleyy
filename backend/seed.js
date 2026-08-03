const mongoose = require('mongoose');
const config = require('./src/config');

mongoose.connect(config.mongodbUri).then(async () => {
  const User = require('./src/models/User');
  const email = process.env.SUPERADMIN_EMAIL || 'admin@jewellery.com';
  const password = process.env.SUPERADMIN_PASSWORD || 'admin123';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Admin user already exists');
  } else {
    await User.create({
      name: 'Super Admin',
      email,
      password,
      role: 'superadmin',
      phone: '9800000000',
      isActive: true,
    });
    console.log(`Superadmin user created: ${email}`);
    if (!process.env.SUPERADMIN_PASSWORD) {
      console.warn('WARNING: Default password "admin123" in use. Set SUPERADMIN_PASSWORD to override.');
    }
  }
  process.exit(0);
}).catch(e => {
  console.log('Error:', e.message);
  process.exit(1);
});
