export const KARAT_PURITY = {
  '24K': '999',
  '22K': '916',
  '21K': '875',
  '18K': '750',
  '14K': '585',
  '10K': '417',
};

export const PURITY_TO_KARAT = Object.fromEntries(
  Object.entries(KARAT_PURITY).map(([k, v]) => [v, k])
);

export const SILVER_PURITIES = ['999', '925', '900', '875'];

export const KARAT_OPTIONS = Object.keys(KARAT_PURITY);
export const PURITY_OPTIONS = Object.values(KARAT_PURITY);

const round = (n, decimals = 4) => {
  const f = Math.pow(10, decimals);
  return Math.round((Number(n) || 0) * f) / f;
};

// Fine weight is always computed (gross x purity/1000). The item value is
// entered manually by the user — the rate is informational/reference only.
// Customer buy-backs also carry a weight deduction %: the customer is
// credited for the fine weight AFTER the deduction (givenWeightG).
export function computeLine(line, _rateLocked) {
  const gross = round(line.grossWeightG, 4);
  const purity = Math.min(1000, Math.max(1, round(line.purityPercent, 2)));
  const fine = round((gross * purity) / 1000, 4);
  const deductionPercent = Math.min(100, Math.max(0, round(line.deductionPercent || 0, 2)));
  const given = round(fine * (1 - deductionPercent / 100), 4);
  return {
    ...line,
    fineWeightG: fine,
    deductionPercent,
    givenWeightG: given,
    value: round(line.value, 2),
  };
}

export function computeTotals(lines) {
  let grossWeightG = 0;
  let fineWeightG = 0;
  let givenWeightG = 0;
  let goldValue = 0;
  let silverValue = 0;
  lines.forEach((it) => {
    grossWeightG = round(grossWeightG + it.grossWeightG, 4);
    fineWeightG = round(fineWeightG + it.fineWeightG, 4);
    givenWeightG = round(givenWeightG + it.givenWeightG, 4);
    if (it.metalType === 'gold') goldValue = round(goldValue + it.value);
    else silverValue = round(silverValue + it.value);
  });
  return { grossWeightG, fineWeightG, givenWeightG, goldValue, silverValue, totalValue: round(goldValue + silverValue) };
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];
