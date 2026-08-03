const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Sale = require('../models/Sale');
const PawnLoan = require('../models/PawnLoan');
const CustomOrder = require('../models/CustomOrder');
const { scopeAggregate } = require('../utils/tenant');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { getNextCustomerCode } = require('../services/sequence');

const DAY_MS = 86400000;
const PAWN_ACTIVE_STATUSES = ['Active', 'Renewed'];
const CUSTOM_ORDER_ACTIVE_STATUSES = ['booked', 'material_issued', 'in_progress', 'ready'];

function daysBetween(from, to) {
  return Math.max(0, Math.floor((new Date(to) - new Date(from)) / DAY_MS));
}

function trancheInterest(amount, monthlyRate, from, to) {
  return ((amount || 0) * (monthlyRate || 0)) / 100 * (daysBetween(from, to) / 30);
}

function loanInterestAccrued(loan, asOf) {
  const activeTranches = (loan.tranches || []).filter((t) => t.status === 'active');
  const effective = activeTranches.length > 0
    ? activeTranches
    : [{ amount: loan.loanAmount, dateTaken: loan.startDate }];
  return effective.reduce((sum, t) => sum + trancheInterest(t.amount, loan.interestRate, t.dateTaken, asOf), 0);
}

function enrichPawnLoan(l) {
  const active = PAWN_ACTIVE_STATUSES.includes(l.status);
  const accrued = loanInterestAccrued(l, new Date());
  return {
    _id: l._id,
    loanNumber: l.loanNumber,
    loanAmount: l.loanAmount,
    balance: l.balance,
    totalPaid: l.totalPaid,
    interestRate: l.interestRate,
    interestCollected: l.interestCollected || 0,
    interestToAcquire: active ? Number(Math.max(0, accrued - (l.interestCollected || 0)).toFixed(2)) : 0,
    startDate: l.startDate,
    dueDate: l.dueDate,
    status: l.status,
    itemDetails: l.itemDetails,
    valuation: l.valuation,
    daysOverdue: l.dueDate && new Date(l.dueDate) < new Date() ? Math.max(0, Math.floor((new Date() - new Date(l.dueDate)) / DAY_MS)) : 0,
  };
}

const STORED_SORT_FIELDS = ['name', 'customerCode', 'createdAt', 'phone', 'email'];
const COMPUTED_SORT_FIELDS = ['totalSpent', 'purchaseCount', 'outstandingBalance', 'balance', 'lastTransaction', 'lastPurchaseDate', 'activePawnLoans'];

function enrichCustomOrder(o) {
  const active = CUSTOM_ORDER_ACTIVE_STATUSES.includes(o.status);
  const daysOverdue = o.targetCompletionDate && active
    ? Math.max(0, Math.floor((new Date() - new Date(o.targetCompletionDate)) / DAY_MS))
    : 0;
  return {
    _id: o._id,
    orderNumber: o.orderNumber,
    category: o.category,
    itemName: o.itemName,
    status: o.status,
    advanceAmount: o.advanceAmount || 0,
    finalPrice: o.finalPrice || 0,
    requestedWeight: o.requestedWeight || 0,
    targetCompletionDate: o.targetCompletionDate,
    createdAt: o.createdAt,
    balanceDue: Math.max(0, (o.finalPrice || 0) - (o.advanceAmount || 0)),
    daysOverdue,
  };
}

async function buildCustomerStats(customerIds) {
  if (customerIds.length === 0) return { balanceMap: {}, salesMap: {}, pawnMap: {} };
  const [latestEntries, salesAgg, pawnAgg] = await Promise.all([
    CustomerLedger.aggregate(scopeAggregate([
      { $match: { customer: { $in: customerIds } } },
      { $sort: { transactionDate: -1 } },
      { $group: { _id: '$customer', balance: { $first: '$balanceAfter' }, lastTransaction: { $first: '$transactionDate' } } },
    ])),
    Sale.aggregate(scopeAggregate([
      { $match: { isDeleted: false, customer: { $in: customerIds } } },
      { $group: { _id: '$customer', totalSpent: { $sum: '$totalAmount' }, purchaseCount: { $sum: 1 }, outstandingBalance: { $sum: '$balance' }, lastPurchaseDate: { $max: '$saleDate' } } },
    ])),
    PawnLoan.aggregate(scopeAggregate([
      { $match: { isDeleted: false, customerId: { $in: customerIds }, status: { $in: PAWN_ACTIVE_STATUSES } } },
      { $group: { _id: '$customerId', activePawnLoans: { $sum: 1 } } },
    ])),
  ]);
  const balanceMap = {};
  latestEntries.forEach((e) => { balanceMap[e._id.toString()] = { balance: e.balance, lastTransaction: e.lastTransaction }; });
  const salesMap = {};
  salesAgg.forEach((e) => { salesMap[e._id.toString()] = e; });
  const pawnMap = {};
  pawnAgg.forEach((e) => { pawnMap[e._id.toString()] = { activePawnLoans: e.activePawnLoans }; });
  return { balanceMap, salesMap, pawnMap };
}

