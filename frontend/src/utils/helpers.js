import { format } from "date-fns";
import { getCachedSettings } from "../services/settingsService";
import { API_ORIGIN } from "../services/api";
export function formatCurrency(amount) {
  const s = getCachedSettings();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: s?.currency || "NPR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatDate(date, fmt = "dd/MM/yyyy") {
  if (!date) return "-";
  try {
    return format(new Date(date), fmt);
  } catch {
    return "-";
  }
}

export function formatDateTime(date) {
  return formatDate(date, "dd/MM/yyyy HH:mm");
}

export function formatWeight(weight, decimals = 3) {
  if (weight == null) return "-";
  return `${Number(weight).toFixed(decimals)} g`;
}

export function formatWeightLaal(weight, decimals = 3) {
  if (weight == null) return "-";
  const laal = Number(weight) * (100 / 11.6638);
  return `${laal.toFixed(decimals)} laal`;
}

export function formatWeightBoth(weight, decimals = 3) {
  if (weight == null) return "-";
  const laal = Number(weight) * (100 / 11.6638);
  return `${Number(weight).toFixed(decimals)} g / ${laal.toFixed(decimals)} laal`;
}

export function gramsToLaal(grams) {
  if (grams == null) return 0;
  return Number((grams * (100 / 11.6638)).toFixed(3));
}

export function laalToGrams(laal) {
  if (laal == null) return 0;
  return Number((laal * (11.6638 / 100)).toFixed(4));
}

export function getImageSrc(img) {
  if (!img) return null;
  if (img.startsWith("http")) return img;
  // Uploads are served by the API, so they follow it if it moves origin.
  // API_ORIGIN is "" in the default same-origin setup, leaving these relative.
  const path = img.startsWith("/uploads")
    ? img
    : `/uploads${img.startsWith("/") ? img : `/${img}`}`;
  return `${API_ORIGIN}${path}`;
}

export function getNepaliDate(date) {
  return formatDate(date, "dd/MM/yyyy");
}

export function getStatusColor(status) {
  const colors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    sold: "bg-blue-100 text-blue-800",
    lost: "bg-red-100 text-red-800",
    damaged: "bg-orange-100 text-orange-800",
    forfeited: "bg-red-100 text-red-800",
    redeemed: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-800",
    renewed: "bg-indigo-100 text-indigo-800",
    overdue: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function truncateText(text, maxLength = 50) {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

export function generateSkeleton(count = 1) {
  return Array.from({ length: count }, (_, i) => i);
}

export function calculateInterest(principal, monthlyRate, startDate, endDate) {
  if (!principal || !monthlyRate || !startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  const months = days / 30;
  return ((principal * monthlyRate) / 100) * months;
}

export function calculateTotalInterest(tranches, monthlyRate, asOfDate) {
  if (!tranches || !tranches.length) return 0;
  const end = asOfDate ? new Date(asOfDate) : new Date();
  return tranches
    .filter((t) => t.status === 'active')
    .reduce((sum, t) => {
      return sum + calculateInterest(t.amount, monthlyRate, t.dateTaken, end);
    }, 0);
}

export function getTrancheOutstanding(tranche, payments) {
  const paid = (payments || [])
    .filter((p) => p.paymentType === 'principal' && p.principalId && p.principalId === (tranche._id || tranche.id))
    .reduce((s, p) => s + (p.amount || 0), 0);
  return Math.max(0, (tranche.amount || 0) - paid);
}

export function getTotalPrincipalOutstanding(tranches, payments) {
  if (!tranches) return 0;
  const active = tranches.filter((t) => t.status === 'active');
  return active.reduce((sum, t) => sum + getTrancheOutstanding(t, payments), 0);
}

const _units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const _tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function _convert(num) {
  if (num < 20) return _units[num];
  if (num < 100) {
    const tens = _tens[Math.floor(num / 10)];
    const unit = _units[num % 10];
    return unit ? `${tens} ${unit}` : tens;
  }
  if (num < 1000) {
    const hundred = _units[Math.floor(num / 100)];
    const rest = _convert(num % 100);
    return rest ? `${hundred} Hundred ${rest}` : `${hundred} Hundred`;
  }
  if (num < 100000) {
    const thousand = _convert(Math.floor(num / 1000));
    const rest = _convert(num % 1000);
    return rest ? `${thousand} Thousand ${rest}` : `${thousand} Thousand`;
  }
  if (num < 10000000) {
    const lakh = _convert(Math.floor(num / 100000));
    const rest = _convert(num % 100000);
    return rest ? `${lakh} Lakh ${rest}` : `${lakh} Lakh`;
  }
  const crore = _convert(Math.floor(num / 10000000));
  const rest = _convert(num % 10000000);
  return rest ? `${crore} Crore ${rest}` : `${crore} Crore`;
}

export function numberToWords(num) {
  if (num == null || isNaN(num)) return '';
  const n = Number(num);
  if (n < 0) return `Minus ${_convert(Math.abs(Math.floor(n)))}`;
  const whole = Math.floor(n);
  const words = _convert(whole);
  return words || 'Zero';
}

export function getFiscalYear(date) {
  if (!date) return '-';
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

export function getInvoiceTaxSettings() {
  const settings = getCachedSettings();
  return settings?.taxSettings || {};
}

export function getInvoiceCurrency() {
  const settings = getCachedSettings();
  return settings?.currency || 'NPR';
}
