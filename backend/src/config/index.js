const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Some networks (e.g. VPN/CGNAT DNS, as on this dev machine) refuse Node's
// SRV/TXT DNS queries, which breaks mongodb+srv:// connection strings. When
// DNS_OVERRIDE is set, pin the resolver to public servers before mongoose boots.
if (process.env.DNS_OVERRIDE) {
  const dns = require('dns');
  dns.setServers(process.env.DNS_OVERRIDE.split(',').map((s) => s.trim()));
  console.log(`DNS overridden to: ${process.env.DNS_OVERRIDE}`);
}

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
