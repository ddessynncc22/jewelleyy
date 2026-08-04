const mongoose = require('mongoose');
const Item = require('../models/Item');
const StockMovement = require('../models/StockMovement');
const Rate = require('../models/Rate');
const PawnLoan = require('../models/PawnLoan');
const Karigar = require('../models/Karigar');
const CustomerLedger = require('../models/CustomerLedger');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Settings = require('../models/Settings');
const { successResponse, errorResponse } = require('../utils/response');
const { scopeAggregate } = require('../utils/tenant');
const { toPerGramRate } = require('../utils/rates');
const { escapeRegex } = require('../utils/helpers');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

exports.getCurrentStock = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const lowStockThreshold = settings?.lowStockThreshold || 5;
    const [latestGold, latestSilver, items] = await Promise.all([
      Rate.findOne({ metalType: 'gold' }).sort({ date: -1 }),
      Rate.findOne({ metalType: 'silver' }).sort({ date: -1 }),
      Item.find({ status: 'In Stock' }).lean(),
    ]);
    const goldRatePerGram = toPerGramRate(latestGold);
    const silverRatePerGram = toPerGramRate(latestSilver);
    const enriched = items.map((item) => {
      const rate = item.metalType === 'gold' ? goldRatePerGram : silverRatePerGram;
      const estimatedValue = (item.netMetalWeight || 0) * rate * ((item.purity || 0) / 1000);
      return {
        ...item,
        currentRate: rate,
        estimatedValue,
        isLowStock: (item.quantity ?? 0) <= lowStockThreshold,
        valuationIssue: !item.purity || !item.netMetalWeight,
      };
    });
    const totalValue = enriched.reduce((sum, item) => sum + item.estimatedValue, 0);
    const itemsWithShare = enriched.map((item) => ({
      ...item,
      valueShare: totalValue > 0 ? (item.estimatedValue / totalValue) * 100 : 0,
    }));
    const goldValue = itemsWithShare.filter((i) => i.metalType === 'gold').reduce((s, i) => s + i.estimatedValue, 0);
    const silverValue = itemsWithShare.filter((i) => i.metalType === 'silver').reduce((s, i) => s + i.estimatedValue, 0);
    const totalWeight = itemsWithShare.reduce((s, i) => s + (i.netMetalWeight || 0), 0);
    const zeroStockCount = itemsWithShare.filter((i) => (i.quantity ?? 0) === 0).length;
    return successResponse(res, {
      items: itemsWithShare,
      totalValue,
      goldValue,
      silverValue,
      totalWeight,
      totalItems: itemsWithShare.length,
      zeroStockCount,
      lowStockThreshold,
      goldRatePerGram,
      silverRatePerGram,
      rateInfo: {
        gold: { perGram: goldRatePerGram, sourceUnit: latestGold?.unit || null, date: latestGold?.date || null },
        silver: { perGram: silverRatePerGram, sourceUnit: latestSilver?.unit || null, date: latestSilver?.date || null },
      },
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getStockMovement = async (req, res) => {
  try {
    const { startDate, endDate, type, category } = req.query;
    const query = {};
    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.movementDate = {};
      if (startDate) query.movementDate.$gte = new Date(startDate);
      if (endDate) query.movementDate.$lte = new Date(endDate);
    }
    const movements = await StockMovement.find(query).populate('item', 'SKU itemName category metalType purity').populate('performedBy', 'name').sort({ movementDate: -1 });
    const summary = {
      totalStockIn: movements.filter((m) => m.type === 'stockIn').reduce((s, m) => s + m.weight, 0),
      totalStockOut: movements.filter((m) => m.type === 'stockOut').reduce((s, m) => s + m.weight, 0),
      totalMovements: movements.length,
    };
    return successResponse(res, { movements, summary });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getInventoryValuation = async (req, res) => {
  try {
    const latestGold = await Rate.findOne({ metalType: 'gold' }).sort({ date: -1 });
    const latestSilver = await Rate.findOne({ metalType: 'silver' }).sort({ date: -1 });
    const goldRatePerGram = toPerGramRate(latestGold);
    const silverRatePerGram = toPerGramRate(latestSilver);
    const goldItems = await Item.find({ metalType: 'gold', status: 'In Stock' }).lean();
    const silverItems = await Item.find({ metalType: 'silver', status: 'In Stock' }).lean();
    const goldValue = goldItems.reduce((sum, item) => sum + ((item.netMetalWeight || 0) * goldRatePerGram * ((item.purity || 0) / 1000)), 0);
    const silverValue = silverItems.reduce((sum, item) => sum + ((item.netMetalWeight || 0) * silverRatePerGram * ((item.purity || 0) / 1000)), 0);
    return successResponse(res, [
      { metal: 'Gold', count: goldItems.length, totalWeight: goldItems.reduce((s, i) => s + (i.grossWeight || 0), 0), rate: goldRatePerGram, estimatedValue: goldValue },
      { metal: 'Silver', count: silverItems.length, totalWeight: silverItems.reduce((s, i) => s + (i.grossWeight || 0), 0), rate: silverRatePerGram, estimatedValue: silverValue },
    ]);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

const DAY_MS = 86400000;
const PAWN_ACTIVE_STATUSES = ['Active', 'Renewed'];

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

function toLocalDayStart(str) {
  return str ? new Date(`${str}T00:00:00`) : null;
}

function toLocalDayEnd(str) {
  return str ? new Date(`${str}T23:59:59.999`) : null;
}

function pawnReportTotals(loans) {
  return loans.reduce(
    (acc, l) => {
      acc.totalLoans += 1;
      acc.totalLoanAmount += l.loanAmount || 0;
      acc.totalPaid += l.totalPaid || 0;
      acc.totalBalance += l.balance || 0;
      acc.totalInterestCollected += l.interestCollected || 0;
      acc.totalInterestToAcquire += l.interestToAcquire || 0;
      acc.totalInterestProjected += l.projectedInterest || 0;
      return acc;
    },
    { totalLoans: 0, totalLoanAmount: 0, totalPaid: 0, totalBalance: 0, totalInterestCollected: 0, totalInterestToAcquire: 0, totalInterestProjected: 0 },
  );
}

exports.getPawnReport = async (req, res) => {
  try {
    const { startDate, endDate, status, phone, karat, interestStatus } = req.query;
    const query = { isDeleted: false };
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = toLocalDayStart(startDate);
      if (endDate) query.startDate.$lte = toLocalDayEnd(endDate);
    }
    if (status) {
      const list = String(status).split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) query.status = { $in: list };
    }
    if (phone) {
      query['customer.phone'] = { $regex: escapeRegex(String(phone)), $options: 'i' };
    }
    if (karat) {
      query['itemDetails.karat'] = Number(karat);
    }
    if (interestStatus === 'paid') query.interestCollected = { $gt: 0 };
    if (interestStatus === 'unpaid') query.interestCollected = { $lte: 0 };

    const asOf = toLocalDayEnd(endDate) || new Date();
    const allLoans = await PawnLoan.find(query).lean();

    const enriched = allLoans.map((loan) => {
      const accruedInterest = loanInterestAccrued(loan, asOf);
      const projected = loanInterestAccrued(loan, loan.dueDate || asOf);
      const active = PAWN_ACTIVE_STATUSES.includes(loan.status);
      return {
        ...loan,
        accruedInterest: active ? accruedInterest : 0,
        interestToAcquire: active ? Math.max(0, accruedInterest - (loan.interestCollected || 0)) : 0,
        projectedInterest: active ? Math.max(0, projected - (loan.interestCollected || 0)) : 0,
        daysOverdue: loan.dueDate && loan.dueDate < asOf ? daysBetween(loan.dueDate, asOf) : 0,
        daysToDue: loan.dueDate && loan.dueDate >= asOf ? daysBetween(asOf, loan.dueDate) : null,
      };
    });

    const statusMap = {};
    enriched.forEach((loan) => {
      const st = loan.status || 'Unknown';
      const entry = statusMap[st] || (statusMap[st] = { status: st, count: 0, totalLoanAmount: 0, totalPaid: 0, totalBalance: 0, totalInterestCollected: 0, totalInterestToAcquire: 0, totalInterestProjected: 0 });
      entry.count += 1;
      entry.totalLoanAmount += loan.loanAmount || 0;
      entry.totalPaid += loan.totalPaid || 0;
      entry.totalBalance += loan.balance || 0;
      entry.totalInterestCollected += loan.interestCollected || 0;
      entry.totalInterestToAcquire += loan.interestToAcquire || 0;
      entry.totalInterestProjected += loan.projectedInterest || 0;
    });
    const summary = Object.values(statusMap).sort((a, b) => b.count - a.count);
    const totals = pawnReportTotals(enriched);

    const earning = enriched.filter((l) => PAWN_ACTIVE_STATUSES.includes(l.status));
    const overdue = earning.filter((l) => l.daysOverdue > 0);
    const dueSoon = earning.filter((l) => l.daysToDue != null && l.daysToDue <= 7);

    const agingBuckets = [
      { bucket: '0-30 days', min: 1, max: 30 },
      { bucket: '31-60 days', min: 31, max: 60 },
      { bucket: '61-90 days', min: 61, max: 90 },
      { bucket: '90+ days', min: 91, max: Infinity },
    ].map((b) => {
      const items = overdue.filter((l) => l.daysOverdue >= b.min && l.daysOverdue <= b.max);
      return {
        bucket: b.bucket,
        count: items.length,
        totalBalance: items.reduce((s, l) => s + l.balance, 0),
        totalInterestToAcquire: items.reduce((s, l) => s + l.interestToAcquire, 0),
      };
    });

    const valued = earning.filter((l) => (l.valuation && l.valuation.marketValue) > 0);
    const ltvLoans = valued.map((l) => ({
      loanNumber: l.loanNumber,
      customerName: l.customer?.name,
      marketValue: l.valuation.marketValue,
      balance: l.balance,
      ltv: l.balance > 0 ? Number((l.balance / l.valuation.marketValue).toFixed(3)) : 0,
    }));
    const ltv = {
      loansWithValuation: valued.length,
      avgLtv: ltvLoans.length > 0 ? Number((ltvLoans.reduce((s, l) => s + l.ltv, 0) / ltvLoans.length).toFixed(3)) : 0,
      riskyCount: ltvLoans.filter((l) => l.ltv > 0.8).length,
      totalMarketValue: valued.reduce((s, l) => s + l.valuation.marketValue, 0),
      loans: ltvLoans,
    };

    const customerMap = {};
    earning.forEach((l) => {
      const name = l.customer?.name || 'Unknown';
      const entry = customerMap[name] || (customerMap[name] = { name, count: 0, totalLoanAmount: 0, totalBalance: 0 });
      entry.count += 1;
      entry.totalLoanAmount += l.loanAmount || 0;
      entry.totalBalance += l.balance || 0;
    });
    const topCustomers = Object.values(customerMap).sort((a, b) => b.totalBalance - a.totalBalance).slice(0, 10);

    const rateMap = {};
    earning.forEach((l) => {
      const rate = l.interestRate || 0;
      const entry = rateMap[rate] || (rateMap[rate] = { rate, count: 0, totalBalance: 0 });
      entry.count += 1;
      entry.totalBalance += l.balance || 0;
    });
    const rateDistribution = Object.values(rateMap).sort((a, b) => a.rate - b.rate);

    const interestWindow = { start: startDate ? toLocalDayStart(startDate) : null, end: endDate ? toLocalDayEnd(endDate) : null };
    let periodInterestCollected = 0;
    allLoans.forEach((loan) => {
      (loan.payments || []).forEach((p) => {
        if (p.paymentType !== 'interest' && p.type !== 'interest') return;
        const d = new Date(p.date);
        if (interestWindow.start && d < interestWindow.start) return;
        if (interestWindow.end && d > interestWindow.end) return;
        periodInterestCollected += p.amount || 0;
      });
    });

    const rangeQuery = { isDeleted: false };
    if (startDate || endDate) {
      rangeQuery.startDate = {};
      if (startDate) rangeQuery.startDate.$gte = toLocalDayStart(startDate);
      if (endDate) rangeQuery.startDate.$lte = toLocalDayEnd(endDate);
    }
    if (phone) rangeQuery['customer.phone'] = { $regex: escapeRegex(String(phone)), $options: 'i' };
    if (karat) rangeQuery['itemDetails.karat'] = Number(karat);
    const rangeLoans = await PawnLoan.find(rangeQuery).lean();

    const monthMap = {};
    rangeLoans.forEach((loan) => {
      const issued = new Date(loan.startDate || loan.createdAt);
      const mk = `${issued.getFullYear()}-${String(issued.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthMap[mk] || (monthMap[mk] = { month: mk, issued: 0, issuedAmount: 0, redeemed: 0, redeemedAmount: 0, forfeited: 0, forfeitedAmount: 0, renewed: 0 });
      bucket.issued += 1;
      bucket.issuedAmount += loan.loanAmount || 0;
      if (loan.status === 'Redeemed' && loan.statusDate) {
        const rm = `${new Date(loan.statusDate).getFullYear()}-${String(new Date(loan.statusDate).getMonth() + 1).padStart(2, '0')}`;
        const rb = monthMap[rm] || (monthMap[rm] = { month: rm, issued: 0, issuedAmount: 0, redeemed: 0, redeemedAmount: 0, forfeited: 0, forfeitedAmount: 0, renewed: 0 });
        rb.redeemed += 1;
        rb.redeemedAmount += loan.balance + (loan.totalPaid || 0);
      }
      if (loan.status === 'Forfeited' && loan.statusDate) {
        const fm = `${new Date(loan.statusDate).getFullYear()}-${String(new Date(loan.statusDate).getMonth() + 1).padStart(2, '0')}`;
        const fb = monthMap[fm] || (monthMap[fm] = { month: fm, issued: 0, issuedAmount: 0, redeemed: 0, redeemedAmount: 0, forfeited: 0, forfeitedAmount: 0, renewed: 0 });
        fb.forfeited += 1;
        fb.forfeitedAmount += loan.balance;
      }
      if (loan.status === 'Renewed' && loan.statusDate) {
        const rm2 = `${new Date(loan.statusDate).getFullYear()}-${String(new Date(loan.statusDate).getMonth() + 1).padStart(2, '0')}`;
        const rb2 = monthMap[rm2] || (monthMap[rm2] = { month: rm2, issued: 0, issuedAmount: 0, redeemed: 0, redeemedAmount: 0, forfeited: 0, forfeitedAmount: 0, renewed: 0 });
        rb2.renewed += 1;
      }
    });
    const monthlyActivity = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    const closedQuery = { isDeleted: false, status: { $in: ['Redeemed', 'Forfeited'] } };
    if (startDate || endDate) {
      closedQuery.statusDate = {};
      if (startDate) closedQuery.statusDate.$gte = toLocalDayStart(startDate);
      if (endDate) closedQuery.statusDate.$lte = toLocalDayEnd(endDate);
    }
    if (phone) closedQuery['customer.phone'] = { $regex: escapeRegex(String(phone)), $options: 'i' };
    const closedLoans = await PawnLoan.find(closedQuery).lean();
    const redemptionLog = closedLoans.map((l) => ({
      loanNumber: l.loanNumber,
      customerName: l.customer?.name,
      status: l.status,
      date: l.statusDate,
      loanAmount: l.loanAmount,
      interestCollected: l.interestCollected,
      discount: (l.payments || []).filter((p) => p.type === 'discount').reduce((s, p) => s + (p.amount || 0), 0),
      itemDescription: l.itemDetails?.description,
      itemWeight: l.itemDetails?.weight,
      marketValue: l.valuation?.marketValue,
    })).sort((a, b) => new Date(b.date) - new Date(a.date));

    const renewedQuery = { isDeleted: false, status: 'Renewed' };
    if (startDate || endDate) {
      renewedQuery.statusDate = {};
      if (startDate) renewedQuery.statusDate.$gte = toLocalDayStart(startDate);
      if (endDate) renewedQuery.statusDate.$lte = toLocalDayEnd(endDate);
    }
    const renewedLoans = await PawnLoan.find(renewedQuery).lean();
    const renewals = {
      count: renewedLoans.length,
      extraInterest: renewedLoans.reduce((s, l) => s + (l.payments || []).filter((p) => /renew/i.test(p.note || '')).reduce((s2, p) => s2 + (p.amount || 0), 0), 0),
    };

    const today = new Date();
    const curEnd = endDate ? toLocalDayEnd(endDate) : today;
    const curStart = startDate ? toLocalDayStart(startDate) : new Date(today.getTime() - 30 * DAY_MS);
    const windowLen = curEnd.getTime() - curStart.getTime();
    const prevEnd = new Date(curStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - windowLen);
    const compareQuery = (s, e) => ({ isDeleted: false, startDate: { $gte: s, $lte: e } });
    const currentLoans = await PawnLoan.find(compareQuery(curStart, curEnd)).lean();
    const previousLoans = await PawnLoan.find(compareQuery(prevStart, prevEnd)).lean();
    const enrichCompare = (loans) => loans.reduce((acc, l) => {
      acc.totalLoans += 1;
      acc.totalLoanAmount += l.loanAmount || 0;
      acc.totalPaid += l.totalPaid || 0;
      acc.totalBalance += l.balance || 0;
      acc.totalInterestCollected += l.interestCollected || 0;
      return acc;
    }, { totalLoans: 0, totalLoanAmount: 0, totalPaid: 0, totalBalance: 0, totalInterestCollected: 0 });
    const current = enrichCompare(currentLoans);
    const previous = enrichCompare(previousLoans);
    const pct = (c, p) => (p > 0 ? Number((((c - p) / p) * 100).toFixed(1)) : c > 0 ? 100 : 0);
    const previousPeriod = {
      current: { ...current, startDate: curStart, endDate: curEnd },
      previous: { ...previous, startDate: prevStart, endDate: prevEnd },
      change: {
        totalLoans: pct(current.totalLoans, previous.totalLoans),
        totalLoanAmount: pct(current.totalLoanAmount, previous.totalLoanAmount),
        totalPaid: pct(current.totalPaid, previous.totalPaid),
        totalBalance: pct(current.totalBalance, previous.totalBalance),
        totalInterestCollected: pct(current.totalInterestCollected, previous.totalInterestCollected),
      },
    };

    const loanRows = enriched.map((l) => ({
      _id: l._id,
      loanNumber: l.loanNumber,
      customerName: l.customer?.name,
      customerPhone: l.customer?.phone,
      itemDescription: l.itemDetails?.description,
      itemWeight: l.itemDetails?.weight,
      itemKarat: l.itemDetails?.karat,
      marketValue: l.valuation?.marketValue,
      loanAmount: l.loanAmount,
      totalPaid: l.totalPaid,
      balance: l.balance,
      interestRate: l.interestRate,
      interestCollected: l.interestCollected,
      accruedInterest: l.accruedInterest,
      interestToAcquire: l.interestToAcquire,
      projectedInterest: l.projectedInterest,
      startDate: l.startDate,
      dueDate: l.dueDate,
      status: l.status,
      statusDate: l.statusDate,
      daysOverdue: l.daysOverdue,
      daysToDue: l.daysToDue,
    })).sort((a, b) => (a.daysOverdue !== b.daysOverdue ? b.daysOverdue - a.daysOverdue : new Date(a.startDate) - new Date(b.startDate)));

    return successResponse(res, {
      summary,
      totals,
      periodInterestCollected,
      loans: loanRows,
      overdue: overdue.map((l) => loanRows.find((r) => r._id.toString() === l._id.toString())).filter(Boolean),
      dueSoon: dueSoon.map((l) => loanRows.find((r) => r._id.toString() === l._id.toString())).filter(Boolean),
      aging: agingBuckets,
      ltv,
      topCustomers,
      rateDistribution,
      monthlyActivity,
      redemptionLog,
      renewals,
      previousPeriod,
      projectedInterestTotal: totals.totalInterestProjected,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getKarigarReport = async (req, res) => {
  try {
    const karigars = await Karigar.find({ isDeleted: false }).lean();
    const items = karigars.map((k) => {
      const outstandingMaterials = (k.materials || []).filter((m) => m.status !== 'Returned');
      const totalIssued = k.totalIssued || 0;
      const totalReturned = k.totalReturned || 0;
      return {
        _id: k._id,
        name: k.name,
        phone: k.phone,
        address: k.address,
        specialization: k.specialization,
        isActive: k.isActive,
        pendingJobs: k.pendingJobs,
        totalIssued,
        totalReturned,
        materialsCount: (k.materials || []).length,
        outstandingCount: outstandingMaterials.length,
        outstandingWeight: outstandingMaterials.reduce((s, m) => s + (m.grossWeight || 0), 0),
        returnRate: totalIssued > 0 ? Number(((totalReturned / totalIssued) * 100).toFixed(1)) : 0,
      };
    });
    const summary = {
      totalKarigars: items.length,
      totalPendingJobs: items.reduce((s, k) => s + (k.pendingJobs || 0), 0),
      totalIssued: items.reduce((s, k) => s + k.totalIssued, 0),
      totalReturned: items.reduce((s, k) => s + k.totalReturned, 0),
      totalOutstanding: items.reduce((s, k) => s + k.outstandingCount, 0),
      totalOutstandingWeight: items.reduce((s, k) => s + k.outstandingWeight, 0),
    };
    return successResponse(res, { items, summary });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

async function buildCustomerLedgerReport(query = {}) {
  const { startDate, endDate, search, status, customerId } = query;
  const periodMatch = {};
  if (startDate || endDate) {
    periodMatch.transactionDate = {};
    if (startDate) periodMatch.transactionDate.$gte = new Date(`${startDate}T00:00:00`);
    if (endDate) periodMatch.transactionDate.$lte = new Date(`${endDate}T23:59:59.999`);
  }

  const customerMatch = {};
  if (customerId) {
    customerMatch['customerDoc._id'] = mongoose.Types.ObjectId.isValid(String(customerId)) ? new mongoose.Types.ObjectId(String(customerId)) : null;
  }
  if (search) {
    const rx = new RegExp(escapeRegex(String(search)), 'i');
    customerMatch.$or = [{ 'customerDoc.name': rx }, { 'customerDoc.phone': rx }];
  }

  const [{ period, allTime }] = await CustomerLedger.aggregate(scopeAggregate([
    { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customerDoc' } },
    { $unwind: { path: '$customerDoc', preserveNullAndEmptyArrays: true } },
    { $match: customerMatch },
    {
      $facet: {
        period: [
          { $match: periodMatch },
          {
            $group: {
              _id: '$customer',
              customerName: { $first: '$customerDoc.name' },
              customerPhone: { $first: '$customerDoc.phone' },
              credit: { $sum: { $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', 0] } },
              payment: { $sum: { $cond: [{ $eq: ['$transactionType', 'payment'] }, '$amount', 0] } },
              count: { $sum: 1 },
              last: { $max: '$transactionDate' },
              systemCount: { $sum: { $cond: [{ $ne: ['$referenceModel', ''] }, 1, 0] } },
              manualCount: { $sum: { $cond: [{ $eq: ['$referenceModel', ''] }, 1, 0] } },
            },
          },
        ],
        allTime: [
          {
            $group: {
              _id: '$customer',
              customerName: { $first: '$customerDoc.name' },
              customerPhone: { $first: '$customerDoc.phone' },
              credit: { $sum: { $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', 0] } },
              payment: { $sum: { $cond: [{ $eq: ['$transactionType', 'payment'] }, '$amount', 0] } },
              last: { $max: '$transactionDate' },
            },
          },
        ],
      },
    },
  ]));

  const periodMap = new Map(period.map((p) => [String(p._id), p]));
  const rows = [];
  for (const a of allTime) {
    const p = periodMap.get(String(a._id)) || { credit: 0, payment: 0, count: 0, last: null, systemCount: 0, manualCount: 0 };
    const opening = Math.round(((a.credit || 0) - (a.payment || 0) - (p.credit || 0) + (p.payment || 0)) * 100) / 100;
    const closing = Math.round(((a.credit || 0) - (a.payment || 0)) * 100) / 100;
    const last = p.last || a.last || null;
    rows.push({
      _id: a._id,
      customerName: a.customerName || 'Deleted Customer',
      customerPhone: a.customerPhone || '',
      opening,
      credit: Math.round((p.credit || 0) * 100) / 100,
      payment: Math.round((p.payment || 0) * 100) / 100,
      closing,
      transactionCount: p.count || 0,
      systemCount: p.systemCount || 0,
      manualCount: p.manualCount || 0,
      lastTransaction: last,
      daysSinceLast: last ? daysBetween(last, new Date()) : null,
      hasDues: closing > 0.005,
    });
  }

  let filtered = rows;
  if (status === 'dues') filtered = rows.filter((r) => r.hasDues);
  else if (status === 'cleared') filtered = rows.filter((r) => !r.hasDues);
  filtered.sort((x, y) => String(x.customerName).localeCompare(String(y.customerName)));

  const summary = {
    totalCustomers: filtered.length,
    totalTransactions: filtered.reduce((s, r) => s + (r.transactionCount || 0), 0),
    totalCredit: Math.round(filtered.reduce((s, r) => s + (r.credit || 0), 0) * 100) / 100,
    totalPayment: Math.round(filtered.reduce((s, r) => s + (r.payment || 0), 0) * 100) / 100,
    netOutstanding: Math.round(filtered.reduce((s, r) => s + (r.closing || 0), 0) * 100) / 100,
    customersWithDues: filtered.filter((r) => r.hasDues).length,
  };

  const debtors = filtered.filter((r) => r.hasDues).sort((x, y) => (y.closing || 0) - (x.closing || 0));

  const agingDef = [
    { bucket: '0-30 days', min: 0, max: 30 },
    { bucket: '31-60 days', min: 31, max: 60 },
    { bucket: '61-90 days', min: 61, max: 90 },
    { bucket: '90+ days', min: 91, max: Infinity },
  ];
  const aging = agingDef.map((b) => ({ bucket: b.bucket, count: 0, total: 0 }));
  const debtorIds = debtors.map((d) => d._id);
  if (debtorIds.length > 0) {
    const txns = await CustomerLedger.find({ customer: { $in: debtorIds } }).sort({ transactionDate: 1 }).lean();
    const byCustomer = {};
    txns.forEach((t) => {
      (byCustomer[String(t.customer)] = byCustomer[String(t.customer)] || []).push(t);
    });
    const asOf = new Date();
    Object.values(byCustomer).forEach((transactions) => {
      const lots = [];
      for (const t of transactions) {
        if (t.transactionType === 'credit') {
          lots.push({ amount: t.amount || 0, date: t.transactionDate });
        } else if (t.transactionType === 'payment') {
          let remaining = t.amount || 0;
          while (remaining > 0.0001 && lots.length > 0) {
            const lot = lots[0];
            const take = Math.min(lot.amount, remaining);
            lot.amount -= take;
            remaining -= take;
            if (lot.amount <= 0.0001) lots.shift();
          }
        }
      }
      const seen = new Set();
      for (const lot of lots) {
        const age = daysBetween(lot.date, asOf);
        const def = agingDef.find((b) => age >= b.min && age <= b.max) || agingDef[agingDef.length - 1];
        const idx = agingDef.indexOf(def);
        aging[idx].total = Math.round((aging[idx].total + lot.amount) * 100) / 100;
        if (!seen.has(idx)) {
          seen.add(idx);
          aging[idx].count += 1;
        }
      }
    });
  }

  const topCustomers = [...filtered]
    .sort((x, y) => (y.credit || 0) - (x.credit || 0))
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, customerName: r.customerName, credit: r.credit, count: r.transactionCount, closing: r.closing }));

  const sourceAgg = await CustomerLedger.aggregate(scopeAggregate([
    { $match: periodMatch },
    {
      $group: {
        _id: { $ifNull: ['$referenceModel', ''] },
        credit: { $sum: { $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', 0] } },
        payment: { $sum: { $cond: [{ $eq: ['$transactionType', 'payment'] }, '$amount', 0] } },
        count: { $sum: 1 },
      },
    },
  ]));
  const sourceBreakdown = sourceAgg
    .map((g) => ({ source: g._id || 'Manual', credit: g.credit || 0, payment: g.payment || 0, count: g.count || 0 }))
    .sort((x, y) => (y.credit || 0) - (x.credit || 0));

  const saleMatch = { isDeleted: false, paymentType: { $in: ['khaata', 'partial'] } };
  if (startDate || endDate) {
    saleMatch.saleDate = {};
    if (startDate) saleMatch.saleDate.$gte = new Date(`${startDate}T00:00:00`);
    if (endDate) saleMatch.saleDate.$lte = new Date(`${endDate}T23:59:59.999`);
  }
  const sales = await Sale.find(saleMatch).select('totalAmount paidAmount').lean();
  const expected = sales.reduce((s, x) => s + ((x.totalAmount || 0) - (x.paidAmount || 0)), 0);
  const saleSource = sourceBreakdown.find((s) => s.source === 'Sale');
  const actual = saleSource?.credit || 0;
  const difference = Number((expected - actual).toFixed(2));
  const reconciliation = {
    expected: Number(expected.toFixed(2)),
    actual: Number(actual.toFixed(2)),
    difference,
    matched: Math.abs(difference) < 0.01,
    saleCount: sales.length,
    entryCount: saleSource?.count || 0,
  };

  return {
    summary,
    rows: filtered,
    debtors,
    aging,
    topCustomers,
    sourceBreakdown,
    reconciliation,
    period: { startDate: startDate || null, endDate: endDate || null },
  };
}

exports.getCustomerLedgerReport = async (req, res) => {
  try {
    const report = await buildCustomerLedgerReport(req.query);
    return successResponse(res, report);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getCustomerLedgerStatement = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate, limit = 200 } = req.query;
    if (!mongoose.Types.ObjectId.isValid(String(customerId))) {
      return errorResponse(res, 'Invalid customer', 400);
    }
    const match = { customer: customerId };
    if (startDate || endDate) {
      match.transactionDate = {};
      if (startDate) match.transactionDate.$gte = new Date(`${startDate}T00:00:00`);
      if (endDate) match.transactionDate.$lte = new Date(`${endDate}T23:59:59.999`);
    }
    const [customer, entries] = await Promise.all([
      Customer.findById(customerId).select('name phone').lean(),
      CustomerLedger.find(match).sort({ transactionDate: 1 }).limit(Number(limit)).lean(),
    ]);
    if (!customer) return errorResponse(res, 'Customer not found', 404);
    let opening = 0;
    if (startDate) {
      const before = await CustomerLedger.aggregate(scopeAggregate([
        { $match: { customer: customerId, transactionDate: { $lt: new Date(`${startDate}T00:00:00`) } } },
        { $group: { _id: null, net: { $sum: { $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }] } } } },
      ]));
      opening = before[0]?.net || 0;
    }
    const entriesOut = entries.map((e) => ({
      date: e.transactionDate,
      type: e.transactionType,
      reference: e.reference,
      source: e.referenceModel || 'Manual',
      note: e.note,
      amount: e.amount,
      balance: e.balanceAfter,
    }));
    return successResponse(res, {
      customer: { _id: customer._id, name: customer.name, phone: customer.phone },
      opening,
      closing: entriesOut.length ? entriesOut[entriesOut.length - 1].balance : opening,
      entries: entriesOut,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

const lineCost = (si) => {
  const metalCost = (si.metalValue || 0) * (si.quantity || 1);
  if (metalCost > 0) return metalCost;
  return (si.item?.costPrice || 0) * (si.quantity || 1);
};
const lineRevenue = (si) => (si.price || 0) * (si.quantity || 1);

const summarizeSales = (list) => list.reduce((acc, sale) => {
  acc.totalSales += 1;
  acc.totalRevenue += sale.totalAmount || 0;
  const cost = sale.items.reduce((s, si) => s + lineCost(si), 0);
  acc.totalCost += cost;
  acc.totalProfit += (sale.totalAmount || 0) - cost;
  return acc;
}, { totalSales: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 });

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

exports.getProfitSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = { isDeleted: false };
    if (startDate || endDate) {
      matchStage.saleDate = {};
      if (startDate) matchStage.saleDate.$gte = new Date(startDate);
      if (endDate) matchStage.saleDate.$lte = new Date(endDate);
    }

    const sales = await Sale.find(matchStage)
      .populate('items.item', 'costPrice itemName SKU category')
      .populate('customer', 'name')
      .sort({ saleDate: -1 })
      .lean();

    const enriched = sales.map((sale) => {
      const revenue = sale.totalAmount || 0;
      const cost = sale.items.reduce((s, si) => s + lineCost(si), 0);
      const profit = revenue - cost;
      return {
        _id: sale._id,
        saleNumber: sale.saleNumber,
        saleDate: sale.saleDate,
        customerName: sale.customer?.name,
        paymentType: sale.paymentType,
        itemCount: sale.items.length,
        totalAmount: revenue,
        paidAmount: sale.paidAmount || 0,
        balance: sale.balance || 0,
        cashAmount: sale.cashAmount || 0,
        khaataAmount: sale.khaataAmount || 0,
        oldGoldAmount: sale.oldGoldDetails?.deductibleAmount || 0,
        cost,
        profit,
        margin: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
      };
    });

    const totals = enriched.reduce((acc, s) => {
      acc.totalSales += 1;
      acc.totalRevenue += s.totalAmount;
      acc.totalCost += s.cost;
      acc.totalProfit += s.profit;
      acc.totalPaid += s.paidAmount;
      acc.totalOutstanding += s.balance;
      acc.cashCollected += s.cashAmount;
      acc.khaata += s.khaataAmount;
      acc.oldGold += s.oldGoldAmount;
      return acc;
    }, { totalSales: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, totalPaid: 0, totalOutstanding: 0, cashCollected: 0, khaata: 0, oldGold: 0 });

    const monthMap = new Map();
    enriched.forEach((s) => {
      const d = new Date(s.saleDate);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      const m = monthMap.get(key) || { month: key, sortKey: d.getFullYear() * 12 + d.getMonth(), sales: 0, revenue: 0, cost: 0, profit: 0 };
      m.sales += 1;
      m.revenue += s.totalAmount;
      m.cost += s.cost;
      m.profit += s.profit;
      monthMap.set(key, m);
    });
    const monthly = [...monthMap.values()]
      .map(({ sortKey, ...m }) => m)
      .sort((a, b) => monthMap.get(a.month).sortKey - monthMap.get(b.month).sortKey);

    const catMap = new Map();
    sales.forEach((sale) => {
      sale.items.forEach((si) => {
        const category = si.item?.category || 'Uncategorized';
        const c = catMap.get(category) || { category, count: 0, revenue: 0, cost: 0, profit: 0 };
        c.count += si.quantity || 1;
        c.revenue += lineRevenue(si);
        c.cost += lineCost(si);
        catMap.set(category, c);
      });
    });
    const byCategory = [...catMap.values()]
      .map((c) => ({ ...c, profit: c.revenue - c.cost }))
      .sort((a, b) => b.profit - a.profit);

    const prodMap = new Map();
    sales.forEach((sale) => {
      sale.items.forEach((si) => {
        const id = si.item?._id ? si.item._id.toString() : 'unknown';
        const p = prodMap.get(id) || { _id: si.item?._id, SKU: si.item?.SKU || '-', itemName: si.item?.itemName || 'Unknown', quantity: 0, revenue: 0, cost: 0 };
        p.quantity += si.quantity || 1;
        p.revenue += lineRevenue(si);
        p.cost += lineCost(si);
        prodMap.set(id, p);
      });
    });
    const topProducts = [...prodMap.values()]
      .map((p) => ({ ...p, profit: p.revenue - p.cost }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    const today = new Date();
    const curEnd = endDate ? toLocalDayEnd(endDate) : today;
    const curStart = startDate ? toLocalDayStart(startDate) : new Date(today.getTime() - 30 * DAY_MS);
    const windowLen = curEnd.getTime() - curStart.getTime();
    const prevEnd = new Date(curStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - windowLen);
    const saleQuery = (s, e) => ({ isDeleted: false, saleDate: { $gte: s, $lte: e } });
    const currentSales = await Sale.find(saleQuery(curStart, curEnd)).populate('items.item', 'costPrice').lean();
    const previousSales = await Sale.find(saleQuery(prevStart, prevEnd)).populate('items.item', 'costPrice').lean();
    const current = summarizeSales(currentSales);
    const previous = summarizeSales(previousSales);
    const pct = (c, p) => (p > 0 ? Number((((c - p) / p) * 100).toFixed(1)) : c > 0 ? 100 : 0);
    const periodComparison = {
      current,
      previous,
      change: {
        totalSales: pct(current.totalSales, previous.totalSales),
        totalRevenue: pct(current.totalRevenue, previous.totalRevenue),
        totalCost: pct(current.totalCost, previous.totalCost),
        totalProfit: pct(current.totalProfit, previous.totalProfit),
      },
    };

    return successResponse(res, {
      summary: totals,
      profitMargin: totals.totalRevenue > 0 ? Number(((totals.totalProfit / totals.totalRevenue) * 100).toFixed(1)) : 0,
      monthly,
      byCategory,
      topProducts,
      sales: enriched,
      periodComparison,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

function extractSaleTax(sale) {
  const taxes = Array.isArray(sale.taxDetails?.taxes) ? sale.taxDetails.taxes : [];
  let serviceFee = 0;
  let diamondVat = 0;
  let serviceBase = 0;
  let vatBase = 0;
  taxes.forEach((t) => {
    const amt = Number(t.amount) || 0;
    const rate = Number(t.rate) || 0;
    const base = rate > 0 ? amt / (rate / 100) : 0;
    const name = String(t.name || '');
    if (/service|fee/i.test(name)) {
      serviceFee += amt;
      serviceBase += base;
    } else if (/vat|diamond/i.test(name)) {
      diamondVat += amt;
      vatBase += base;
    } else {
      serviceFee += amt;
      serviceBase += base;
    }
  });
  const totalTax =
    Number(sale.taxDetails?.totalTax) ||
    Number(Number(serviceFee + diamondVat).toFixed(2)) ||
    0;
  return {
    serviceFee: Number(serviceFee.toFixed(2)),
    diamondVat: Number(diamondVat.toFixed(2)),
    serviceBase: Number(serviceBase.toFixed(2)),
    vatBase: Number(vatBase.toFixed(2)),
    totalTax,
  };
}

exports.getTaxReport = async (req, res) => {
  try {
    const { startDate, endDate, paymentType } = req.query;
    const match = { isDeleted: false };
    if (startDate || endDate) {
      match.saleDate = {};
      if (startDate) match.saleDate.$gte = new Date(startDate);
      if (endDate) match.saleDate.$lte = new Date(endDate);
    }
    if (paymentType) match.paymentType = paymentType;

    const sales = await Sale.find(match)
      .populate('customer', 'name')
      .sort({ saleDate: -1 })
      .lean();

    const rows = sales.map((sale) => {
      const tax = extractSaleTax(sale);
      const revenue = Number(sale.totalAmount) || 0;
      const discount = Number(sale.discountAmount) || Number(sale.taxDetails?.discountAmount) || 0;
      return {
        _id: sale._id,
        saleNumber: sale.saleNumber,
        saleDate: sale.saleDate,
        customerName: sale.customer?.name || null,
        paymentType: sale.paymentType,
        itemCount: (sale.items || []).length,
        revenue,
        discount,
        taxableBase: Number((tax.serviceBase + tax.vatBase).toFixed(2)),
        serviceFeeBase: tax.serviceBase,
        vatBase: tax.vatBase,
        serviceFee: tax.serviceFee,
        diamondVat: tax.diamondVat,
        totalTax: tax.totalTax,
        grandTotal: Number((revenue + tax.totalTax - discount).toFixed(2)),
      };
    });

    const totals = rows.reduce(
      (acc, s) => {
        acc.totalSales += 1;
        acc.totalRevenue += s.revenue;
        acc.totalDiscount += s.discount;
        acc.totalTax += s.totalTax;
        acc.serviceFee += s.serviceFee;
        acc.diamondVat += s.diamondVat;
        acc.serviceFeeBase += s.serviceFeeBase;
        acc.vatBase += s.vatBase;
        return acc;
      },
      { totalSales: 0, totalRevenue: 0, totalDiscount: 0, totalTax: 0, serviceFee: 0, diamondVat: 0, serviceFeeBase: 0, vatBase: 0 }
    );

    const monthMap = new Map();
    rows.forEach((s) => {
      const d = new Date(s.saleDate);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      const m =
        monthMap.get(key) || { month: key, sortKey: d.getFullYear() * 12 + d.getMonth(), sales: 0, revenue: 0, serviceFee: 0, diamondVat: 0, totalTax: 0 };
      m.sales += 1;
      m.revenue += s.revenue;
      m.serviceFee += s.serviceFee;
      m.diamondVat += s.diamondVat;
      m.totalTax += s.totalTax;
      monthMap.set(key, m);
    });
    const monthly = [...monthMap.values()]
      .map(({ sortKey, ...m }) => m)
      .sort((a, b) => a.month.localeCompare(b.month));

    const payMap = new Map();
    rows.forEach((s) => {
      const key = s.paymentType || 'other';
      const p =
        payMap.get(key) || { paymentType: key, count: 0, revenue: 0, serviceFee: 0, diamondVat: 0, totalTax: 0 };
      p.count += 1;
      p.revenue += s.revenue;
      p.serviceFee += s.serviceFee;
      p.diamondVat += s.diamondVat;
      p.totalTax += s.totalTax;
      payMap.set(key, p);
    });
    const byPaymentType = [...payMap.values()];

    const taxTypeBreakdown = [
      {
        type: 'serviceFee',
        label: 'Service Fee',
        rate: '0.5%',
        count: rows.filter((r) => r.serviceFee > 0).length,
        taxableBase: totals.serviceFeeBase,
        amount: totals.serviceFee,
      },
      {
        type: 'diamondVat',
        label: 'VAT (Diamond)',
        rate: '13%',
        count: rows.filter((r) => r.diamondVat > 0).length,
        taxableBase: totals.vatBase,
        amount: totals.diamondVat,
      },
    ];

    return successResponse(res, {
      summary: {
        ...totals,
        avgTaxPerSale: totals.totalSales ? Number((totals.totalTax / totals.totalSales).toFixed(2)) : 0,
      },
      taxTypeBreakdown,
      monthly,
      byPaymentType,
      sales: rows,
      filters: { startDate: startDate || null, endDate: endDate || null, paymentType: paymentType || null },
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

function drawTableRows(doc, headers, keys, widths, rows) {
  const fmtCell = (v) => {
    if (v == null || v === '') return '-';
    if (v instanceof Date || (v && typeof v.toISOString === 'function')) return v.toISOString().split('T')[0];
    if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(v);
  };
  const drawRow = (cells, isHeader) => {
    const top = doc.y;
    const height = 16;
    let maxH = height;
    doc.fontSize(7);
    cells.forEach((cell, i) => {
      doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(String(cell), 30 + widths.slice(0, i).reduce((a, b) => a + b, 0) + 3, top + 3, { width: widths[i] - 6, height });
      maxH = Math.max(maxH, 18);
    });
    doc.rect(30, top, widths.reduce((a, b) => a + b, 0), maxH).stroke();
    if (isHeader) {
      doc.rect(30, top, widths.reduce((a, b) => a + b, 0), maxH).fill('#eee');
      doc.font('Helvetica-Bold');
      cells.forEach((cell, i) => {
        doc.text(String(cell), 30 + widths.slice(0, i).reduce((a, b) => a + b, 0) + 3, top + 3, { width: widths[i] - 6, height });
      });
    }
    doc.moveDown(1.2);
  };
  drawRow(headers, true);
  rows.slice(0, 300).forEach((row) => {
    drawRow(keys.map((k) => fmtCell(row[k])), false);
    if (doc.y > 750) {
      doc.addPage();
      drawRow(headers, true);
    }
  });
}

exports.exportReport = async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'excel', startDate, endDate, customerId } = req.query;
    let exportMeta = null;
    let data;
    switch (type) {
      case 'current-stock': {
        const settings = await Settings.getSettings();
        const lowStockThreshold = settings?.lowStockThreshold || 5;
        const latestGold = await Rate.findOne({ metalType: 'gold' }).sort({ date: -1 });
        const latestSilver = await Rate.findOne({ metalType: 'silver' }).sort({ date: -1 });
        const goldRatePerGram = toPerGramRate(latestGold);
        const silverRatePerGram = toPerGramRate(latestSilver);
        const items = await Item.find({ status: 'In Stock' }).lean();
        const rows = items.map((i) => {
          const rate = i.metalType === 'gold' ? goldRatePerGram : silverRatePerGram;
          const estimatedValue = (i.netMetalWeight || 0) * rate * ((i.purity || 0) / 1000);
          return {
            SKU: i.SKU,
            'Item Name': i.itemName,
            Category: i.category,
            'Metal Type': i.metalType,
            Purity: i.purity,
            Karat: i.karat,
            Qty: i.quantity,
            'Net Weight (g)': i.netMetalWeight,
            'Rate/g': rate,
            'Estimated Value': estimatedValue,
          };
        });
        const totalValue = rows.reduce((s, r) => s + r['Estimated Value'], 0);
        rows.forEach((r) => { r['Value %'] = totalValue > 0 ? Number(((r['Estimated Value'] / totalValue) * 100).toFixed(2)) : 0; });
        data = rows;
        break;
      }
      case 'stock-movement': {
        const query = {};
        if (startDate || endDate) {
          query.movementDate = {};
          if (startDate) query.movementDate.$gte = new Date(startDate);
          if (endDate) query.movementDate.$lte = new Date(endDate);
        }
        const movements = await StockMovement.find(query).populate('item', 'SKU itemName category metalType purity').populate('performedBy', 'name').lean();
        data = movements.map((m) => ({
          Date: m.movementDate ? new Date(m.movementDate).toISOString().split('T')[0] : '-',
          Type: m.type,
          Category: m.category,
          'Item SKU': m.item?.SKU || '-',
          'Item Name': m.item?.itemName || '-',
          'Metal Type': m.item?.metalType || '-',
          Qty: m.quantity,
          'Weight (g)': m.weight,
          Purity: m.purity,
          Reference: m.reference || '-',
          Notes: m.notes || '-',
          'Performed By': m.performedBy?.name || '-',
        }));
        break;
      }
      case 'inventory-valuation': {
        const latestGold = await Rate.findOne({ metalType: 'gold' }).sort({ date: -1 });
        const latestSilver = await Rate.findOne({ metalType: 'silver' }).sort({ date: -1 });
        const goldRatePerGram = toPerGramRate(latestGold);
        const silverRatePerGram = toPerGramRate(latestSilver);
        const goldItems = await Item.find({ metalType: 'gold', status: 'In Stock' }).lean();
        const silverItems = await Item.find({ metalType: 'silver', status: 'In Stock' }).lean();
        data = [{
          metal: 'Gold',
          count: goldItems.length,
          totalWeight: goldItems.reduce((s, i) => s + (i.grossWeight || 0), 0),
          rate: goldRatePerGram,
          estimatedValue: goldItems.reduce((s, i) => s + ((i.netMetalWeight || 0) * goldRatePerGram * ((i.purity || 0) / 1000)), 0),
        }, {
          metal: 'Silver',
          count: silverItems.length,
          totalWeight: silverItems.reduce((s, i) => s + (i.grossWeight || 0), 0),
          rate: silverRatePerGram,
          estimatedValue: silverItems.reduce((s, i) => s + ((i.netMetalWeight || 0) * silverRatePerGram * ((i.purity || 0) / 1000)), 0),
        }];
        break;
      }
      case 'pawn': {
        const pawnQuery = { isDeleted: false };
        if (startDate || endDate) {
          pawnQuery.startDate = {};
          if (startDate) pawnQuery.startDate.$gte = toLocalDayStart(startDate);
          if (endDate) pawnQuery.startDate.$lte = toLocalDayEnd(endDate);
        }
        const asOf = toLocalDayEnd(endDate) || new Date();
        const pawnLoans = await PawnLoan.find(pawnQuery).lean();
        data = pawnLoans.map((l) => {
          const accrued = PAWN_ACTIVE_STATUSES.includes(l.status) ? loanInterestAccrued(l, asOf) : 0;
          return {
            loanNumber: l.loanNumber,
            customerName: l.customer?.name,
            customerPhone: l.customer?.phone,
            itemDescription: l.itemDetails?.description,
            itemWeight: l.itemDetails?.weight,
            itemKarat: l.itemDetails?.karat,
            status: l.status,
            loanAmount: l.loanAmount,
            totalPaid: l.totalPaid,
            balance: l.balance,
            interestRate: l.interestRate,
            interestCollected: l.interestCollected,
            accruedInterest: Number(accrued.toFixed(2)),
            interestToAcquire: PAWN_ACTIVE_STATUSES.includes(l.status) ? Number(Math.max(0, accrued - (l.interestCollected || 0)).toFixed(2)) : 0,
            startDate: l.startDate,
            dueDate: l.dueDate,
            daysOverdue: l.dueDate && l.dueDate < asOf ? daysBetween(l.dueDate, asOf) : 0,
          };
        });
        break;
      }
      case 'karigar': {
        const karigars = await Karigar.find({ isDeleted: false }).lean();
        data = karigars.map((k) => {
          const outstandingMaterials = (k.materials || []).filter((m) => m.status !== 'Returned');
          const totalIssued = k.totalIssued || 0;
          const totalReturned = k.totalReturned || 0;
          return {
            Name: k.name,
            Phone: k.phone,
            Address: k.address,
            Specialization: k.specialization,
            Status: k.isActive ? 'Active' : 'Inactive',
            'Pending Jobs': k.pendingJobs || 0,
            'Materials Issued': totalIssued,
            'Materials Returned': totalReturned,
            'Materials Outstanding': outstandingMaterials.length,
            'Outstanding Weight (g)': outstandingMaterials.reduce((s, m) => s + (m.grossWeight || 0), 0),
            'Return Rate %': totalIssued > 0 ? Number(((totalReturned / totalIssued) * 100).toFixed(1)) : 0,
          };
        });
        break;
      }
      case 'customer-ledger': {
        if (customerId) {
          if (!mongoose.Types.ObjectId.isValid(String(customerId))) return errorResponse(res, 'Invalid customer', 400);
          const range = {};
          if (startDate || endDate) {
            range.transactionDate = {};
            if (startDate) range.transactionDate.$gte = new Date(`${startDate}T00:00:00`);
            if (endDate) range.transactionDate.$lte = new Date(`${endDate}T23:59:59.999`);
          }
          const [entries, customer] = await Promise.all([
            CustomerLedger.find({ customer: customerId, ...range }).sort({ transactionDate: 1 }).lean(),
            Customer.findById(customerId).select('name phone').lean(),
          ]);
          if (!customer) return errorResponse(res, 'Customer not found', 404);
          let opening = 0;
          if (startDate) {
            const before = await CustomerLedger.aggregate(scopeAggregate([
              { $match: { customer: customerId, transactionDate: { $lt: new Date(`${startDate}T00:00:00`) } } },
              { $group: { _id: null, net: { $sum: { $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }] } } } },
            ]));
            opening = before[0]?.net || 0;
          }
          data = entries.map((e) => ({
            Date: e.transactionDate,
            Type: e.transactionType === 'credit' ? 'Credit' : 'Payment',
            Reference: e.reference || '',
            Source: e.referenceModel || 'Manual',
            Note: e.note || '',
            Amount: e.amount,
            Balance: e.balanceAfter,
          }));
          const closing = data.length ? data[data.length - 1].Balance : opening;
          exportMeta = {
            title: `Customer Statement - ${customer.name}`,
            subtitle: `Opening ${opening.toLocaleString()} | Closing ${closing.toLocaleString()}`,
          };
        } else {
          const report = await buildCustomerLedgerReport({ startDate, endDate });
          data = report.rows.map((r) => ({
            Customer: r.customerName,
            Phone: r.customerPhone,
            Opening: r.opening,
            Credit: r.credit,
            Payment: r.payment,
            Closing: r.closing,
            Transactions: r.transactionCount,
            'Last Activity': r.lastTransaction,
          }));
          exportMeta = {
            title: 'Customer Ledger Report',
            subtitle: `Net Outstanding ${report.summary.netOutstanding.toLocaleString()}`,
          };
        }
        break;
      }
      case 'profit-summary': {
        const saleMatch = { isDeleted: false };
        if (startDate || endDate) {
          saleMatch.saleDate = {};
          if (startDate) saleMatch.saleDate.$gte = new Date(startDate);
          if (endDate) saleMatch.saleDate.$lte = new Date(endDate);
        }
        const psSales = await Sale.find(saleMatch)
          .populate('items.item', 'costPrice')
          .populate('customer', 'name')
          .lean();
        data = psSales.map((sale) => {
          const revenue = sale.totalAmount || 0;
          const cost = sale.items.reduce((s, si) => s + lineCost(si), 0);
          const profit = revenue - cost;
          return {
            'Sale Number': sale.saleNumber,
            Date: sale.saleDate ? new Date(sale.saleDate).toISOString().split('T')[0] : '-',
            Customer: sale.customer?.name || '-',
            'Payment Type': sale.paymentType,
            Items: sale.items.length,
            Revenue: revenue,
            Cost: cost,
            Profit: profit,
            'Margin %': revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
            Outstanding: sale.balance || 0,
          };
        });
        break;
      }
      case 'tax': {
        const taxMatch = { isDeleted: false };
        if (startDate || endDate) {
          taxMatch.saleDate = {};
          if (startDate) taxMatch.saleDate.$gte = new Date(startDate);
          if (endDate) taxMatch.saleDate.$lte = new Date(endDate);
        }
        const taxSales = await Sale.find(taxMatch).populate('customer', 'name').lean();
        data = taxSales.map((sale) => {
          const tax = extractSaleTax(sale);
          const revenue = Number(sale.totalAmount) || 0;
          const discount = Number(sale.discountAmount) || Number(sale.taxDetails?.discountAmount) || 0;
          return {
            'Sale Number': sale.saleNumber,
            Date: sale.saleDate ? new Date(sale.saleDate).toISOString().split('T')[0] : '-',
            Customer: sale.customer?.name || '-',
            'Payment Type': sale.paymentType,
            'Revenue (pre-tax)': revenue,
            Discount: discount,
            'Service Fee': tax.serviceFee,
            'VAT (Diamond)': tax.diamondVat,
            'Total Tax': tax.totalTax,
            'Grand Total': Number((revenue + tax.totalTax - discount).toFixed(2)),
          };
        });
        break;
      }
      default:
        return errorResponse(res, 'Invalid report type', 400);
    }
    if (!data) data = [];    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(type);
      if (data.length > 0) {
        const headers = Object.keys(data[0]).filter((k) => k !== '__v' && k !== 'isDeleted');
        sheet.addRow(headers);
        data.forEach((row) => {
          sheet.addRow(headers.map((h) => (row[h] && typeof row[h] === 'object' ? JSON.stringify(row[h]) : row[h])));
        });
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-report.pdf`);
      doc.pipe(res);
      doc.fontSize(18).text(exportMeta?.title || `${type.toUpperCase()} Report`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toISOString().split('T')[0]}`, { align: 'right' });
      if (exportMeta?.subtitle) {
        doc.moveDown(0.5);
        doc.fontSize(10).text(exportMeta.subtitle, { align: 'center' });
      }
      doc.moveDown();
      if (type === 'pawn') {
        const headers = ['Loan', 'Customer', 'Status', 'Amount', 'Balance', 'Int. Col.', 'Int. To Acquire', 'Due', 'Overdue'];
        const widths = [70, 90, 60, 55, 55, 55, 65, 50, 45];
        const fmt = (v) => (v == null || v === '' ? '-' : typeof v === 'number' ? v.toLocaleString() : String(v));
        const fmtDate = (d) => (d ? new Date(d).toISOString().split('T')[0] : '-');
        const drawRow = (cells, isHeader) => {
          const top = doc.y;
          const height = 16;
          let maxH = height;
          doc.fontSize(7);
          cells.forEach((cell, i) => {
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
            doc.text(String(cell), 30 + widths.slice(0, i).reduce((a, b) => a + b, 0) + 3, top + 3, { width: widths[i] - 6, height });
            maxH = Math.max(maxH, 18);
          });
          doc.rect(30, top, widths.reduce((a, b) => a + b, 0), maxH).stroke();
          if (isHeader) {
            doc.rect(30, top, widths.reduce((a, b) => a + b, 0), maxH).fill('#eee');
            doc.font('Helvetica-Bold');
            cells.forEach((cell, i) => {
              doc.text(String(cell), 30 + widths.slice(0, i).reduce((a, b) => a + b, 0) + 3, top + 3, { width: widths[i] - 6, height });
            });
          }
          doc.moveDown(1.2);
          return maxH;
        };
        drawRow(headers, true);
        const rows = data.slice(0, 300);
        for (const row of rows) {
          const h = drawRow([
            fmt(row.loanNumber),
            fmt(row.customerName),
            fmt(row.status),
            fmt(row.loanAmount),
            fmt(row.balance),
            fmt(row.interestCollected),
            fmt(row.interestToAcquire),
            fmtDate(row.dueDate),
            fmt(row.daysOverdue),
          ], false);
          if (doc.y > 750) {
            doc.addPage();
            drawRow(headers, true);
          }
        }
      } else if (type === 'customer-ledger') {
        if (customerId) {
          drawTableRows(doc, ['Date', 'Type', 'Reference', 'Source', 'Note', 'Amount', 'Balance'], ['Date', 'Type', 'Reference', 'Source', 'Note', 'Amount', 'Balance'], [55, 45, 65, 55, 100, 55, 55], data);
        } else {
          drawTableRows(doc, ['Customer', 'Phone', 'Opening', 'Credit', 'Payment', 'Closing', 'Txns'], ['Customer', 'Phone', 'Opening', 'Credit', 'Payment', 'Closing', 'Transactions'], [110, 70, 55, 55, 55, 55, 40], data);
        }
      } else if (type === 'tax') {
        drawTableRows(doc, ['Sale', 'Date', 'Customer', 'Payment', 'Revenue', 'Discount', 'Service Fee', 'VAT', 'Total Tax', 'Grand Total'], ['Sale Number', 'Date', 'Customer', 'Payment Type', 'Revenue (pre-tax)', 'Discount', 'Service Fee', 'VAT (Diamond)', 'Total Tax', 'Grand Total'], [55, 50, 80, 45, 45, 40, 40, 40, 40, 45], data);
      } else {
        data.slice(0, 100).forEach((item, i) => {
          const name = item.itemName || item.name || `Record ${i + 1}`;
          const sku = item.SKU || item.sku || '';
          const line = sku ? `${name} (${sku})` : name;
          doc.fontSize(9).text(`${i + 1}. ${line}`);
        });
      }
      doc.end();
      return;
    } else {
      return successResponse(res, data);
    }
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
