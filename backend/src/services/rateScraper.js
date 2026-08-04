const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

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

async function scrapeRates() {
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
        console.log(`[RateScraper] Unchanged ${entry.metalType}/${entry.unit} — already up to date`);
      }
    } else {
      await Rate.create(entry);
      console.log(`[RateScraper] Stored ${entry.metalType}/${entry.unit}: ${entry.rate}`);
    }
  }
}

async function runScraper() {
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

module.exports = { runScraper, scrapeRates, saveRates, getNepalToday, hasRatesForToday };
