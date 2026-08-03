function generateSKU() {
  const prefix = 'JW';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

function generateSaleNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `SALE-${year}${month}${day}-${random}`;
}

function generateLoanNumber() {
  const prefix = 'PLN';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

function generateCustomerCode() {
  const prefix = 'CUST';
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

function calculateBalance(total, paid) {
  const balance = total - paid;
  return balance < 0 ? 0 : Math.round(balance * 100) / 100;
}

function formatWeight(weight, decimals = 3) {
  if (weight === null || weight === undefined) return '0.000';
  return Number(weight).toFixed(decimals);
}

function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD MMM YYYY':
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[d.getMonth()]} ${year}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

function getNepaliDate(date) {
  if (!date) date = new Date();
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const gYear = d.getFullYear();
  const gMonth = d.getMonth() + 1;

  let nepaliYear = gYear + 57;
  let nepaliMonth = gMonth;
  let nepaliDay = d.getDate();

  if (gMonth <= 3) {
    nepaliYear = gYear + 56;
  }

  nepaliMonth = ((gMonth + 9) % 12) + 1;

  if (gMonth <= 3) {
    nepaliDay = d.getDate() + 15;
    if (nepaliDay > 32) {
      nepaliDay -= 32;
      nepaliMonth += 1;
    }
  } else {
    nepaliDay = d.getDate() - 15;
    if (nepaliDay <= 0) {
      nepaliMonth -= 1;
      if (nepaliMonth <= 0) {
        nepaliMonth = 12;
        nepaliYear -= 1;
      }
      nepaliDay += 30;
    }
  }

  return `${nepaliYear}-${String(nepaliMonth).padStart(2, '0')}-${String(nepaliDay).padStart(2, '0')}`;
}

function getPagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSearchFilter(query, searchFields = []) {
  const filter = {};
  if (query.search && searchFields.length > 0) {
    const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = searchFields.map((field) => ({ [field]: searchRegex }));
  }
  return filter;
}

function toObjectId(id) {
  const mongoose = require('mongoose');
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
}

module.exports = {
  generateSKU,
  generateSaleNumber,
  generateLoanNumber,
  generateCustomerCode,
  calculateBalance,
  formatWeight,
  formatDate,
  getNepaliDate,
  getPagination,
  escapeRegex,
  getSearchFilter,
  toObjectId,
};
