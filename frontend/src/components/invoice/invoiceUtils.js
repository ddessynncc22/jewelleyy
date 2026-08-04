import NepaliDate from 'nepali-date-converter';

export const GRAMS_PER_TOLA = 11.664;

export const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtWt = (n) => Number(n || 0).toFixed(3);

export function getBSDate(date) {
  if (!date) return '';
  try {
    const nd = new NepaliDate(new Date(date));
    return `${nd.getYear()}/${nd.getMonth()}/${nd.getDate()}`;
  } catch {
    return '';
  }
}

export function metalLabel(item) {
  const type = item.metalType ? item.metalType.charAt(0).toUpperCase() + item.metalType.slice(1) : '';
  const karat = item.karat ? `${item.karat}K` : '';
  return [type, karat].filter(Boolean).join(' ') || '-';
}

export function buildInvoiceItems(entries) {
  return (entries || []).map((entry, idx) => {
    const item = entry.item || entry;
    const qty = entry.quantity || entry.qty || 1;
    const grossWeight = Number(item.grossWeight || 0);
    const netWeight = Number(item.netMetalWeight || item.grossWeight || 0);
    const stoneWeight = Number(item.stoneWeight || 0);
    const lessWeight = Number((grossWeight - netWeight).toFixed(3));
    const ratePerGram = entry.ratePerGram || 0;
    const tolaRate = Math.round(ratePerGram * GRAMS_PER_TOLA);
    const purity = Number(item.purity || 0);
    const purityPercent =
      purity > 0 ? Number(((purity / 1000) * 100).toFixed(2)) : item.karat || '-';
    const metalAmount = netWeight * ratePerGram * (purity / 1000);
    const makingCharge = entry.makingCharge || entry.sellingMakingCharge || 0;
    const wastagePercent = entry.wastagePercent || entry.sellingWastagePercent || 0;
    const wastageAmount = metalAmount * (wastagePercent / 100);
    const stonePrice = Number(entry.stonePrice || entry.stoneAmount || 0);
    const stoneAmount = stonePrice * qty;
    const totalAmount = (metalAmount + makingCharge + wastageAmount + stonePrice) * qty;
    const isDiamond = item.metalType === 'diamond';

    return {
      sn: idx + 1,
      hsCode: item.hsCode || '',
      itemName: item.itemName || item.name || '-',
      type: metalLabel(item),
      purity: purityPercent,
      grossWeight: fmtWt(grossWeight),
      lessWeight: fmtWt(lessWeight),
      netWeight: fmtWt(netWeight),
      wastage: wastagePercent ? `${wastagePercent}%` : '',
      totalWeight: fmtWt(netWeight),
      rate: ratePerGram > 0 ? `${ratePerGram.toFixed(3)} (${tolaRate})` : '',
      makingCharge: fmtMoney(makingCharge),
      other: fmtMoney(0),
      diamondWt: isDiamond ? (item.carat ? String(item.carat) : '') : '',
      diamondAmount: isDiamond ? fmtMoney(0) : '',
      stoneWt: Number(stoneWeight) > 0 ? fmtWt(stoneWeight) : '',
      stoneAmount: stoneAmount > 0 ? fmtMoney(stoneAmount) : '',
      totalAmount: fmtMoney(totalAmount),
      _total: totalAmount,
    };
  });
}
