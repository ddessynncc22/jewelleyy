const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const SOURCE_URL = 'https://www.hamropatro.com/gold';

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  for (const entry of entries) {
    const exists = await Rate.findOne({
      metalType: entry.metalType,
      unit: entry.unit,
      date: { $gte: today, $lt: new Date(today.getTime() + 86400000) },
    });

    if (!exists) {
      await Rate.create(entry);
      console.log(`[RateScraper] Stored ${entry.metalType}/${entry.unit}: ${entry.rate}`);
    } else {
      console.log(`[RateScraper] Skipped ${entry.metalType}/${entry.unit} — already exists for today`);
    }
  }
}

async function runScraper() {
  try {
    console.log('[RateScraper] Starting...');
    const rates = await scrapeRates();
    console.log('[RateScraper] Scraped:', rates);
    await saveRates(rates);
    console.log('[RateScraper] Done');
  } catch (err) {
    console.error('[RateScraper] Error:', err.message);
  }
}

module.exports = { runScraper, scrapeRates, saveRates };
