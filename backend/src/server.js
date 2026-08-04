const config = require('./config');
const connectDB = require('./config/database');
const app = require('./app');
const cron = require('node-cron');
const Rate = require('./models/Rate');
const { runScraper } = require('./services/rateScraper');

connectDB();

// Schedule daily gold/silver rate scrape at 11:30 AM Nepal time (UTC+5:45).
// The timezone is pinned to Asia/Kathmandu because node-cron otherwise uses
// the VPS's own local timezone (usually UTC), so a bare '45 5 * * *' would fire
// at the wrong hour and is easily missed if the process restarts around then.
cron.schedule(
  '30 11 * * *',
  () => {
    console.log('[Cron] Running daily rate scraper (11:30 NPT)...');
    runScraper();
  },
  { timezone: 'Asia/Kathmandu' }
);

// Catch-up scrape on boot: if no rate was stored for today yet (server was down
// at 11:30 NPT, process restarted late, or the cron was missed), scrape now.
// saveRates() is idempotent per day, so this cannot duplicate today's entry.
async function runScraperIfMissing() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exists = await Rate.exists({
      date: { $gte: today, $lt: new Date(today.getTime() + 86400000) },
    });
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
