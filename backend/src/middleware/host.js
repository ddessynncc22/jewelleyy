const config = require('../config');
const Tenant = require('../models/Tenant');
const { errorResponse } = require('../utils/response');

// Subdomains that can never belong to a shop. Anything routed at the infra
// level or likely to be added later (mail, cdn, status pages) is claimed here so
// a tenant slug can never shadow it.
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'smtp', 'imap', 'pop', 'ftp', 'ns', 'ns1', 'ns2',
  'cdn', 'static', 'assets', 'uploads', 'img', 'images', 'media',
  'dev', 'staging', 'stage', 'test', 'demo', 'preview', 'sandbox',
  'status', 'health', 'monitor', 'metrics', 'grafana', 'kibana',
  'blog', 'docs', 'help', 'support', 'billing', 'pay', 'checkout',
  'auth', 'login', 'account', 'accounts', 'dashboard', 'portal',
  'shop', 'shops', 'store', 'stores', 'tenant', 'tenants', 'superadmin', 'root',
]);

// DNS label rules, minus the ones that would produce confusing shop URLs:
// 3-63 chars, lowercase alphanumeric plus internal hyphens, no leading digit-only names.
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

function isReservedSubdomain(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (RESERVED_SUBDOMAINS.has(slug)) return true;
  // The superadmin host is reserved even when it isn't in the static list.
  return !!config.mainSubdomain && slug === config.mainSubdomain;
}

function validateSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!slug) return { valid: false, reason: 'Subdomain is required' };
  if (slug.length < 3) return { valid: false, reason: 'Subdomain must be at least 3 characters' };
  if (slug.length > 63) return { valid: false, reason: 'Subdomain must be at most 63 characters' };
  if (!SLUG_PATTERN.test(slug)) {
    return { valid: false, reason: 'Subdomain may only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen' };
  }
  if (slug.includes('--')) return { valid: false, reason: 'Subdomain cannot contain consecutive hyphens' };
  if (isReservedSubdomain(slug)) return { valid: false, reason: `"${slug}" is a reserved subdomain` };
  return { valid: true, slug };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63)
    .replace(/-$/, '');
}

function normalizeHostname(rawHost) {
  return String(rawHost || '')
    .split(',')[0]           // X-Forwarded-Host may carry a list
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')    // strip port
    .replace(/^\[|\]$/g, '') // strip IPv6 brackets
    .replace(/\.$/, '');     // strip FQDN trailing dot
}

const IP_LIKE = /^(\d{1,3}\.){3}\d{1,3}$|:/;

/**
 * Classifies the request host into one of:
 *   local  - localhost/IP, or no APP_BASE_DOMAIN configured. No enforcement.
 *   main   - the superadmin host (jewellery.example.com) or the bare base domain.
 *   tenant - <slug>.example.com, with `subdomain` set.
 *   foreign- a host that does not belong to the configured base domain.
 */
function classifyHost(req) {
  const hostname = normalizeHostname(req.headers['x-forwarded-host'] || req.headers.host);

  if (!config.baseDomain) return { type: 'local', hostname, subdomain: null };
  if (!hostname) return { type: 'local', hostname, subdomain: null };
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || IP_LIKE.test(hostname)) {
    return { type: 'local', hostname, subdomain: null };
  }

  if (hostname === config.baseDomain || hostname === `www.${config.baseDomain}`) {
    return { type: 'main', hostname, subdomain: null };
  }
  if (!hostname.endsWith(`.${config.baseDomain}`)) {
    return { type: 'foreign', hostname, subdomain: null };
  }

  const label = hostname.slice(0, -1 * (config.baseDomain.length + 1));
  // Only single-label subdomains are shops; a.b.example.com is not a shop.
  if (label.includes('.')) return { type: 'foreign', hostname, subdomain: null };
  if (label === config.mainSubdomain) return { type: 'main', hostname, subdomain: label };

  return { type: 'tenant', hostname, subdomain: label };
}

/**
 * Global middleware: attaches req.hostContext for every request and, on a shop
 * subdomain, resolves the owning tenant into req.hostTenant.
 *
 * Unknown or deactivated shop subdomains are rejected here so no route ever has
 * to consider them.
 */
async function resolveHost(req, res, next) {
  try {
    const context = classifyHost(req);
    req.hostContext = context;
    req.hostTenant = null;

    if (context.type !== 'tenant') return next();

    if (isReservedSubdomain(context.subdomain)) {
      return errorResponse(res, 'Unknown shop address', 404);
    }

    const tenant = await Tenant.findOne({ slug: context.subdomain }).lean();
    if (!tenant) {
      return errorResponse(res, `No shop is registered at ${context.hostname}`, 404);
    }
    if (!tenant.isActive) {
      return errorResponse(res, 'This shop account has been deactivated. Contact the administrator.', 403);
    }

    req.hostTenant = tenant;
    return next();
  } catch (error) {
    return next(error);
  }
}

function shopUrlFor(slug, req) {
  if (!config.baseDomain || !slug) return null;
  const protocol = req && req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
  return `${protocol}://${slug}.${config.baseDomain}`;
}

module.exports = {
  resolveHost,
  classifyHost,
  normalizeHostname,
  validateSlug,
  slugify,
  isReservedSubdomain,
  shopUrlFor,
  RESERVED_SUBDOMAINS,
};