function applyCustomerStats(customer, { balanceMap, salesMap, pawnMap }) {
  const s = salesMap[customer._id.toString()] || {};
  const p = pawnMap[customer._id.toString()] || {};
  return {
    ...customer,
    balance: balanceMap[customer._id.toString()]?.balance || 0,
    lastTransaction: balanceMap[customer._id.toString()]?.lastTransaction || null,
    totalSpent: s.totalSpent || 0,
    purchaseCount: s.purchaseCount || 0,
    outstandingBalance: s.outstandingBalance || 0,
    lastPurchaseDate: s.lastPurchaseDate || null,
    activePawnLoans: p.activePawnLoans || 0,
  };
}

exports.getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive, owing, sort: sortField, order } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { customerCode: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (owing === 'true') {
      const owingAgg = await Sale.aggregate(scopeAggregate([
        { $match: { isDeleted: false, balance: { $gt: 0 } } },
        { $group: { _id: '$customer' } },
      ]));
      const owingIds = owingAgg.map((e) => e._id).filter(Boolean);
      query._id = { $in: owingIds };
    }
    const direction = order === 'asc' ? 1 : -1;

    if (COMPUTED_SORT_FIELDS.includes(sortField)) {
      const allCustomers = await Customer.find(query).sort({ createdAt: -1 }).lean();
      const maps = await buildCustomerStats(allCustomers.map((c) => c._id));
      let rows = allCustomers.map((c) => applyCustomerStats(c, maps));
      rows.sort((a, b) => {
        const av = a[sortField];
        const bv = b[sortField];
        const aNull = av == null || av === '';
        const bNull = bv == null || bv === '';
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * direction;
      });
      const skip = (Number(page) - 1) * Number(limit);
      return paginatedResponse(res, rows.slice(skip, skip + Number(limit)), rows.length, Number(page), Number(limit));
    }

    const sortObj = STORED_SORT_FIELDS.includes(sortField) ? { [sortField]: direction } : { createdAt: -1 };
    const skip = (Number(page) - 1) * Number(limit);
    const [customers, total] = await Promise.all([
      Customer.find(query).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Customer.countDocuments({ ...query, isDeleted: false }),
    ]);
    const maps = await buildCustomerStats(customers.map((c) => c._id));
    return paginatedResponse(res, customers.map((c) => applyCustomerStats(c, maps)), total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }
    const ledgerSummary = await CustomerLedger.aggregate(scopeAggregate([
      { $match: { customer: customer._id } },
      { $sort: { transactionDate: -1 } },
      { $group: { _id: null, totalBalance: { $first: '$balanceAfter' }, lastTransaction: { $first: '$transactionDate' }, totalCredit: { $sum: { $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', 0] } }, totalPayment: { $sum: { $cond: [{ $eq: ['$transactionType', 'payment'] }, '$amount', 0] } } } },
    ]));
    const [salesAgg, recentSales, pawnLoans, customOrders] = await Promise.all([
      Sale.aggregate(scopeAggregate([
        { $match: { isDeleted: false, customer: customer._id } },
        { $group: { _id: null, totalSpent: { $sum: '$totalAmount' }, purchaseCount: { $sum: 1 }, outstandingBalance: { $sum: '$balance' }, lastPurchaseDate: { $max: '$saleDate' } } },
      ])),
      Sale.find({ customer: customer._id })
        .populate('items.item', 'SKU itemName category metalType purity netMetalWeight')
        .sort({ saleDate: -1 })
        .limit(50)
        .lean(),
      PawnLoan.find({
        $or: [
          { customerId: customer._id },
          ...(customer.phone ? [{ 'customer.phone': customer.phone }] : []),
        ],
      }).sort({ startDate: -1 }).lean(),
      CustomOrder.find({
        $or: [
          { customerId: customer._id },
          ...(customer.phone ? [{ 'customer.phone': customer.phone }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);
    const summary = salesAgg[0] || { totalSpent: 0, purchaseCount: 0, outstandingBalance: 0, lastPurchaseDate: null };
    const purchases = recentSales.flatMap((s) => (s.items || []).map((si) => ({
      saleId: s._id,
      saleNumber: s.saleNumber,
      saleDate: s.saleDate,
      SKU: si.item?.SKU || '-',
      itemName: si.item?.itemName || '-',
      category: si.item?.category || '-',
      metalType: si.item?.metalType || '-',
      purity: si.item?.purity || 0,
      quantity: si.quantity,
      weight: si.weight,
      price: si.price,
    })));
    return successResponse(res, {
      customer,
      ledgerSummary: ledgerSummary[0] || { totalBalance: 0, lastTransaction: null, totalCredit: 0, totalPayment: 0 },
      summary,
      pawnLoans: pawnLoans.map(enrichPawnLoan),
      purchases,
      customOrders: customOrders.map(enrichCustomOrder),
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, address, email, citizenshipNumber } = req.body;
    if (!name || !phone) {
      return errorResponse(res, 'Name and phone are required', 400);
    }
    const existing = await Customer.findOne({ phone });
    if (existing) {
      return errorResponse(res, 'Customer with this phone already exists', 400);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create customer', 400);
    const customerCode = await getNextCustomerCode(req.tenantId);
    const customer = await Customer.create({ customerCode, name, phone, address, email, citizenshipNumber, tenantId: req.tenantId });
    await ActivityLog.create({
      action: 'create',
      module: 'customer',
      description: `Customer ${name} (${customerCode}) created`,
      performedBy: req.user._id,
      referenceId: customer._id,
      referenceModel: 'Customer',
    });
    return successResponse(res, customer, 'Customer created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { name, phone, address, email, citizenshipNumber, isActive } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }
    if (name) customer.name = name;
    if (phone) {
      const dup = await Customer.findOne({ phone, _id: { $ne: req.params.id } });
      if (dup) return errorResponse(res, 'Customer with this phone already exists', 400);
      customer.phone = phone;
    }
    if (address !== undefined) customer.address = address;
    if (email !== undefined) customer.email = email;
    if (citizenshipNumber !== undefined) customer.citizenshipNumber = citizenshipNumber;
    if (isActive !== undefined) customer.isActive = isActive;
    await customer.save();
    await ActivityLog.create({
      action: 'update',
      module: 'customer',
      description: `Customer ${customer.name} updated`,
      performedBy: req.user._id,
      referenceId: customer._id,
      referenceModel: 'Customer',
    });
    return successResponse(res, customer, 'Customer updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }
    await customer.softDelete();
    await ActivityLog.create({
      action: 'delete',
      module: 'customer',
      description: `Customer ${customer.name} deleted`,
      performedBy: req.user._id,
      referenceId: customer._id,
      referenceModel: 'Customer',
    });
    return successResponse(res, null, 'Customer deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getCustomerLedger = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { customer: req.params.id };
    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      CustomerLedger.find(query).sort({ transactionDate: -1 }).skip(skip).limit(Number(limit)),
      CustomerLedger.countDocuments(query),
    ]);
    return paginatedResponse(res, entries, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.addLedgerEntry = async (req, res) => {
  try {
    const { transactionType, amount, note, reference } = req.body;
    if (!transactionType || !amount || amount <= 0) {
      return errorResponse(res, 'Transaction type and positive amount are required', 400);
    }
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }
    const lastEntry = await CustomerLedger.findOne({ customer: customer._id }).sort({ transactionDate: -1 });
    const prevBalance = lastEntry ? lastEntry.balanceAfter : 0;
    const balanceAfter = transactionType === 'credit' ? prevBalance + amount : prevBalance - amount;
    if (balanceAfter < 0) {
      return errorResponse(res, 'Insufficient balance for this payment', 400);
    }
    const entry = await CustomerLedger.create({
      customer: customer._id,
      transactionType,
      reference: reference || '',
      referenceModel: 'Manual',
      amount,
      balanceAfter,
      note: note || '',
      transactionDate: new Date(),
    });
    await ActivityLog.create({
      action: 'addLedgerEntry',
      module: 'customer',
      description: `${transactionType} of ${amount} added to ${customer.name} ledger`,
      performedBy: req.user._id,
      referenceId: entry._id,
      referenceModel: 'CustomerLedger',
    });
    return successResponse(res, entry, 'Ledger entry added successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getCustomerReport = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }
    const ledgerEntries = await CustomerLedger.find({ customer: customer._id }).sort({ transactionDate: -1 });
    const summary = await CustomerLedger.aggregate(scopeAggregate([
      { $match: { customer: customer._id } },
      { $group: { _id: null, totalCredit: { $sum: { $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', 0] } }, totalPayment: { $sum: { $cond: [{ $eq: ['$transactionType', 'payment'] }, '$amount', 0] } }, transactionCount: { $sum: 1 } } },
    ]));
    return successResponse(res, {
      customer,
      summary: summary[0] || { totalCredit: 0, totalPayment: 0, transactionCount: 0 },
      recentTransactions: ledgerEntries.slice(0, 20),
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
