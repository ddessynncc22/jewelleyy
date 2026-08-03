const config = require('./config');
const connectDB = require('./config/database');
const app = require('./app');
const cron = require('node-cron');
const { runScraper } = require('./services/rateScraper');

connectDB();

// Schedule daily gold/silver rate scrape at 11:30 AM Nepal time (UTC+5:45)
// cron expression: minute hour dayOfMonth month dayOfWeek
// 11:30 AM NPT = 05:45 UTC
cron.schedule('45 5 * * *', () => {
  console.log('[Cron] Running daily rate scraper...');
  runScraper();
});

// Also run once on startup so data is available immediately
runScraper();

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
