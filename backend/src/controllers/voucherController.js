const mongoose = require('mongoose');
const Ledger = require('../models/Ledger');
const Voucher = require('../models/Voucher');
const VoucherEntry = require('../models/VoucherEntry');
const MetalToCashDetail = require('../models/MetalToCashDetail');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { scopeAggregate } = require('../utils/tenant');
const { getNextVoucherNumber } = require('../services/sequence');

const VOUCHER_TYPES = ['payment', 'receipt', 'contra', 'journal', 'metal_to_cash'];
const VOUCHER_TYPE_LABELS = {
  payment: 'Payment',
  receipt: 'Receipt',
  contra: 'Contra',
  journal: 'Journal',
  metal_to_cash: 'Metal to Cash',
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function isBalanced(entries) {
  let debits = 0;
  let credits = 0;
  for (const e of entries) {
    debits += Number(e.debit) || 0;
    credits += Number(e.credit) || 0;
  }
  return {
    debits: round2(debits),
    credits: round2(credits),
    balanced: Math.abs(round2(debits) - round2(credits)) < 0.005,
  };
}

// Each entry must be single-sided and carry a positive amount on exactly one side.
function validateEntrySides(entries) {
  for (let i = 0; i < entries.length; i += 1) {
    const debit = Number(entries[i].debit) || 0;
    const credit = Number(entries[i].credit) || 0;
    if (debit < 0 || credit < 0) {
      return `Entry ${i + 1}: debit/credit cannot be negative`;
    }
    if (!entries[i].ledger) {
      return `Entry ${i + 1}: ledger is required`;
    }
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      return `Entry ${i + 1}: exactly one side (debit or credit) must be greater than zero`;
    }
  }
  return null;
}

async function buildVoucherDetail(voucher) {
  const entries = await VoucherEntry.find({ voucher: voucher._id })
    .populate('ledger', 'name type group partyType partyName')
    .sort({ createdAt: 1 })
    .lean();
  const metalDetails = await MetalToCashDetail.find({ voucher: voucher._id }).lean();
  const { debits, credits } = isBalanced(entries);
  return {
    ...voucher.toObject(),
    typeLabel: VOUCHER_TYPE_LABELS[voucher.type] || voucher.type,
    debits,
    credits,
    entries,
    metalDetails,
  };
}

