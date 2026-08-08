const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

// FENEGOSIDA — the Federation of Nepal Gold & Silver Dealers' Association — is
// the body that actually SETS the daily rate; hamropatro just republishes it.
// This is their own site's JSON API, so it needs no HTML parsing and does not
// break when either site is redesigned.
//
// It is also the only source that works in production: hamropatro (behind
// Cloudflare) returns 403 to the VPS's datacenter IP, which is why scraping
// silently stopped producing new rows.
const FENEGOSIDA_URL = 'https://api.fenegosida.org/api/website/v1/Dashboard/today';
const SOURCE_URL = 'https://www.hamropatro.com/gold';
const NEPAL_TIMEZONE = 'Asia/Kathmandu';

// Midnight of the *Nepal* calendar day, as an absolute instant. The VPS usually
// runs in UTC, so a naive new Date(); setHours(0,0,0,0) can mis-bucket the day
// (Nepal is UTC+5:45, no DST). Returns a Date equal to 00:00 +05:45.
function getNepalToday() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: NEPAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const map = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
    return new Date(`${map.year}-${map.month}-${map.day}T00:00:00+05:45`);
  } catch (err) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}

// True when at least one rate is already stored for the current Nepal day.
async function hasRatesForToday() {
  const today = getNepalToday();
  const end = new Date(today.getTime() + 86400000);
  return Rate.exists({ date: { $gte: today, $lt: end } });
}

// When hamropatro's number for the day is treated as final. Anything stored
// before this is presumed to be yesterday's carried-over value. Keep in sync
// with the first entry of SCRAPE_CRON_TIMES in server.js.
const PUBLISH_OFFSET_MS = (11 * 60 + 31) * 60 * 1000;

// The instant 11:31 NPT falls on for the current Nepal day.
function publishInstant() {
  return new Date(getNepalToday().getTime() + PUBLISH_OFFSET_MS);
}

function parseNpr(text) {
  const cleaned = (text || '').replace(/[^0-9,.]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Hamropatro is a Next.js app; today's rates are embedded in the React Server
// Component payload as "enSegment" JSON. This extracts it from the __next_f scripts.
function parseEnSegment(html) {
  const scriptRe = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    let decoded;
    try {
      decoded = JSON.parse('"' + match[1] + '"');
    } catch (err) {
      continue;
    }
    const segmentStart = decoded.indexOf('"enSegment"');
    if (segmentStart === -1) continue;
    const jsonStart = decoded.indexOf('{', segmentStart);
    const jsonEnd = decoded.indexOf(',"npSegment"');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) continue;
    try {
      return JSON.parse(decoded.slice(jsonStart, jsonEnd));
    } catch (err) {
      return null;
    }
  }
  return null;
}

// Rows come back as { rateType, todayBaseRatePerGram }. The field name lies —
// for a "(१ तोला)" row the value is per tola — so the unit is taken from the
// rateType label, never from the field name.
//
// Labels are Devanagari: सुन = gold, चाँदी = silver. Matching on those also
// skips the "International Gold Rate" and "American Dollar Rate" rows, which are
// English and are not what we store.
function mapFenegosidaRates(rows) {
  const rates = { goldPerTola: 0, goldPerGram: 0, silverPerTola: 0, silverPerGram: 0 };

  for (const row of rows || []) {
    const label = String(row.rateType || '');
    const value = Number(row.todayBaseRatePerGram);
    if (!value || !isFinite(value)) continue;

    const isGold = label.includes('सुन');
    const isSilver = label.includes('चाँदी');
    if (!isGold && !isSilver) continue;

    if (label.includes('तोला')) {
      if (isGold) rates.goldPerTola = value;
      else rates.silverPerTola = value;
    } else if (label.includes('ग्राम')) {
      // Currently published as "(१० ग्राम)" — a per-10g figure. Divide only when
      // the label actually says १०, so a future "(१ ग्राम)" is not quartered.
      const perGram = label.includes('१०') ? value / 10 : value;
      if (isGold) rates.goldPerGram = perGram;
      else rates.silverPerGram = perGram;
    }
  }

  return rates;
}

