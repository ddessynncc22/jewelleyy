const PawnLoan = require('../models/PawnLoan');
const ActivityLog = require('../models/ActivityLog');
const Counter = require('../models/Counter');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { scopeAggregate } = require('../utils/tenant');
const { escapeRegex } = require('../utils/helpers');

exports.getPawnLoans = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }
    if (search) {
      const searchRegex = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [
        { loanNumber: searchRegex },
        { 'customer.name': searchRegex },
        { 'customer.phone': searchRegex },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [loans, total] = await Promise.all([
      PawnLoan.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('customerId', 'name phone'),
      PawnLoan.countDocuments({ ...query, isDeleted: false }),
    ]);
    return paginatedResponse(res, loans, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getPawnLoan = async (req, res) => {
  try {
    const loan = await PawnLoan.findById(req.params.id).populate('customerId', 'name phone address');
    if (!loan) {
      return errorResponse(res, 'Pawn loan not found', 404);
    }
    return successResponse(res, loan);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createPawnLoan = async (req, res) => {
  try {
    const { loanAmount, interestRate, dueDate } = req.body;
    let { customer, itemDetails } = req.body;
    if (!customer || !itemDetails) {
      const { customerName, phone, itemDescription, weight, karat } = req.body;
      if (customerName && phone && itemDescription && weight && (karat || req.body.karat) && loanAmount && interestRate) {
        customer = { name: customerName, phone, address: req.body.address || '', citizenshipNumber: req.body.citizenshipNumber || '' };
        itemDetails = { description: itemDescription, weight: Number(weight), purity: Number(req.body.purity) || 0, karat: Number(req.body.karat) };
      } else {
        return errorResponse(res, 'Customer name/phone, item details (description, weight, karat), loan amount, and interest rate are required', 400);
      }
    } else {
      if (!customer.name || !customer.phone || !itemDetails.description || !itemDetails.weight || !itemDetails.karat || !loanAmount || !interestRate) {
        return errorResponse(res, 'Customer name/phone, item details (description, weight, karat), loan amount, and interest rate are required', 400);
      }
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create pawn loan', 400);
    const counter = await Counter.findOneAndUpdate(
      { _id: `pawn_loan_${req.tenantId}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const loanNumber = `PLN-${String(counter.seq).padStart(5, '0')}`;
    let collateralPhotos = [];
    if (req.files && req.files.length > 0) {
      collateralPhotos = req.files.map((f) => `${req.uploadBaseUrl}/${f.filename}`);
    }
    const startDate = req.body.startDate || new Date();
    const amount = Number(loanAmount);
    const loan = await PawnLoan.create({
      tenantId: req.tenantId,
      loanNumber,
      customerId: req.body.customerId || null,
      customer: { name: customer.name, phone: customer.phone, address: customer.address || '', citizenshipNumber: customer.citizenshipNumber || '' },
      collateralPhotos,
      itemDetails: { description: itemDetails.description, weight: Number(itemDetails.weight), purity: Number(itemDetails.purity) || 0, karat: Number(itemDetails.karat) },
      tranches: [{ amount, dateTaken: startDate, status: 'active' }],
      loanAmount: amount,
      interestRate: Number(interestRate),
      dueDate: dueDate || null,
      startDate,
      totalPaid: 0,
      balance: amount,
    });
    await ActivityLog.create({
      action: 'create',
      module: 'pawn',
      description: `Pawn loan ${loanNumber} created for ${customer.name}`,
      performedBy: req.user._id,
      referenceId: loan._id,
      referenceModel: 'PawnLoan',
    });
    return successResponse(res, loan, 'Pawn loan created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updatePawnLoan = async (req, res) => {
  try {
    const loan = await PawnLoan.findById(req.params.id);
    if (!loan) {
      return errorResponse(res, 'Pawn loan not found', 404);
    }
    const { customer, itemDetails } = req.body;
    if (req.body.customerId !== undefined) loan.customerId = req.body.customerId;
    if (customer) {
      if (customer.name) loan.customer.name = customer.name;
      if (customer.phone) loan.customer.phone = customer.phone;
      if (customer.address !== undefined) loan.customer.address = customer.address;
      if (customer.citizenshipNumber !== undefined) loan.customer.citizenshipNumber = customer.citizenshipNumber;
    } else {
      if (req.body.customerName) loan.customer.name = req.body.customerName;
      if (req.body.phone) loan.customer.phone = req.body.phone;
      if (req.body.address !== undefined) loan.customer.address = req.body.address;
      if (req.body.citizenshipNumber !== undefined) loan.customer.citizenshipNumber = req.body.citizenshipNumber;
    }
    if (itemDetails) {
      if (itemDetails.description) loan.itemDetails.description = itemDetails.description;
      if (itemDetails.weight) loan.itemDetails.weight = Number(itemDetails.weight);
      if (itemDetails.purity !== undefined) loan.itemDetails.purity = Number(itemDetails.purity);
      if (itemDetails.karat) loan.itemDetails.karat = Number(itemDetails.karat);
    } else {
      if (req.body.itemDescription) loan.itemDetails.description = req.body.itemDescription;
      if (req.body.weight) loan.itemDetails.weight = Number(req.body.weight);
      if (req.body.purity !== undefined) loan.itemDetails.purity = Number(req.body.purity);
      if (req.body.karat) loan.itemDetails.karat = Number(req.body.karat);
    }
    if (req.body.interestRate !== undefined) loan.interestRate = Number(req.body.interestRate);
    if (req.body.dueDate) loan.dueDate = req.body.dueDate;
    if (req.body.startDate) loan.startDate = req.body.startDate;
    if (req.body.keepPhotos) {
      try {
        const keepList = JSON.parse(req.body.keepPhotos);
        if (Array.isArray(keepList)) loan.collateralPhotos = keepList;
      } catch { /* ignore parse errors */ }
    }
    if (req.files && req.files.length > 0) {
      const newPhotos = req.files.map((f) => `${req.uploadBaseUrl}/${f.filename}`);
      loan.collateralPhotos = [...loan.collateralPhotos, ...newPhotos];
    }
    if (req.body.removePhotos) {
      const removeList = Array.isArray(req.body.removePhotos) ? req.body.removePhotos : [req.body.removePhotos];
      loan.collateralPhotos = loan.collateralPhotos.filter((p) => !removeList.includes(p));
    }
    await loan.save();
    await ActivityLog.create({
      action: 'update',
      module: 'pawn',
      description: `Pawn loan ${loan.loanNumber} updated`,
      performedBy: req.user._id,
      referenceId: loan._id,
      referenceModel: 'PawnLoan',
    });
    return successResponse(res, loan, 'Pawn loan updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deletePawnLoan = async (req, res) => {
  try {
    const loan = await PawnLoan.findById(req.params.id);
    if (!loan) {
      return errorResponse(res, 'Pawn loan not found', 404);
    }
    await loan.softDelete();
    await ActivityLog.create({
      action: 'delete',
      module: 'pawn',
      description: `Pawn loan ${loan.loanNumber} deleted`,
      performedBy: req.user._id,
      referenceId: loan._id,
      referenceModel: 'PawnLoan',
    });
    return successResponse(res, null, 'Pawn loan deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.makePayment = async (req, res) => {
  try {
    const { amount, note, type, paymentType, principalId } = req.body;
    if (!amount || amount <= 0) {
      return errorResponse(res, 'Valid payment amount is required', 400);
    }
    const loan = await PawnLoan.findById(req.params.id);
    if (!loan) {
      return errorResponse(res, 'Pawn loan not found', 404);
    }
    if (loan.status === 'Redeemed' || loan.status === 'Forfeited') {
      return errorResponse(res, 'Cannot make payment on a redeemed or forfeited loan', 400);
    }
    const hasTranches = (loan.tranches || []).length > 0;
    if (!hasTranches && loan.loanAmount > 0) {
      loan.tranches.push({ amount: loan.loanAmount, dateTaken: loan.startDate, status: 'active' });
    }
    const activeTranches = loan.tranches.filter((t) => t.status === 'active');
    if (activeTranches.length === 0) {
      return errorResponse(res, 'No active principal tranches on this loan', 400);
    }
    const pt = paymentType || (type === 'interest' ? 'interest' : 'principal');
    if (pt === 'principal' && amount > loan.balance) {
      return errorResponse(res, 'Payment amount exceeds outstanding balance', 400);
    }
    let targetPrincipalId = principalId || null;
    if (pt === 'principal' && !targetPrincipalId) {
      const fifoTranche = activeTranches.reduce((oldest, t) =>
        !oldest || t.dateTaken < oldest.dateTaken ? t : oldest
      , null);
      targetPrincipalId = fifoTranche._id;
    }
    if (pt === 'interest' && activeTranches.length > 0 && !targetPrincipalId) {
      const fifoTranche = activeTranches.reduce((oldest, t) =>
        !oldest || t.dateTaken < oldest.dateTaken ? t : oldest
      , null);
      targetPrincipalId = fifoTranche._id;
    }
    const paymentRecordType = pt === 'interest' ? 'interest' : (amount >= loan.balance ? 'full_redemption' : 'payment');
    const payment = {
      amount,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      type: paymentRecordType,
      paymentType: pt,
      principalId: targetPrincipalId,
      note: note || '',
    };
    loan.payments.push(payment);
    if (pt === 'principal') {
      let remaining = amount;
      const sortedTranches = [...loan.tranches]
        .filter((t) => t.status === 'active')
        .sort((a, b) => new Date(a.dateTaken) - new Date(b.dateTaken));
      for (const tranche of sortedTranches) {
        if (remaining <= 0) break;
        const paymentsForTranche = loan.payments
          .filter((p) => p.paymentType === 'principal' && p.principalId && p.principalId.toString() === tranche._id.toString());
        const paidSoFar = paymentsForTranche.reduce((s, p) => s + (p.amount || 0), 0);
        const trancheRemaining = (tranche.amount || 0) - paidSoFar;
        if (trancheRemaining <= 0) continue;
        const toApply = Math.min(remaining, trancheRemaining);
        remaining -= toApply;
        if (toApply >= trancheRemaining) {
          tranche.status = 'closed';
        }
      }
    }
    await loan.save();
    await ActivityLog.create({
      action: 'payment',
      module: 'pawn',
      description: `${pt} payment of ${amount} received on loan ${loan.loanNumber}`,
      performedBy: req.user._id,
      referenceId: loan._id,
      referenceModel: 'PawnLoan',
    });
    return successResponse(res, loan, 'Payment recorded successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.addPrincipalTranche = async (req, res) => {
  try {
    const { amount, dateTaken } = req.body;
    if (!amount || amount <= 0) {
      return errorResponse(res, 'Valid principal amount is required', 400);
    }
    const loan = await PawnLoan.findById(req.params.id);
    if (!loan) {
      return errorResponse(res, 'Pawn loan not found', 404);
    }
    if (loan.status === 'Redeemed' || loan.status === 'Forfeited') {
      return errorResponse(res, 'Cannot add principal to a redeemed or forfeited loan', 400);
    }
    const newTranche = {
      amount: Number(amount),
      dateTaken: dateTaken ? new Date(dateTaken) : new Date(),
      status: 'active',
    };
    loan.tranches.push(newTranche);
    await loan.save();
    await ActivityLog.create({
      action: 'add_principal',
      module: 'pawn',
      description: `Additional principal of ${amount} added to loan ${loan.loanNumber}`,
      performedBy: req.user._id,
      referenceId: loan._id,
      referenceModel: 'PawnLoan',
    });
    return successResponse(res, loan, 'Principal tranche added successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.renewLoan = async (req, res) => {
  try {
    const { additionalDays, extraInterest } = req.body;
    if (!additionalDays || additionalDays <= 0) {
      return errorResponse(res, 'Valid additional days is required', 400);
    }
    const loan = await PawnLoan.findById(req.params.id);
    if (!loan) {
      return errorResponse(res, 'Pawn loan not found', 404);
    }
    if (loan.status !== 'Active') {
      return errorResponse(res, 'Only active loans can be renewed', 400);
    }
    const interestAmount = extraInterest || (loan.balance * (loan.interestRate / 100) * (additionalDays / 365));
    if (interestAmount > 0) {
      const interestPayment = {
        amount: interestAmount,
        date: new Date(),
        type: 'payment',
        paymentType: 'interest',
        principalId: null,
        note: 'Interest added during renewal',
      };
      loan.payments.push(interestPayment);
    }
    const currentDue = loan.dueDate ? new Date(loan.dueDate) : new Date();
    currentDue.setDate(currentDue.getDate() + additionalDays);
    loan.dueDate = currentDue;
    loan.status = 'Renewed';
    loan.statusDate = new Date();
    await loan.save();
    await ActivityLog.create({
      action: 'renew',
      module: 'pawn',
      description: `Loan ${loan.loanNumber} renewed. New due: ${loan.dueDate.toISOString().split('T')[0]}`,
      performedBy: req.user._id,
      referenceId: loan._id,
      referenceModel: 'PawnLoan',
    });
    return successResponse(res, loan, 'Loan renewed successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.forfeitLoan = async (req, res) => {
  try {
    const loan = await PawnLoan.findById(req.params.id);
    if (!loan) {
      return errorResponse(res, 'Pawn loan not found', 404);
    }
    if (loan.status !== 'Active' && loan.status !== 'Renewed') {
      return errorResponse(res, 'Only active or renewed loans can be forfeited', 400);
    }
    loan.status = 'Forfeited';
    loan.statusDate = new Date();
    await loan.save();
    await ActivityLog.create({
      action: 'forfeit',
      module: 'pawn',
      description: `Loan ${loan.loanNumber} forfeited`,
      performedBy: req.user._id,
      referenceId: loan._id,
      referenceModel: 'PawnLoan',
    });
    return successResponse(res, loan, 'Loan forfeited successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.redeemLoan = async (req, res) => {
  try {
    const loan = await PawnLoan.findById(req.params.id);
    if (!loan) {
      return errorResponse(res, 'Pawn loan not found', 404);
    }
    if (loan.status !== 'Active' && loan.status !== 'Renewed') {
      return errorResponse(res, 'Only active or renewed loans can be redeemed', 400);
    }
    if (loan.balance > 0) {
      return errorResponse(res, 'All principal tranches must be fully paid before redemption. Balance: ' + loan.balance, 400);
    }
    const { discount } = req.body;
    if (discount && discount > 0) {
      loan.payments.push({
        amount: Number(discount),
        date: new Date(),
        type: 'discount',
        paymentType: 'principal',
        principalId: null,
        note: 'Redemption discount applied',
      });
    }
    loan.tranches.forEach((t) => { if (t.status === 'active') t.status = 'closed'; });
    loan.status = 'Redeemed';
    loan.statusDate = new Date();
    await loan.save();
    await ActivityLog.create({
      action: 'redeem',
      module: 'pawn',
      description: discount ? `Loan ${loan.loanNumber} redeemed with discount of ${discount}. Collateral returned.` : `Loan ${loan.loanNumber} redeemed. Collateral returned.`,
      performedBy: req.user._id,
      referenceId: loan._id,
      referenceModel: 'PawnLoan',
    });
    return successResponse(res, loan, 'Loan redeemed successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getPawnReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = { isDeleted: false };
    if (startDate || endDate) {
      matchStage.startDate = {};
      if (startDate) matchStage.startDate.$gte = new Date(startDate);
      if (endDate) matchStage.startDate.$lte = new Date(endDate);
    }
    const [statusSummary, totalStats, activeLoans] = await Promise.all([
      PawnLoan.aggregate(scopeAggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 }, totalLoanAmount: { $sum: '$loanAmount' }, totalPaid: { $sum: '$totalPaid' }, totalBalance: { $sum: '$balance' } } },
      ])),
      PawnLoan.aggregate(scopeAggregate([
        { $match: matchStage },
        { $group: { _id: null, totalLoans: { $sum: 1 }, totalLoanAmount: { $sum: '$loanAmount' }, totalPaid: { $sum: '$totalPaid' }, totalBalance: { $sum: '$balance' } } },
      ])),
      PawnLoan.find({ ...matchStage, status: { $in: ['Active', 'Renewed'] } }).select('loanNumber customer.name loanAmount balance dueDate').sort({ dueDate: 1 }),
    ]);
    return successResponse(res, {
      summary: totalStats[0] || { totalLoans: 0, totalLoanAmount: 0, totalPaid: 0, totalBalance: 0 },
      byStatus: statusSummary,
      activeLoans,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
