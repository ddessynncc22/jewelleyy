const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('WARNING: JWT_SECRET is not set, using an insecure default for development only');
}

// Base domain for subdomain-per-tenant routing, e.g. "example.com".
// Leave empty to disable host enforcement entirely (single-domain / local dev).
const baseDomain = (process.env.APP_BASE_DOMAIN || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');

// Subdomain that serves the superadmin portal, e.g. "jewellery" -> jewellery.example.com
const mainSubdomain = (process.env.APP_MAIN_SUBDOMAIN || 'jewellery').trim().toLowerCase();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/jewellery',
  jwtSecret: jwtSecret || 'jewellery-management-secret-key',
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  uploadPath: process.env.UPLOAD_PATH || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880,
  baseDomain,
  mainSubdomain,
  mainHost: baseDomain ? `${mainSubdomain}.${baseDomain}` : '',
  nodeEnv,
};