async function fetchFenegosidaRates() {
  console.log('[RateScraper] Fetching', FENEGOSIDA_URL);
  const { data } = await axios.get(FENEGOSIDA_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'jewellery-management/1.0' },
    timeout: 15000,
  });
  if (!Array.isArray(data)) throw new Error('FENEGOSIDA returned a non-array payload');
  return mapFenegosidaRates(data);
}

async function scrapeHamropatro() {
  console.log('[RateScraper] Fetching', SOURCE_URL);
  const { data: html } = await axios.get(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  const rates = { goldPerTola: 0, goldPerGram: 0, silverPerTola: 0, silverPerGram: 0 };

  // --- Price cards: per-tola values rendered server-side ---
  $('li.hp-card-surface').each((_, el) => {
    const title = $(el).find('span.text-title-sm').first().text().trim().toLowerCase();
    const price = $(el).find('p.tabular-nums').first().text();
    const value = parseNpr(price);

    if (title.includes('gold')) {
      rates.goldPerTola = value;
    } else if (title.includes('silver')) {
      rates.silverPerTola = value;
    }
  });

  // --- Per-gram rates from the embedded RSC data (10 gms price / 10) ---
  const segment = parseEnSegment(html);
  if (segment && Array.isArray(segment.items)) {
    for (const item of segment.items) {
      if (!item.prices || !item.name) continue;
      const tenGram = item.prices.find((p) =>
        String(p.name || '').toLowerCase().includes('10 gm')
      );
      const value = tenGram && tenGram.price && tenGram.price.price;
      if (!value) continue;
      const name = String(item.name).toLowerCase();
      if (name.includes('gold')) {
        rates.goldPerGram = value / 10;
      } else if (name.includes('silver')) {
        rates.silverPerGram = value / 10;
      }
    }
  }

  // Fallback: compute per-gram from per-tola if scraping per-gram failed
  if (!rates.goldPerGram && rates.goldPerTola) {
    rates.goldPerGram = Math.round(rates.goldPerTola / 11.664);
  }
  if (!rates.silverPerGram && rates.silverPerTola) {
    rates.silverPerGram = Math.round(rates.silverPerTola / 11.664);
  }

  return rates;
}

/**
 * FENEGOSIDA's JSON API first, hamropatro's HTML as a fallback.
 *
 * Both publish the same numbers because hamropatro republishes FENEGOSIDA, but
 * only FENEGOSIDA answers the production server — hamropatro 403s datacenter
 * IPs. The fallback still earns its place for local development and for the day
 * FENEGOSIDA's API moves.
 */
async function scrapeRates() {
  let primaryError;
  try {
    const rates = await fetchFenegosidaRates();
    if (rates.goldPerTola) return rates;
    primaryError = new Error('FENEGOSIDA returned no gold/tola rate');
  } catch (err) {
    primaryError = err;
  }

  console.warn('[RateScraper] FENEGOSIDA failed (%s) — falling back to hamropatro', primaryError.message);
  return scrapeHamropatro();
}

async function saveRates(rates) {
  const today = getNepalToday();
  const end = new Date(today.getTime() + 86400000);

  const entries = [];

  if (rates.goldPerTola) {
    entries.push({
      metalType: 'gold',
      rate: rates.goldPerTola,
      unit: 'tola',
      date: today,
    });
  }

  if (rates.goldPerGram) {
    entries.push({
      metalType: 'gold',
      rate: rates.goldPerGram,
      unit: 'gram',
      date: today,
    });
  }

  if (rates.silverPerTola) {
    entries.push({
      metalType: 'silver',
      rate: rates.silverPerTola,
      unit: 'tola',
      date: today,
    });
  }

  if (rates.silverPerGram) {
    entries.push({
      metalType: 'silver',
      rate: rates.silverPerGram,
      unit: 'gram',
      date: today,
    });
  }

  // Upsert per (metalType, unit, day): hamropatro may not refresh its page until
  // well after 11:30 NPT, so a later scrape must overwrite a stale early value
  // rather than skip it ("already exists for today").
  for (const entry of entries) {
    const existing = await Rate.findOne({
      metalType: entry.metalType,
      unit: entry.unit,
      date: { $gte: today, $lt: end },
    });

    if (existing) {
      if (existing.rate !== entry.rate) {
        const oldRate = existing.rate;
        existing.rate = entry.rate;
        await existing.save();
        console.log(`[RateScraper] Updated ${entry.metalType}/${entry.unit}: ${oldRate} → ${entry.rate}`);
      } else {
        // Touch the row even though the value is identical. updateOne bumps
        // updatedAt where an unmodified save() would be a no-op, and isStale()
        // reads updatedAt to tell "checked after 11:31" from "never rechecked".
        await Rate.updateOne({ _id: existing._id }, { $set: { rate: entry.rate } });
        console.log(`[RateScraper] Unchanged ${entry.metalType}/${entry.unit} — already up to date`);
      }
    } else {
      await Rate.create(entry);
      console.log(`[RateScraper] Stored ${entry.metalType}/${entry.unit}: ${entry.rate}`);
    }
  }
}

async function runScraperOnce() {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[RateScraper] Starting... (attempt ${attempt}/${maxAttempts})`);
      const rates = await scrapeRates();

      const anyValue =
        rates.goldPerTola || rates.goldPerGram || rates.silverPerTola || rates.silverPerGram;
      if (!anyValue) {
        throw new Error('scrape returned no values (all zero) — refusing to store');
      }

      console.log('[RateScraper] Scraped:', rates);
      await saveRates(rates);
      console.log('[RateScraper] Done');
      return rates;
    } catch (err) {
      if (attempt < maxAttempts) {
        const delayMs = 10000 * attempt;
        console.error(
          `[RateScraper] Attempt ${attempt} failed (${err.message}). Retrying in ${delayMs / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error('[RateScraper] Error after all attempts:', err.message);
      }
    }
  }
}

