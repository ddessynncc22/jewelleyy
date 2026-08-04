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
const SCRAPE_CRON_TIMES = ['30 11 * * *', '0 13 * * *', '0 15 * * *', '0 17 * * *'];
for (const expr of SCRAPE_CRON_TIMES) {
  cron.schedule(
    expr,
    () => {
      console.log(`[Cron] Running rate scraper (${expr} NPT)...`);
      runScraper();
    },
    { timezone: 'Asia/Kathmandu' }
  );
}

// Catch-up scrape on boot: if no rate was stored for today yet (server was down
// at 11:30 NPT, process restarted late, or the cron was missed), scrape now.
// saveRates() is idempotent per day, so this cannot duplicate today's entry.
async function runScraperIfMissing() {
  try {
    const exists = await hasRatesForToday();
    if (!exists) {
      console.log('[RateScraper] No rates stored for today yet — running catch-up scrape');
      await runScraper();
    } else {
      console.log('[RateScraper] Today\'s rates already stored — skipping catch-up scrape');
    }
  } catch (err) {
    console.error('[RateScraper] Catch-up check failed:', err.message);
  }
}

// Run once on boot so data is available immediately and any missed daily run
// is recovered.
runScraperIfMissing();

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
  // Stated explicitly at boot because the difference is invisible until a user
  // is unexpectedly locked out.
  if (config.baseDomain) {
    console.log(`Host enforcement ON — superadmin: ${config.mainHost}, shops: <slug>.${config.baseDomain}`);
  } else {
    console.log('Host enforcement OFF — single domain, tenant resolved from JWT only');
  }
});
