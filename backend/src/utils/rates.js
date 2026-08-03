const GRAMS_PER_TOLA = 11.6638;
const LAAL_PER_TOLA = 100;
const GRAMS_PER_LAAL = GRAMS_PER_TOLA / LAAL_PER_TOLA;
const LAAL_PER_GRAM = LAAL_PER_TOLA / GRAMS_PER_TOLA;

function toPerGramRate(latestRate) {
  if (!latestRate || !latestRate.rate) return 0;
  if (latestRate.unit === 'gram') return latestRate.rate;
  return latestRate.rate / GRAMS_PER_TOLA;
}

function gramsToLaal(grams) {
  if (grams == null || isNaN(grams)) return 0;
  return Number((grams * LAAL_PER_GRAM).toFixed(3));
}

function laalToGrams(laal) {
  if (laal == null || isNaN(laal)) return 0;
  return Number((laal * GRAMS_PER_LAAL).toFixed(4));
}

function gramsToTola(grams) {
  if (grams == null || isNaN(grams)) return 0;
  return Number((grams / GRAMS_PER_TOLA).toFixed(4));
}

function tolaToGrams(tola) {
  if (tola == null || isNaN(tola)) return 0;
  return Number((tola * GRAMS_PER_TOLA).toFixed(4));
}

module.exports = {
  GRAMS_PER_TOLA,
  LAAL_PER_TOLA,
  GRAMS_PER_LAAL,
  LAAL_PER_GRAM,
  toPerGramRate,
  gramsToLaal,
  laalToGrams,
  gramsToTola,
  tolaToGrams,
};