// Only one scrape may be in flight, and unforced callers may not start one more
// often than this. Both guards exist because GET /rates/latest is public and
// unauthenticated — without them, page loads would hammer hamropatro.
const MIN_INTERVAL_MS = 10 * 60 * 1000;

let inFlight = null;
let lastAttemptAt = 0;

/**
 * Runs the scraper, collapsing concurrent callers onto one run. `force` bypasses
 * the cooldown and is what the cron uses, so a page load shortly beforehand can
 * never turn a scheduled run into a no-op. Never throws.
 */
function runScraper({ force = false } = {}) {
  if (inFlight) return inFlight;

  if (!force && Date.now() - lastAttemptAt < MIN_INTERVAL_MS) {
    return Promise.resolve(undefined);
  }
  lastAttemptAt = Date.now();

  const pending = runScraperOnce().finally(() => {
    inFlight = null;
  });

  inFlight = pending;
  return pending;
}

/**
 * True when today's rate is missing, or when it was last refreshed before
 * today's 11:31 NPT cutoff and that time has passed — i.e. what we are holding
 * is yesterday's number.
 */
async function isStale(now = new Date()) {
  const today = getNepalToday();
  const end = new Date(today.getTime() + 86400000);

  const row = await Rate.findOne({
    metalType: 'gold',
    unit: 'tola',
    date: { $gte: today, $lt: end },
  })
    .select('updatedAt')
    .lean();

  if (!row) return true;

  const publishAt = publishInstant();
  if (now < publishAt) return false;
  return new Date(row.updatedAt) < publishAt;
}

/**
 * Called from GET /rates/latest so opening the site pulls a fresh rate. Scrapes
 * only when the data is actually stale and waits at most `waitMs` — if
 * hamropatro is slow the visitor still gets what is already stored, and the
 * scrape finishes in the background for whoever loads next.
 */
async function ensureFreshRates({ waitMs = 4000 } = {}) {
  try {
    if (!(await isStale())) return false;
    const pending = runScraper();
    if (waitMs > 0) {
      await Promise.race([pending, new Promise((r) => setTimeout(r, waitMs))]);
    }
    return true;
  } catch (err) {
    console.error('[RateScraper] Freshness check failed:', err.message);
    return false;
  }
}

module.exports = {
  runScraper,
  scrapeRates,
  saveRates,
  getNepalToday,
  hasRatesForToday,
  publishInstant,
  isStale,
  ensureFreshRates,
};
