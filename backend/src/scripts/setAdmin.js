// Create-or-reset a superadmin in one command.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-password' node src/scripts/setAdmin.js
//
// Exists because the two older scripts each cover half the job: seed.js creates
// but silently skips when the email is already taken, and updateSuperadmin.js
// resets but fails when it is not. This one always leaves you with a working
// superadmin login, whatever the account's current state — run it again any time
// the password is changed or forgotten.
//
// The password is read from the environment on purpose. Nothing is hardcoded, so
// no credential ends up in the repository, and rotating it is just another run.
const mongoose = require('mongoose');
const config = require('../config');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Super Admin';

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('ADMIN_EMAIL is required and must be a valid email address');
    process.exit(1);
  }
  // The schema minimum is 6; 8 is enforced here because this account bypasses
  // tenant scoping entirely and is reachable from the public internet.
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD is required and must be at least 8 characters');
    process.exit(1);
  }

  try {
    await mongoose.connect(config.mongodbUri);
    const User = require('../models/User');

    // No ambient tenant in a script, so tenantPlugin injects no filter and this
    // sees every user. Superadmins intentionally carry no tenantId.
    const existing = await User.findOne({ email }).select('+password');

    if (existing) {
      // Assigning the plain password lets the pre('save') hook hash it, which is
      // the same path a normal password change takes.
      existing.password = password;
      existing.role = 'superadmin';
      existing.isActive = true;
      existing.isDeleted = false;
      await existing.save();
      console.log(`Superadmin password reset for ${email}`);
    } else {
      await User.create({
        name,
        email,
        password,
        role: 'superadmin',
        phone: process.env.ADMIN_PHONE || '9800000000',
        isActive: true,
      });
      console.log(`Superadmin created: ${email}`);
    }

    console.log('Sign in with this email and the password you just set.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
