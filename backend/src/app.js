const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Caddy is the only thing in front of the API, so one hop of X-Forwarded-For is
// trusted. Without this every request appears to come from the proxy, which
// would make the rate limiter a single global bucket and log the proxy's IP as
// the client IP on every activity log entry.
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Loopback plus the RFC1918 ranges Docker assigns to its bridge networks, so a
// sibling container counts as internal whether it reaches us over localhost or
// the compose network.
function isInternalAddress(address) {
  if (!address) return false;
  const ip = String(address).replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

const explicitOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

// With Caddy in front, the SPA and the API share an origin, so CORS only really
// matters for local dev. When a base domain is configured we additionally allow
// any of its subdomains, since every shop is served from one.
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (explicitOrigins && explicitOrigins.includes(origin)) return callback(null, true);

    let hostname;
    try {
      hostname = new URL(origin).hostname.toLowerCase();
    } catch {
      return callback(null, false);
    }

    if (config.baseDomain) {
      if (hostname === config.baseDomain || hostname.endsWith(`.${config.baseDomain}`)) {
        return callback(null, true);
      }
    }
    if (config.nodeEnv === 'development') {
      if (hostname === 'localhost' || hostname.endsWith('.localhost') || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
        return callback(null, true);
      }
    }
    // No base domain and no explicit list configured: preserve the previous
    // permissive behaviour rather than breaking single-domain deployments.
    if (!config.baseDomain && !explicitOrigins) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    data: null,
    errors: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Caddy's on-demand TLS gate is called once per unseen hostname by the proxy
  // itself. Rate-limiting it would make certificate issuance fail under a burst
  // of new shops, so internal callers skip the limiter.
  //
  // Checks the raw socket address, not req.ip: with trust proxy enabled req.ip
  // is the forwarded client IP, but this call originates from the proxy (or a
  // sibling container), which is exactly what we want to match.
  skip: (req) => req.path === '/public/tls-check' && isInternalAddress(req.socket.remoteAddress),
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

// Health stays above host resolution so monitoring works on any hostname.
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Jewellery Management API is running',
    data: {
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
    },
    errors: null,
  });
});

app.use(require('./middleware/host').resolveHost);

// Uploads are stored as /uploads/<tenantId>/<date>/<file>, so on a shop
// subdomain only that shop's directory is reachable. These files are still
// unauthenticated (anyone with the URL can fetch them) — this only stops one
// shop's addressable from serving another shop's images.
app.use('/uploads', (req, res, next) => {
  const context = req.hostContext || { type: 'local' };
  if (context.type !== 'tenant' || !req.hostTenant) return next();
  const segment = req.path.split('/').filter(Boolean)[0];
  if (segment && segment !== String(req.hostTenant.tenantNumber)) {
    return res.status(404).send('Not found');
  }
  return next();
}, express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api', require('./routes/index'));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    data: null,
    errors: null,
  });
});

app.use(errorHandler);

module.exports = app;
