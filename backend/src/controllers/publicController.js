const config = require('../config');
const Tenant = require('../models/Tenant');
const { successResponse, errorResponse } = require('../utils/response');
const { classifyHost, normalizeHostname, isReservedSubdomain } = require('../middleware/host');

/**
 * Unauthenticated. Tells the SPA which host it is being served from so the login
 * screen can brand itself, and so the client can hide superadmin UI on a shop
 * address. resolveHost has already 404'd unknown shop subdomains.
 */
exports.getHostContext = async (req, res) => {
  try {
    const context = req.hostContext || { type: 'local', hostname: '' };
    const payload = {
      hostType: context.type,
      hostname: context.hostname,
      baseDomain: config.baseDomain || null,
      mainHost: config.mainHost || null,
      shop: null,
    };

    if (context.type === 'tenant' && req.hostTenant) {
      const t = req.hostTenant;
      payload.shop = {
        slug: t.slug,
        name: t.name,
        storeName: t.storeName || t.name,
        logoUrl: t.logoUrl || '',
        currency: t.currency || 'NPR',
      };
    }

    return successResponse(res, payload);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Caddy on-demand TLS gate. Caddy calls this before issuing a certificate for a
 * hostname it has never seen; a non-2xx reply means "do not issue", which stops
 * anyone pointing an arbitrary domain at the VPS and burning rate limits.
 *
 * Responds with bare status codes because Caddy only inspects the status.
 */
exports.checkTlsDomain = async (req, res) => {
  try {
    const hostname = normalizeHostname(req.query.domain);
    if (!hostname) return res.status(400).send('missing domain');
    if (!config.baseDomain) return res.status(503).send('base domain not configured');

    const context = classifyHost({ headers: { host: hostname } });

    if (context.type === 'main') return res.status(200).send('ok');
    if (context.type !== 'tenant') return res.status(404).send('not allowed');
    if (isReservedSubdomain(context.subdomain)) return res.status(404).send('reserved');

    const tenant = await Tenant.findOne({ slug: context.subdomain }).select('_id isActive').lean();
    if (!tenant || !tenant.isActive) return res.status(404).send('unknown shop');

    return res.status(200).send('ok');
  } catch (error) {
    // Fail closed: a DB blip must not let arbitrary domains obtain certificates.
    return res.status(503).send('unavailable');
  }
};
