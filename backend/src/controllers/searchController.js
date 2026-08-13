const Item = require('../models/Item');
const Customer = require('../models/Customer');
const PawnLoan = require('../models/PawnLoan');
const Karigar = require('../models/Karigar');
const { successResponse, errorResponse } = require('../utils/response');
const { escapeRegex } = require('../utils/helpers');

exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return errorResponse(res, 'Search query is required', 400);
    }
    const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
    const [items, customers, pawnLoans, karigars] = await Promise.all([
      Item.find({
        $or: [
          { SKU: searchRegex },
          { barcode: searchRegex },
          { designCode: searchRegex },
          { category: searchRegex },
          { itemName: searchRegex },
        ],
      }).limit(20).lean(),
      Customer.find({
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { customerCode: searchRegex },
        ],
      }).limit(10).lean(),
      PawnLoan.find({
        $or: [
          { loanNumber: searchRegex },
          { 'customer.name': searchRegex },
          { 'customer.phone': searchRegex },
        ],
      }).limit(10).lean(),
      Karigar.find({
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { specialization: searchRegex },
        ],
      }).limit(10).lean(),
    ]);
    return successResponse(res, {
      query: q.trim(),
      items: items.map((i) => ({ ...i, _type: 'item', relevance: i.SKU === q.trim().toUpperCase() ? 10 : 5 })),
      customers: customers.map((c) => ({ ...c, _type: 'customer', relevance: c.phone === q.trim() ? 10 : 5 })),
      pawnLoans: pawnLoans.map((p) => ({ ...p, _type: 'pawnLoan', relevance: p.loanNumber === q.trim().toUpperCase() ? 10 : 5 })),
      karigars: karigars.map((k) => ({ ...k, _type: 'karigar', relevance: k.phone === q.trim() ? 10 : 5 })),
      totalResults: items.length + customers.length + pawnLoans.length + karigars.length,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
