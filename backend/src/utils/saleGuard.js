// Shared server-authoritative sale guards used by every POS entry point
// (tagged items, combined checkout, loose-lot bills). Pricing that arrives
// from the cashier's browser is advisory only — these re-derive what the bill
// may cost, how much may be discounted, and what "paid" means per payment type.

const MAX_DISCOUNT_PERCENT = 10;
const OLD_GOLD_VALUE_CAP = 1.25;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Returns the adjusted total and the enforced paid amount for the payment type.
// Cash must be paid in full; khaata books the whole bill to the ledger; partial
// and old-gold payments must land within [0, bill].
function enforcePayment(paymentType, billTotal, discount, paidAmount, cashAmount, resolvedCustomer) {
  const maxDiscount = Number((billTotal * MAX_DISCOUNT_PERCENT / 100).toFixed(2));
  if (discount > maxDiscount + 0.01) {
    throw httpError(`Discount cannot exceed ${MAX_DISCOUNT_PERCENT}% of the bill (max ${maxDiscount.toFixed(2)})`, 400);
  }
  const adjustedTotal = Number((billTotal - discount).toFixed(2));
  let paid = 0;
  if (paymentType === 'cash') {
    paid = adjustedTotal;
    if (cashAmount !== null && cashAmount !== undefined && Number(cashAmount) < paid - 0.01) {
      throw httpError(`Cash amount (${cashAmount}) cannot be less than the bill total (${paid.toFixed(2)})`, 400);
    }
  } else if (paymentType === 'khaata') {
    if (!resolvedCustomer) throw httpError('Customer is required for khaata payment', 400);
    paid = 0;
  } else if (paymentType === 'partial') {
    if (!resolvedCustomer) throw httpError('Customer is required for partial payment', 400);
    const rawPaid = Number(paidAmount);
    paid = Number.isFinite(rawPaid) ? Math.max(0, rawPaid) : 0;
    if (paid > adjustedTotal + 0.01) {
      throw httpError(`Paid amount cannot exceed the bill total (${adjustedTotal.toFixed(2)})`, 400);
    }
  } else if (paymentType === 'oldGoldExchange') {
    paid = Number(paidAmount) || 0;
    if (paid <= 0) throw httpError('Payment amount is required for old gold exchange', 400);
    if (paid > adjustedTotal + 0.01) {
      throw httpError(`Paid amount cannot exceed the bill total (${adjustedTotal.toFixed(2)})`, 400);
    }
  } else {
    throw httpError('Invalid payment type', 400);
  }
  return { adjustedTotal, paid };
}

// Old-gold buy-back value cap: what the shop pays the customer for their gold
// may not exceed 125% of its computed market value (net weight x karat x rate).
function validateOldGold(ogd, liveRates) {
  if (!ogd || !Number(ogd.weight) || Number(ogd.weight) <= 0) return ogd;
  const weight = Number(ogd.weight);
  const deductionPercent = Number(ogd.deductionPercent) || 0;
  const netWeight = Number((weight * (1 - deductionPercent / 100)).toFixed(4));
  let karat = Number(ogd.purity) || 0;
  if (karat > 0 && karat <= 1) karat = karat * 24;
  karat = Math.min(karat, 24);
  const rate = Number(liveRates.gold) || 0;
  const value = Number(ogd.value) || 0;
  if (karat > 0 && rate > 0) {
    const computed = Number((netWeight * (karat / 24) * rate).toFixed(2));
    const cap = Number((computed * OLD_GOLD_VALUE_CAP).toFixed(2));
    if (computed > 0 && value > cap + 0.01) {
      throw httpError(`Old gold value exceeds its computed market value (max ${cap.toFixed(2)})`, 400);
    }
  }
  return ogd;
}

module.exports = {
  MAX_DISCOUNT_PERCENT,
  OLD_GOLD_VALUE_CAP,
  httpError,
  enforcePayment,
  validateOldGold,
};