async function log(module, action, description, req, referenceId, referenceModel) {
  try {
    await ActivityLog.create({
      action,
      module,
      description,
      performedBy: req.user ? req.user._id : null,
      referenceId,
      referenceModel,
    });
  } catch (err) {
    // Audit logging is best effort; never break the main flow for it.
    console.error(`[${module}] activity log failed:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Ledgers
// ---------------------------------------------------------------------------

exports.getLedgers = async (req, res) => {
  try {
    const { page = 1, limit = 100, search, type, partyId } = req.query;
    const query = {};
    if (type) query.type = type;
    if (partyId) query.partyId = mongoose.Types.ObjectId.isValid(partyId) ? partyId : null;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { group: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [ledgers, total] = await Promise.all([
      Ledger.find(query)
        .populate('partyId', 'name phone customerCode')
        .sort({ type: 1, name: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Ledger.countDocuments(query),
    ]);
    return paginatedResponse(res, ledgers, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getLedger = async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id).populate('partyId', 'name phone customerCode');
    if (!ledger) {
      return errorResponse(res, 'Ledger not found', 404);
    }
    return successResponse(res, ledger);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createLedger = async (req, res) => {
  try {
    const { name, type, group, partyType, partyId, partyName, openingBalance } = req.body;
    if (!name || !type) {
      return errorResponse(res, 'Name and type are required', 400);
    }
    if (!['cash', 'bank', 'debtor', 'creditor', 'stock', 'income', 'expense'].includes(type)) {
      return errorResponse(res, 'Invalid ledger type', 400);
    }
    if (['debtor', 'creditor'].includes(type) && !partyId && !partyName) {
      return errorResponse(res, 'Debtor/creditor ledgers require a party (customer or name)', 400);
    }
    const ledger = await Ledger.create({
      name,
      type,
      group: group || '',
      partyType: partyType || 'none',
      partyId: partyId || null,
      partyName: (partyName || '').trim(),
      openingBalance: round2(Number(openingBalance) || 0),
    });
    await log('ledger', 'create', `Ledger "${ledger.name}" (${type}) created`, req, ledger._id, 'Ledger');
    return successResponse(res, ledger, 'Ledger created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateLedger = async (req, res) => {
  try {
    const { name, type, group, partyType, partyId, partyName, openingBalance } = req.body;
    const ledger = await Ledger.findById(req.params.id);
    if (!ledger) {
      return errorResponse(res, 'Ledger not found', 404);
    }
    if (name !== undefined) ledger.name = name;
    if (type !== undefined) {
      if (!['cash', 'bank', 'debtor', 'creditor', 'stock', 'income', 'expense'].includes(type)) {
        return errorResponse(res, 'Invalid ledger type', 400);
      }
      ledger.type = type;
    }
    if (group !== undefined) ledger.group = group;
    if (partyType !== undefined) ledger.partyType = partyType;
    if (partyId !== undefined) ledger.partyId = partyId;
    if (partyName !== undefined) ledger.partyName = partyName;
    if (openingBalance !== undefined) ledger.openingBalance = round2(Number(openingBalance) || 0);
    await ledger.save();
    await log('ledger', 'update', `Ledger "${ledger.name}" updated`, req, ledger._id, 'Ledger');
    return successResponse(res, ledger, 'Ledger updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteLedger = async (req, res) => {
  try {
    const ledger = await Ledger.findById(req.params.id);
    if (!ledger) {
      return errorResponse(res, 'Ledger not found', 404);
    }
    const used = await VoucherEntry.countDocuments({ ledger: ledger._id });
    if (used > 0) {
      return errorResponse(res, `Cannot delete ledger "${ledger.name}" — it is referenced by ${used} voucher entr${used === 1 ? 'y' : 'ies'}`, 400);
    }
    await ledger.softDelete();
    await log('ledger', 'delete', `Ledger "${ledger.name}" deleted`, req, ledger._id, 'Ledger');
    return successResponse(res, null, 'Ledger deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

async function saveVoucher(req, res, existing) {
  const { type, date, narration, referenceNo, entries, metalDetails } = req.body;

  if (!type || !VOUCHER_TYPES.includes(type)) {
    return errorResponse(res, `Voucher type must be one of: ${VOUCHER_TYPES.join(', ')}`, 400);
  }
  if (!Array.isArray(entries) || entries.length < 2) {
    return errorResponse(res, 'A voucher needs at least two line entries', 400);
  }

  const sideError = validateEntrySides(entries);
  if (sideError) {
    return errorResponse(res, sideError, 400);
  }

  const { debits, credits, balanced } = isBalanced(entries);
  if (!balanced || debits === 0) {
    return errorResponse(res, `Voucher does not balance — Debits: Rs. ${debits.toFixed(2)}, Credits: Rs. ${credits.toFixed(2)}`, 400);
  }

  // Restrict contra vouchers to cash/bank ledgers on both sides.
  if (type === 'contra') {
    const ledgerIds = entries.map((entry) => entry.ledger);
    const ledgers = await Ledger.find({ _id: { $in: ledgerIds } }).select('type name').lean();
    const notCashBack = ledgers.find((l) => !['cash', 'bank'].includes(l.type));
    if (notCashBack) {
      return errorResponse(res, `Contra vouchers may only use Cash/Bank ledgers. "${notCashBack.name}" is a "${notCashBack.type}" ledger.`, 400);
    }
    if (ledgers.length !== 2) {
      return errorResponse(res, 'Contra voucher requires exactly two Cash/Bank ledgers', 400);
    }
  }

  let metalValue = 0;
  let metalDetailDocs = [];
  if (type === 'metal_to_cash') {
    if (!metalDetails || metalDetails.length === 0) {
      return errorResponse(res, 'Metal to Cash voucher requires metal details', 400);
    }
    metalValue = 0;
    for (const detail of metalDetails) {
      const weight = Number(detail.weightG);
      const purity = Number(detail.purity);
      const rate = Number(detail.ratePerG);
      if (!detail.metalType || !['gold', 'silver'].includes(detail.metalType)) {
        return errorResponse(res, 'Metal type must be gold or silver', 400);
      }
      if (!weight || weight <= 0) {
        return errorResponse(res, 'Metal weight must be greater than zero', 400);
      }
      if (!rate || rate < 0) {
        return errorResponse(res, 'Metal rate per gram is required', 400);
      }
      if (purity < 0 || purity > 1000) {
        return errorResponse(res, 'Purity must be between 0 and 1000', 400);
      }
      metalValue = round2(metalValue + weight * (purity / 1000) * rate);
    }

    if (entries.length !== 2) {
      return errorResponse(res, 'Metal to Cash voucher requires exactly two entries (Stock and Cash/Debtor)', 400);
    }
    if (round2(debits) !== metalValue || round2(credits) !== metalValue) {
      return errorResponse(res, `Metal value (Rs. ${metalValue.toFixed(2)}) must equal voucher total (Rs. ${debits.toFixed(2)})`, 400);
    }

    const entryLedgers = await Ledger.find({ _id: { $in: entries.map((entry) => entry.ledger) } })
      .select('type name')
      .lean();
    const typeById = {};
    entryLedgers.forEach((l) => { typeById[String(l._id)] = l.type; });
    const debitEntry = entries.find((entry) => Number(entry.debit) > 0);
    const creditEntry = entries.find((entry) => Number(entry.credit) > 0);
    if (!debitEntry || !creditEntry) {
      return errorResponse(res, 'Metal to Cash voucher must have one debit and one credit entry', 400);
    }
    // Metal stock is credited (leaving stock), Cash/Debtor is debited (money in).
    if (typeById[String(creditEntry.ledger)] !== 'stock') {
      return errorResponse(res, 'The Stock ledger (Gold/Silver) must be on the credit side of a Metal to Cash voucher', 400);
    }
    if (typeById[String(debitEntry.ledger)] === 'stock') {
      return errorResponse(res, 'The counterpart ledger cannot be a Stock ledger', 400);
    }
  }

  const parsedDate = date ? new Date(date) : new Date();
  let voucher;
  if (existing) {
    voucher = existing;
  } else {
    voucher = new Voucher();
    voucher.voucherNumber = await getNextVoucherNumber(req.tenantId, type);
  }
  voucher.type = type;
  voucher.date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  voucher.narration = narration || '';
  voucher.referenceNo = referenceNo || '';
  await voucher.save();

  if (type === 'metal_to_cash') {
    metalDetailDocs = metalDetails.map((detail) => ({
      metalType: detail.metalType,
      purity: round2(Number(detail.purity) || 0),
      weightG: round2(Number(detail.weightG) || 0),
      ratePerG: round2(Number(detail.ratePerG) || 0),
      value: metalValue,
    }));
  }

  const voucherEntries = entries.map((entry) => ({
    voucher: voucher._id,
    ledger: entry.ledger,
    debit: round2(Number(entry.debit) || 0),
    credit: round2(Number(entry.credit) || 0),
    narration: entry.narration || '',
  }));

  if (existing) {
    // Replace entries on edit: hard-delete the old set, write the new one.
    await VoucherEntry.deleteMany({ voucher: voucher._id });
    await MetalToCashDetail.deleteMany({ voucher: voucher._id });
  }
  await Promise.all([
    VoucherEntry.insertMany(voucherEntries),
    metalDetailDocs.length > 0
      ? MetalToCashDetail.insertMany(metalDetailDocs)
      : Promise.resolve(),
  ]);

  const detail = await buildVoucherDetail(voucher);
  await log(
    'voucher',
    existing ? 'update' : 'create',
    `${existing ? 'Updated' : 'Created'} ${VOUCHER_TYPE_LABELS[type]} voucher ${voucher.voucherNumber}`,
    req,
    voucher._id,
    'Voucher'
  );
  return successResponse(res, detail, existing ? 'Voucher updated successfully' : 'Voucher created successfully', existing ? 200 : 201);
}

exports.createVoucher = async (req, res) => {
  try {
    return await saveVoucher(req, res, null);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return errorResponse(res, 'Voucher not found', 404);
    }
    return await saveVoucher(req, res, voucher);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getVouchers = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, startDate, endDate, party, search } = req.query;
    const query = {};
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(`${startDate}T00:00:00`);
      if (endDate) query.date.$lte = new Date(`${endDate}T23:59:59.999`);
    }
    if (search) {
      query.$or = [
        { voucherNumber: { $regex: search, $options: 'i' } },
        { narration: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
      ];
    }

    // Party filter: find vouchers whose entries touch a ledger linked to the party.
    if (party) {
      const ledgerFilter = mongoose.Types.ObjectId.isValid(party)
        ? { $or: [{ 'ledger.partyId': party }, { 'ledger.partyName': new RegExp(party, 'i') }] }
        : { 'ledger.partyName': { $regex: party, $options: 'i' } };
      const vouchers = await VoucherEntry.aggregate(
        scopeAggregate([
          { $match: { isDeleted: false } },
          { $lookup: { from: 'ledgers', localField: 'ledger', foreignField: '_id', as: 'ledger' } },
          { $unwind: '$ledger' },
          { $match: { 'ledger.isDeleted': false, ...ledgerFilter } },
          { $group: { _id: '$voucher' } },
          { $project: { _id: 1 } },
        ])
      );
      const ids = vouchers.map((v) => v._id);
      if (ids.length === 0) {
        return paginatedResponse(res, [], 0, Number(page), Number(limit));
      }
      query._id = { $in: ids };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [vouchers, total] = await Promise.all([
      Voucher.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Voucher.countDocuments(query),
    ]);

    const entries = await VoucherEntry.find({ voucher: { $in: vouchers.map((v) => v._id) } })
      .populate('ledger', 'name type partyName')
      .select('voucher ledger debit credit')
      .lean();
    const entriesByVoucher = {};
    entries.forEach((entry) => {
      const key = String(entry.voucher);
      if (!entriesByVoucher[key]) entriesByVoucher[key] = { debit: 0, credit: 0, entries: [] };
      entriesByVoucher[key].debit = round2(entriesByVoucher[key].debit + entry.debit);
      entriesByVoucher[key].credit = round2(entriesByVoucher[key].credit + entry.credit);
      entriesByVoucher[key].entries.push(entry);
    });

    const data = vouchers.map((v) => ({
      ...v,
      typeLabel: VOUCHER_TYPE_LABELS[v.type] || v.type,
      ...(entriesByVoucher[String(v._id)] || { debit: 0, credit: 0, total: 0 }),
    }));

    return paginatedResponse(res, data, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return errorResponse(res, 'Voucher not found', 404);
    }
    const detail = await buildVoucherDetail(voucher);
    return successResponse(res, detail);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return errorResponse(res, 'Voucher not found', 404);
    }
    await voucher.softDelete();
    await VoucherEntry.updateMany({ voucher: voucher._id }, { isDeleted: true });
    await MetalToCashDetail.updateMany({ voucher: voucher._id }, { isDeleted: true });
    await log('voucher', 'delete', `Deleted voucher ${voucher.voucherNumber}`, req, voucher._id, 'Voucher');
    return successResponse(res, null, 'Voucher deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

// 1. Voucher Report (explicit endpoint mirroring the filterable list)
exports.getVoucherReport = async (req, res) => {
  try {
    const { page = 1, limit = 100, type, startDate, endDate, party } = req.query;
    const query = {};
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(`${startDate}T00:00:00`);
      if (endDate) query.date.$lte = new Date(`${endDate}T23:59:59.999`);
    }
    if (party) {
      const ledgerFilter = mongoose.Types.ObjectId.isValid(party)
        ? { $or: [{ 'ledger.partyId': party }, { 'ledger.partyName': { $regex: party, $options: 'i' } }] }
        : { 'ledger.partyName': { $regex: party, $options: 'i' } };
      const rows = await VoucherEntry.aggregate(
        scopeAggregate([
          { $match: { isDeleted: false } },
          { $lookup: { from: 'ledgers', localField: 'ledger', foreignField: '_id', as: 'ledger' } },
          { $unwind: '$ledger' },
          { $match: { 'ledger.isDeleted': false, ...ledgerFilter } },
          { $group: { _id: '$voucher' } },
          { $project: { _id: 1 } },
        ])
      );
      query._id = { $in: rows.map((r) => r._id) };
      if (rows.length === 0) {
        return successResponse(res, { vouchers: [], summary: { totalDebit: 0, totalCredit: 0 } }, 'Voucher report retrieved');
      }
    }
    const vouchers = await Voucher.find(query).sort({ date: 1, createdAt: 1 }).lean();
    const entries = await VoucherEntry.find({ voucher: { $in: vouchers.map((v) => v._id) } })
      .populate('ledger', 'name type group partyName')
      .lean();
    const data = vouchers.map((v) => {
      const vEntries = entries.filter((entry) => String(entry.voucher) === String(v._id));
      return {
        ...v,
        typeLabel: VOUCHER_TYPE_LABELS[v.type] || v.type,
        entries: vEntries,
        debit: round2(vEntries.reduce((s, entry) => s + entry.debit, 0)),
        credit: round2(vEntries.reduce((s, entry) => s + entry.credit, 0)),
      };
    });
    const summary = {
      totalDebit: round2(data.reduce((s, v) => s + v.debit, 0)),
      totalCredit: round2(data.reduce((s, v) => s + v.credit, 0)),
    };
    return successResponse(res, { vouchers: data, summary }, 'Voucher report retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// 2. Voucher Details Report — same shape as the detail endpoint
exports.getVoucherDetailsReport = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return errorResponse(res, 'Voucher not found', 404);
    }
    const detail = await buildVoucherDetail(voucher);
    return successResponse(res, detail, 'Voucher details report retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// 3. Day Book — every voucher entry for a given date, chronological, both sides
exports.getDayBook = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return errorResponse(res, 'Date is required (format YYYY-MM-DD)', 400);
    }
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59.999`);
    const vouchers = await Voucher.find({ date: { $gte: start, $lte: end } }).sort({ date: 1, createdAt: 1 }).lean();
    const entries = await VoucherEntry.find({ voucher: { $in: vouchers.map((v) => v._id) } })
      .populate('ledger', 'name type group')
      .sort({ createdAt: 1 })
      .lean();

    const rows = [];
    let runningDebit = 0;
    let runningCredit = 0;
    entries.forEach((entry) => {
      runningDebit = round2(runningDebit + entry.debit);
      runningCredit = round2(runningCredit + entry.credit);
      const voucher = vouchers.find((v) => String(v._id) === String(entry.voucher));
      rows.push({
        _id: entry._id,
        date: voucher ? voucher.date : entry.createdAt,
        voucherNumber: voucher ? voucher.voucherNumber : '',
        voucherType: voucher ? VOUCHER_TYPE_LABELS[voucher.type] || voucher.type : '',
        voucherId: voucher ? voucher._id : null,
        ledgerId: entry.ledger ? entry.ledger._id : null,
        ledgerName: entry.ledger ? entry.ledger.name : '',
        ledgerType: entry.ledger ? entry.ledger.type : '',
        narration: voucher ? voucher.narration : '',
        debit: round2(entry.debit),
        credit: round2(entry.credit),
        runningDebit,
        runningCredit,
      });
    });

    return successResponse(res, {
      date,
      rows,
      summary: {
        totalDebit: round2(rows.reduce((s, row) => s + row.debit, 0)),
        totalCredit: round2(rows.reduce((s, row) => s + row.credit, 0)),
        voucherCount: vouchers.length,
      },
    }, 'Day book retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// 4. Ledger Report — T-account: opening, each entry, running balance, closing.
exports.getLedgerReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const ledger = await Ledger.findById(req.params.id).populate('partyId', 'name phone customerCode');
    if (!ledger) {
      return errorResponse(res, 'Ledger not found', 404);
    }

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(`${startDate}T00:00:00`);
    if (endDate) dateFilter.$lte = new Date(`${endDate}T23:59:59.999`);

    const rows = await VoucherEntry.aggregate(
      scopeAggregate([
        { $match: { isDeleted: false, ledger: ledger._id } },
        { $lookup: { from: 'vouchers', localField: 'voucher', foreignField: '_id', as: 'v' } },
        { $unwind: '$v' },
        { $match: { 'v.isDeleted': false, ...(startDate || endDate ? { 'v.date': dateFilter } : {}) } },
        { $sort: { 'v.date': 1, createdAt: 1 } },
        { $project: { _id: 1, voucher: '$v._id', voucherNumber: '$v.voucherNumber', voucherType: '$v.type', date: '$v.date', narration: '$v.narration', debit: 1, credit: 1, entryNarration: '$narration' } },
      ])
    );

    // Opening = opening balance + all entries before the period start.
    let opening = Number(ledger.openingBalance) || 0;
    if (startDate) {
      const before = await VoucherEntry.aggregate(
        scopeAggregate([
          { $match: { isDeleted: false, ledger: ledger._id } },
          { $lookup: { from: 'vouchers', localField: 'voucher', foreignField: '_id', as: 'v' } },
          { $unwind: '$v' },
          { $match: { 'v.isDeleted': false, 'v.date': { $lt: new Date(`${startDate}T00:00:00`) } } },
          { $group: { _id: null, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
        ])
      );
      opening = round2(opening + (before[0] ? before[0].debit : 0) - (before[0] ? before[0].credit : 0));
    }

    let running = opening;
    const entries = rows.map((row) => {
      running = round2(running + row.debit - row.credit);
      return {
        _id: row._id,
        voucherId: row.voucher,
        voucherNumber: row.voucherNumber,
        voucherType: VOUCHER_TYPE_LABELS[row.voucherType] || row.voucherType,
        date: row.date,
        narration: row.entryNarration || row.narration,
        debit: round2(row.debit),
        credit: round2(row.credit),
        runningBalance: running,
      };
    });

    const closing = round2(running);

    return successResponse(res, {
      ledger,
      openingBalance: opening,
      closingBalance: closing,
      ledgerTransactions: entries,
    }, 'Ledger report retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

async function buildSundryReport(type) {
  const ledgers = await Ledger.find({ type }).populate('partyId', 'name phone customerCode').lean();
  // Sum per-ledger from all non-deleted entries.
  const totals = await VoucherEntry.aggregate(
    scopeAggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$ledger',
          debit: { $sum: '$debit' },
          credit: { $sum: '$credit' },
          count: { $sum: 1 },
        },
      },
    ])
  );
  const byLedger = {};
  totals.forEach((t) => { byLedger[String(t._id)] = t; });

  const rows = ledgers.map((ledger) => {
    const t = byLedger[String(ledger._id)] || { debit: 0, credit: 0, count: 0 };
    const debit = round2(t.debit);
    const credit = round2(t.credit);
    const closing = round2((Number(ledger.openingBalance) || 0) + debit - credit);
    const outstanding = Math.abs(closing);
    return {
      _id: ledger._id,
      name: ledger.name,
      type: ledger.type,
      group: ledger.group,
      openingBalance: round2(Number(ledger.openingBalance) || 0),
      partyType: ledger.partyType,
      party: ledger.partyId,
      partyName: ledger.partyName || (ledger.party ? ledger.party.name : ''),
      entries: t.count,
      totalDebit: debit,
      totalCredit: credit,
      balance: closing,
      outstanding,
    };
  });

  // Debtors (money coming in) show positive when a balance is due to us.
  // We report the signed closing and let the UI interpret direction.
  rows.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  const totalOutstanding = round2(rows.reduce((s, r) => s + Math.abs(r.balance), 0));
  const net = round2(rows.reduce((s, r) => s + r.balance, 0));
  return { rows, summary: { totalOutstanding, net } };
}

// 5. Sundry Debtors Report
exports.getSundryDebtors = async (req, res) => {
  try {
    const { rows, summary } = await buildSundryReport('debtor');
    return successResponse(res, { debtors: rows, summary }, 'Sundry debtors report retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

// 6. Sundry Creditors Report
exports.getSundryCreditors = async (req, res) => {
  try {
    const { rows, summary } = await buildSundryReport('creditor');
    return successResponse(res, { creditors: rows, summary }, 'Sundry creditors report retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};