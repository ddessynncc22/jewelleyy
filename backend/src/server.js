const config = require('./config');
const connectDB = require('./config/database');
const app = require('./app');
const cron = require('node-cron');
const { runScraper, hasRatesForToday } = require('./services/rateScraper');

connectDB();

// Daily rate scrape in Nepal time (UTC+5:45), pinned to Asia/Kathmandu because
// node-cron otherwise uses the VPS's own local timezone (usually UTC). Ran a few
// times per day: saveRates() is idempotent and overwrites stale early-morning
// values, so this both survives a single failed run and picks up hamropatro's
// rate the moment the page refreshes. The 11:30 NPT window is when hamropatro
// usually publishes; the later runs are safety nets that make a restart
// unnecessary when the first attempt fails.
const SCRAPE_CRON_TIMES = ['31 11 * * *', '0 13 * * *', '0 15 * * *', '0 17 * * *'];
for (const expr of SCRAPE_CRON_TIMES) {
  cron.schedule(
    expr,
    () => {
      console.log(`[Cron] Running rate scraper (${expr} NPT)...`);
      // force: a visitor opening the site shortly beforehand starts an on-demand
      // scrape, and its cooldown would otherwise swallow this scheduled run.
      runScraper({ force: true });
    },
    { timezone: 'Asia/Kathmandu' }
  );
}

// Run once on boot so data is available immediately and any missed daily run
// is recovered.
async function runScraperIfMissing() {
  try {
    console.log('[RateScraper] Running catch-up scrape at boot');
    await runScraper({ force: true });
  } catch (err) {
    console.error('[RateScraper] Catch-up scrape failed:', err.message);
  }
}

runScraperIfMissing();

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
  // Stated explicitly at boot because the difference is invisible until a user
  // is unexpectedly locked out.
  if (config.baseDomain) {
    console.log(`Host enforcement ON — superadmin: ${config.mainHost}, shops: <slug>.${config.baseDomain}`);
  } else {
    console.log('Host enforcement OFF — single domain, tenant resolved from JWT only');
  }
});

// Vite's http-proxy pools keep-alive sockets for far longer than Node's default
// 5s server keepAliveTimeout. When the server closes an idle socket that the
// proxy still holds, a concurrent request burst (e.g. opening a form that fires
// several parallel calls) can land on the dead socket and surface as an
// intermittent 502 through the proxy. Raising the timeout keeps the pool aligned.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 0;
