const Karigar = require('../models/Karigar');
const Item = require('../models/Item');
const LooseLot = require('../models/LooseLot');
const Rate = require('../models/Rate');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { generateSKU, generateBarcode } = require('../services/barcode');
const { toPerGramRate } = require('../utils/rates');

const METAL_KEYS = ['gold', 'silver', 'diamond', 'gemstone'];
const WASSTAGE_ALERT_PERCENT = 10;

const round = (n, d = 3) => Number(Number(n).toFixed(d));

// Live per-gram rate from the (global, un-tenant-scoped) Rate collection.
// Used only to value percentage-type making charges on loose lots.
async function getLiveRatePerGram(metalType) {
  const latest = await Rate.findOne({ metalType }).sort({ date: -1 });
  return latest ? toPerGramRate(latest) : 0;
}

// Total karigar labour due for a whole loose lot, derived from its making
// charge settings (per_piece/per_gram/percentage).
async function lotMakingChargeDue(lot) {
  const v = Number(lot.makingChargeValue) || 0;
  if (!v) return 0;
  if (lot.makingChargeType === 'per_gram') return round(v * (Number(lot.totalGrossWeight) || 0), 2);
  if (lot.makingChargeType === 'percentage') {
    const rate = Number(lot.ratePerGram) || (await getLiveRatePerGram(lot.metalType));
    const metalValue = (Number(lot.totalGrossWeight) || 0) * rate * ((Number(lot.purity) || 0) / 1000);
    return round((metalValue * v) / 100, 2);
  }
  return round(v * (Number(lot.totalPieces) || 0), 2);
}

// Cost-side wastage value for a karigar-assigned item: costWastagePercent of
// the gross weight, valued at the live per-gram rate adjusted for purity. The
// karigar is paid this gold value in addition to the cost making charge.
async function itemWastageValue(item) {
  const pct = Number(item.costWastagePercent) || 0;
  if (!pct) return 0;
  const weight = Number(item.grossWeight) || Number(item.netMetalWeight) || 0;
  if (!weight) return 0;
  const rate = await getLiveRatePerGram(item.metalType);
  if (!rate) return 0;
  const wastageWeight = Number((weight * pct) / 100).toFixed(4);
  return round(wastageWeight * rate * ((Number(item.purity) || 0) / 1000), 2);
}

// Shared cash/gold payment entry builder. Throws with a user-facing message.
function buildPaymentEntry(body) {
  const { amount, goldWeight, goldKarat, goldPurity, goldValue, note } = body;
  const paymentEntry = {
    date: body.date ? new Date(body.date) : Date.now(),
    type: goldWeight ? 'gold' : 'cash',
    note: note || '',
  };
  let paymentValue = 0;
  if (goldWeight) {
    const w = Number(goldWeight);
    if (!w || w <= 0) throw new Error('Gold weight must be greater than zero');
    paymentEntry.goldWeight = w;
    paymentEntry.goldKarat = Number(goldKarat || 24);
    paymentEntry.goldPurity = Number(goldPurity || 999);
    if (goldValue !== undefined && goldValue !== null && goldValue !== '') {
      paymentEntry.goldValue = Number(goldValue) || 0;
    } else {
      const ratePerGram = Number(body.ratePerGram);
      if (!ratePerGram || ratePerGram <= 0) {
        throw new Error('Either goldValue or ratePerGram is required for gold payment');
      }
      paymentEntry.goldValue = Number((w * (paymentEntry.goldKarat / 24) * ratePerGram).toFixed(2));
    }
    paymentValue = paymentEntry.goldValue;
  } else {
    const cash = Number(amount);
    if (!cash || cash <= 0) throw new Error('Cash payment amount must be greater than zero');
    paymentEntry.amount = Number(cash.toFixed(2));
    paymentValue = paymentEntry.amount;
  }
  if (paymentValue <= 0) throw new Error('Payment value must be greater than zero');
  return { paymentEntry, paymentValue };
}

// Push a payment onto a material/item/lot record and recompute received + status.
function applyPaymentTo(record, paymentEntry, due) {
  record.paymentHistory.push(paymentEntry);
  const totalReceived = record.paymentHistory.reduce((sum, p) => sum + (p.type === 'gold' ? p.goldValue : p.amount), 0);
  record.paymentReceived = Number(totalReceived.toFixed(2));
  if (due > 0 && record.paymentReceived >= due) {
    record.paymentStatus = 'paid';
  } else if (record.paymentReceived > 0) {
    record.paymentStatus = 'partial';
  } else {
    record.paymentStatus = 'pending';
  }
}

function computeBalances(karigar) {
  const outstandingByMetal = { gold: 0, silver: 0, diamond: 0, gemstone: 0 };
  let outstandingWeight = 0;
  let pendingPayment = 0;
  for (const m of karigar.materials || []) {
    const metal = METAL_KEYS.includes(m.metalType) ? m.metalType : 'gold';
    if (m.status !== 'Returned') {
      const w = Number(m.grossWeight) || 0;
      outstandingByMetal[metal] += w;
      outstandingWeight += w;
    }
    const due = Number(m.paymentDue) || Number(m.payment) || 0;
    pendingPayment += Math.max(0, due - (Number(m.paymentReceived) || 0));
  }
  return {
    outstandingWeight: round(outstandingWeight),
    outstandingByMetal,
    pendingPayment: round(pendingPayment, 2),
  };
}

exports.getKarigars = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query = {};
    if (status) query.isActive = status === 'active';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [karigars, total] = await Promise.all([
      Karigar.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Karigar.countDocuments({ ...query, isDeleted: false }),
    ]);
    const enriched = karigars.map((k) => ({ ...k.toObject(), ...computeBalances(k) }));
    return paginatedResponse(res, enriched, total, Number(page), Number(limit));
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getKarigarSummary = async (req, res) => {
  try {
    const karigars = await Karigar.find().sort({ name: 1 }).lean();
    const rows = karigars.map((k) => ({ ...k, ...computeBalances(k) }));
    const totals = {
      totalKarigars: rows.length,
      outstandingWeight: round(rows.reduce((s, r) => s + r.outstandingWeight, 0)),
      outstandingByMetal: METAL_KEYS.reduce((acc, m) => {
        acc[m] = round(rows.reduce((s, r) => s + (r.outstandingByMetal[m] || 0), 0));
        return acc;
      }, {}),
      pendingJobs: rows.reduce((s, r) => s + (r.pendingJobs || 0), 0),
      pendingPayment: round(rows.reduce((s, r) => s + r.pendingPayment, 0), 2),
    };
    return successResponse(res, { rows, totals });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getKarigar = async (req, res) => {
  try {
    const karigar = await Karigar.findById(req.params.id)
      .populate('materials.finishedItem', 'SKU itemName category metalType purity grossWeight sellingPrice sellingMakingCharge sellingWastagePercent');
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    return successResponse(res, { ...karigar.toObject(), ...computeBalances(karigar) });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createKarigar = async (req, res) => {
  try {
    const { name, phone, address, specialization, panNumber } = req.body;
    if (!name || !phone) {
      return errorResponse(res, 'Name and phone are required', 400);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create karigar', 400);
    const existing = await Karigar.findOne({ phone });
    if (existing) {
      return errorResponse(res, 'Karigar with this phone already exists', 400);
    }
    const karigar = await Karigar.create({ name, phone, address, specialization, panNumber, tenantId: req.tenantId });
    await ActivityLog.create({
      action: 'create',
      module: 'karigar',
      description: `Karigar ${name} created`,
      performedBy: req.user._id,
      referenceId: karigar._id,
      referenceModel: 'Karigar',
    });
    return successResponse(res, karigar, 'Karigar created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateKarigar = async (req, res) => {
  try {
    const { name, phone, address, specialization, panNumber, isActive } = req.body;
    const karigar = await Karigar.findById(req.params.id);
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    if (name) karigar.name = name;
    if (phone) {
      const dup = await Karigar.findOne({ phone, _id: { $ne: req.params.id } });
      if (dup) return errorResponse(res, 'Karigar with this phone already exists', 400);
      karigar.phone = phone;
    }
    if (address !== undefined) karigar.address = address;
    if (specialization !== undefined) karigar.specialization = specialization;
    if (panNumber !== undefined) karigar.panNumber = panNumber;
    if (isActive !== undefined) karigar.isActive = isActive;
    await karigar.save();
    await ActivityLog.create({
      action: 'update',
      module: 'karigar',
      description: `Karigar ${karigar.name} updated`,
      performedBy: req.user._id,
      referenceId: karigar._id,
      referenceModel: 'Karigar',
    });
    return successResponse(res, karigar, 'Karigar updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteKarigar = async (req, res) => {
  try {
    const karigar = await Karigar.findById(req.params.id);
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    await karigar.softDelete();
    await ActivityLog.create({
      action: 'delete',
      module: 'karigar',
      description: `Karigar ${karigar.name} deleted`,
      performedBy: req.user._id,
      referenceId: karigar._id,
      referenceModel: 'Karigar',
    });
    return successResponse(res, null, 'Karigar deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.issueMaterial = async (req, res) => {
  try {
    const { itemName, metalType, grossWeight, stoneWeight, purity, karat, labourCharge } = req.body;
    if (!itemName || grossWeight === undefined || grossWeight === null || grossWeight === '' || purity === undefined || purity === null || purity === '') {
      return errorResponse(res, 'Item name, gross weight, and purity are required', 400);
    }
    const metal = METAL_KEYS.includes(metalType) ? metalType : 'gold';
    const weightNum = Number(grossWeight);
    const purityNum = Number(purity);
    const stoneNum = Number(stoneWeight) || 0;
    const karatNum = Number(karat) || 0;
    const labourNum = Number(labourCharge) || 0;
    if (Number.isNaN(weightNum) || weightNum <= 0) {
      return errorResponse(res, 'Gross weight must be greater than zero', 400);
    }
    if (Number.isNaN(purityNum) || purityNum < 0 || purityNum > 1000) {
      return errorResponse(res, 'Purity must be between 0 and 1000 (e.g. 999, 916, 750)', 400);
    }
    if (stoneNum < 0) {
      return errorResponse(res, 'Stone weight cannot be negative', 400);
    }
    if (stoneNum > weightNum) {
      return errorResponse(res, 'Stone weight cannot exceed gross weight', 400);
    }
    if (karatNum < 0 || karatNum > 24) {
      return errorResponse(res, 'Karat must be between 0 and 24', 400);
    }
    if (labourNum < 0) {
      return errorResponse(res, 'Labour charge cannot be negative', 400);
    }
    const karigar = await Karigar.findById(req.params.id);
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    const issueDate = req.body.date ? new Date(req.body.date) : new Date();
    karigar.materials.push({
      date: Number.isNaN(issueDate.getTime()) ? new Date() : issueDate,
      itemName,
      metalType: metal,
      grossWeight: weightNum,
      stoneWeight: stoneNum,
      purity: purityNum,
      karat: karatNum,
      labourCharge: labourNum,
      wastage: 0,
      status: 'Issued',
    });
    karigar.pendingJobs += 1;
    karigar.totalIssued += weightNum;
    await karigar.save();
    await StockMovement.create({
      item: null,
      type: 'stockOut',
      category: 'With Karigar',
      quantity: 1,
      weight: weightNum,
      purity: purityNum,
      reference: `Karigar: ${karigar.name}`,
      notes: `Material issued to ${karigar.name}`,
      performedBy: req.user._id,
    });
    await ActivityLog.create({
      action: 'issueMaterial',
      module: 'karigar',
      description: `Material issued to ${karigar.name}: ${itemName}`,
      performedBy: req.user._id,
      referenceId: karigar._id,
      referenceModel: 'Karigar',
    });
    return successResponse(res, karigar, 'Material issued successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.receiveFinished = async (req, res) => {
  try {
    const { materialIndex, itemName, category, metalType, purity, karat, grossWeight, stoneWeight, netMetalWeight, designCode, costPrice, costMakingCharge, costWastagePercent, sellingPrice, sellingMakingCharge, sellingWastagePercent, description } = req.body;
    if (materialIndex === undefined || !itemName || !category || !metalType || !purity || !grossWeight) {
      return errorResponse(res, 'Material index, item name, category, metalType, purity, and grossWeight are required', 400);
    }
    const karigar = await Karigar.findById(req.params.id);
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    const material = karigar.materials[materialIndex];
    if (!material) {
      return errorResponse(res, 'Material record not found at given index', 404);
    }
    if (material.status === 'Returned') {
      return errorResponse(res, 'Material already returned', 400);
    }
    const receivedWeight = Number(grossWeight);
    const purityNum = Number(purity);
    const stoneNum = Number(stoneWeight) || 0;
    const karatNum = Number(karat) || 0;
    const netMetalNum = Number(netMetalWeight) || receivedWeight;
    if (Number.isNaN(receivedWeight) || receivedWeight <= 0) {
      return errorResponse(res, 'Received gross weight must be greater than zero', 400);
    }
    if (Number.isNaN(purityNum) || purityNum < 0 || purityNum > 1000) {
      return errorResponse(res, 'Purity must be between 0 and 1000 (e.g. 999, 916, 750)', 400);
    }
    if (stoneNum < 0 || stoneNum > receivedWeight) {
      return errorResponse(res, 'Stone weight cannot be negative or exceed gross weight', 400);
    }
    if (karatNum < 0 || karatNum > 24) {
      return errorResponse(res, 'Karat must be between 0 and 24', 400);
    }
    if (netMetalNum < 0 || netMetalNum > receivedWeight) {
      return errorResponse(res, 'Net metal weight cannot be negative or exceed gross weight', 400);
    }
    const issuedWeight = material.grossWeight;
    const wastage = Number((issuedWeight - receivedWeight).toFixed(3));
    if (wastage < 0) {
      return errorResponse(res, 'Received weight cannot exceed issued weight (wastage cannot be negative)', 400);
    }
    const wastagePercent = issuedWeight > 0 ? Number(((wastage / issuedWeight) * 100).toFixed(2)) : 0;
    const highWastage = wastagePercent > WASSTAGE_ALERT_PERCENT;
    if (!req.tenantId) return errorResponse(res, 'Tenant context required', 400);
    const SKU = generateSKU(category, metalType, purityNum);
    const barcode = generateBarcode();
    const finishedItem = await Item.create({
      tenantId: req.tenantId, SKU, barcode, category, metalType, purity: purityNum, karat: karatNum || Math.round((purityNum / 1000) * 24), itemName, grossWeight: receivedWeight, stoneWeight: stoneNum, netMetalWeight: netMetalNum, designCode: designCode || '', description: description || '', costPrice: Number(costPrice) || 0, costMakingCharge: Number(costMakingCharge) || 0, costWastagePercent: Number(costWastagePercent) || 0, sellingPrice: Number(sellingPrice) || 0, sellingMakingCharge: Number(sellingMakingCharge) || 0, sellingWastagePercent: Number(sellingWastagePercent) || 0, status: 'In Stock', images: [], karigarId: karigar._id,
    });
    material.status = 'Returned';
    material.wastage = wastage;
    material.finishedItem = finishedItem._id;
    material.returnedDate = Date.now();
    if (!material.paymentDue || material.paymentDue === 0) {
      const jartiAmount = Number(material.jartiAmount || 0);
      const makingCharge = Number(material.labourCharge || 0);
      material.paymentDue = Number((jartiAmount + makingCharge).toFixed(2));
      material.payment = material.paymentDue;
    }
    material.paymentStatus = material.paymentReceived >= material.paymentDue ? 'paid' : material.paymentReceived > 0 ? 'partial' : 'pending';
    karigar.pendingJobs = Math.max(0, karigar.pendingJobs - 1);
    karigar.totalReturned += receivedWeight;
    await karigar.save();
    await StockMovement.create({
      item: finishedItem._id,
      type: 'stockIn',
      category: 'Return from Karigar',
      quantity: 1,
      weight: receivedWeight,
      purity: purityNum,
      reference: `Karigar: ${karigar.name}`,
      notes: `Finished item received from ${karigar.name}. Wastage: ${wastage}g`,
      performedBy: req.user._id,
    });
    await ActivityLog.create({
      action: 'receiveFinished',
      module: 'karigar',
      description: `Finished item ${SKU} received from ${karigar.name}. Wastage: ${wastage}g`,
      performedBy: req.user._id,
      referenceId: karigar._id,
      referenceModel: 'Karigar',
    });
    return successResponse(res, { karigar, finishedItem, wastage, wastagePercent, highWastage }, 'Finished item received successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getKarigarReturn = async (req, res) => {
  try {
    const karigar = await Karigar.findById(req.params.id)
      .populate('materials.finishedItem', 'SKU itemName category metalType purity grossWeight sellingPrice sellingMakingCharge sellingWastagePercent netMetalWeight');
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    const material = karigar.materials[Number(req.params.materialIndex)];
    if (!material) {
      return errorResponse(res, 'Material record not found at given index', 404);
    }
    if (material.status !== 'Returned') {
      return errorResponse(res, 'Material has not been returned yet', 400);
    }
    const issuedWeight = Number(material.grossWeight) || 0;
    const receivedWeight = Number(material.finishedItem?.grossWeight) || issuedWeight - (Number(material.wastage) || 0);
    const wastagePercent = issuedWeight > 0 ? Number(((Number(material.wastage) / issuedWeight) * 100).toFixed(2)) : 0;
    return successResponse(res, {
      karigar: { _id: karigar._id, name: karigar.name, phone: karigar.phone, panNumber: karigar.panNumber, address: karigar.address },
      material: { ...material.toObject(), metalType: METAL_KEYS.includes(material.metalType) ? material.metalType : 'gold' },
      finishedItem: material.finishedItem || null,
      wastagePercent,
      receivedWeight,
      highWastage: wastagePercent > WASSTAGE_ALERT_PERCENT,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getPendingJobs = async (req, res) => {
  try {
    const karigars = await Karigar.find({ isActive: true, pendingJobs: { $gt: 0 } })
      .select('name phone specialization pendingJobs materials')
      .populate('materials.finishedItem', 'SKU itemName');
    const pendingJobs = karigars.map((k) => ({
      karigar: { _id: k._id, name: k.name, phone: k.phone, specialization: k.specialization },
      pendingCount: k.pendingJobs,
      materials: k.materials
        .map((m, index) => ({
          ...m.toObject(),
          _index: index,
          metalType: METAL_KEYS.includes(m.metalType) ? m.metalType : 'gold',
        }))
        .filter((m) => m.status !== 'Returned'),
    }));
    return successResponse(res, pendingJobs, 'Pending jobs retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateMaterialStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const materialIndex = Number(req.params.materialIndex);
    const validStatuses = ['Issued', 'In Progress', 'Completed', 'Returned'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }
    const karigar = await Karigar.findById(req.params.id);
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    const material = karigar.materials[materialIndex];
    if (!material) {
      return errorResponse(res, 'Material record not found at given index', 404);
    }
    const oldStatus = material.status;
    if (oldStatus === status) {
      return successResponse(res, karigar, 'Material status is already ' + status);
    }
    material.status = status;
    if (oldStatus !== 'Returned' && status === 'Returned') {
      karigar.pendingJobs = Math.max(0, karigar.pendingJobs - 1);
      material.returnedDate = Date.now();
    } else if (oldStatus === 'Returned' && status !== 'Returned') {
      karigar.pendingJobs += 1;
      material.returnedDate = null;
    }
    await karigar.save();
    await ActivityLog.create({
      action: 'updateMaterialStatus',
      module: 'karigar',
      description: `Material "${material.itemName}" for ${karigar.name} status changed from ${oldStatus} to ${status}`,
      performedBy: req.user._id,
      referenceId: karigar._id,
      referenceModel: 'Karigar',
    });
    return successResponse(res, karigar, 'Material status updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getKarigarReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const karigar = await Karigar.findById(req.params.id);
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    let materials = karigar.materials;
    const [items, lots] = await Promise.all([
      Item.find({ karigarId: karigar._id }).select('itemName SKU metalType purity grossWeight netMetalWeight costMakingCharge costWastagePercent paymentDue paymentReceived paymentStatus paymentHistory createdAt'),
      LooseLot.find({ karigarId: karigar._id }).select('itemName lotBarcode metalType purity totalGrossWeight totalPieces makingChargeType makingChargeValue ratePerGram paymentDue paymentReceived paymentStatus paymentHistory createdAt'),
    ]);
    let filteredItems = items;
    let filteredLots = lots;
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    let end = null;
    if (endDate) {
      end = new Date(`${endDate}T23:59:59.999`);
    }
    if (startDate || endDate) {
      materials = materials.filter((m) => {
        const d = new Date(m.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
      filteredItems = items.filter((i) => {
        const d = new Date(i.createdAt);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
      filteredLots = lots.filter((l) => {
        const d = new Date(l.createdAt);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }
    const materialsDue = materials.reduce((sum, m) => sum + (Number(m.paymentDue) || Number(m.payment) || 0), 0);
    const materialsReceived = materials.reduce((sum, m) => sum + (Number(m.paymentReceived) || 0), 0);
    const materialsLabour = materials.reduce((sum, m) => sum + (m.labourCharge || 0), 0);
    const itemsDue = filteredItems.reduce((sum, i) => sum + (Number(i.paymentDue) || 0), 0);
    const itemsReceived = filteredItems.reduce((sum, i) => sum + (Number(i.paymentReceived) || 0), 0);
    const itemsLabour = filteredItems.reduce((sum, i) => sum + (Number(i.costMakingCharge) || 0), 0);
    let lotsDue = 0;
    let lotsReceived = 0;
    let lotsLabour = 0;
    for (const l of filteredLots) {
      lotsDue += Number(l.paymentDue) || 0;
      lotsReceived += Number(l.paymentReceived) || 0;
      lotsLabour += Number(l.paymentDue) || (await lotMakingChargeDue(l));
    }
    const totalPayment = round(materialsDue + itemsDue + lotsDue, 2);
    const totalPayments = round(materialsReceived + itemsReceived + lotsReceived, 2);
    const pendingPayment = round(Math.max(0, totalPayment - totalPayments), 2);
    const totalLabour = round(materialsLabour + itemsLabour + lotsLabour, 2);
    const totalIssuedWeight = materials.reduce((sum, m) => sum + m.grossWeight, 0);
    const totalReturnedWeight = materials.filter((m) => m.status === 'Returned').reduce((sum, m) => sum + m.grossWeight, 0);
    const totalWastage = materials.filter((m) => m.status === 'Returned').reduce((sum, m) => sum + (m.wastage || 0), 0);
    const totalJarti = materials.reduce((sum, m) => sum + (m.jartiAmount || 0), 0);
    const issuedCount = materials.length;
    const returnedCount = materials.filter((m) => m.status === 'Returned').length;
    const pendingCount = materials.filter((m) => m.status !== 'Returned').length;
    const balances = computeBalances(karigar);
    const paymentEntries = [];
    const pushPayments = (list, source) => {
      (list || []).forEach((p) => {
        const d = new Date(p.date);
        if (start && d < start) return;
        if (end && d > end) return;
        paymentEntries.push({
          source,
          date: p.date,
          amount: p.amount || 0,
          type: p.type || 'cash',
          goldWeight: p.goldWeight || 0,
          goldKarat: p.goldKarat || 24,
          goldPurity: p.goldPurity || 999,
          goldValue: p.goldValue || 0,
          note: p.note || '',
        });
      });
    };
    materials.forEach((m) => pushPayments(m.paymentHistory, m.itemName));
    filteredItems.forEach((i) => pushPayments(i.paymentHistory, `${i.itemName} (${i.SKU})`));
    filteredLots.forEach((l) => pushPayments(l.paymentHistory, `${l.itemName} (${l.lotBarcode})`));
    paymentEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    const cashEntries = paymentEntries.filter((p) => p.type !== 'gold');
    const goldEntries = paymentEntries.filter((p) => p.type === 'gold');
    const paymentMethods = [
      { type: 'cash', label: 'Cash', count: cashEntries.length, total: round(cashEntries.reduce((s, p) => s + (p.amount || 0), 0), 2) },
      { type: 'gold', label: 'Gold', count: goldEntries.length, total: round(goldEntries.reduce((s, p) => s + (p.goldValue || 0), 0), 2), goldWeight: round(goldEntries.reduce((s, p) => s + (p.goldWeight || 0), 0), 3) },
    ].filter((m) => m.count > 0);
    return successResponse(res, {
      karigar: { _id: karigar._id, name: karigar.name, phone: karigar.phone, specialization: karigar.specialization },
      summary: { issuedCount, returnedCount, pendingCount, totalIssuedWeight, totalReturnedWeight, totalWastage, totalLabour, totalJarti, totalPayment, pendingPayment, totalPayments, wastagePercentage: totalIssuedWeight > 0 ? ((totalWastage / totalIssuedWeight) * 100).toFixed(2) : 0, outstandingWeight: balances.outstandingWeight, outstandingByMetal: balances.outstandingByMetal },
      paymentMethods,
      paymentTimeline: paymentEntries,
      materials,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.recordKarigarPayment = async (req, res) => {
  try {
    const { materialIndex, itemId, lotId } = req.body;
    if (materialIndex === undefined && !itemId && !lotId) {
      return errorResponse(res, 'Material index, item id, or lot id is required', 400);
    }
    const karigar = await Karigar.findById(req.params.id);
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }

    // Resolve the payment target: a material subdocument (issue->receive flow),
    // a tagged item, or a loose lot — both of the latter assigned via their
    // creation forms and tracked with their own payment fields.
    let target = null;
    if (itemId) {
      const item = await Item.findOne({ _id: itemId, karigarId: karigar._id });
      if (!item) {
        return errorResponse(res, 'Item not found or not assigned to this karigar', 404);
      }
      const due = Number(item.paymentDue) || (Number(item.costMakingCharge || 0) + (await itemWastageValue(item))) || 0;
      target = { kind: 'item', doc: item, label: item.itemName || item.SKU, due };
    } else if (lotId) {
      const lot = await LooseLot.findOne({ _id: lotId, karigarId: karigar._id });
      if (!lot) {
        return errorResponse(res, 'Loose lot not found or not assigned to this karigar', 404);
      }
      const due = Number(lot.paymentDue) || (await lotMakingChargeDue(lot));
      target = { kind: 'lot', doc: lot, label: lot.itemName || lot.lotBarcode, due };
    } else {
      const material = karigar.materials[Number(materialIndex)];
      if (!material) {
        return errorResponse(res, 'Material record not found at given index', 404);
      }
      target = {
        kind: 'material',
        doc: material,
        label: material.itemName,
        due: Number(material.paymentDue) || Number(material.payment) || 0,
      };
    }

    if (target.due <= 0) {
      const message =
        target.kind === 'material'
          ? 'No payment due for this material yet. Receive the finished item first.'
          : `No payment due for this ${target.kind} yet. Set a making charge and try again.`;
      return errorResponse(res, message, 400);
    }
    const alreadyReceived = Number(target.doc.paymentReceived) || 0;
    const remaining = Number(Math.max(0, target.due - alreadyReceived).toFixed(2));
    if (remaining <= 0) {
      return errorResponse(res, 'This record is already fully paid', 400);
    }

    let paymentEntry;
    let paymentValue;
    try {
      const built = buildPaymentEntry(req.body);
      paymentEntry = built.paymentEntry;
      paymentValue = built.paymentValue;
    } catch (e) {
      return errorResponse(res, e.message, 400);
    }
    if (paymentValue > remaining) {
      return errorResponse(res, `Payment exceeds pending balance. Remaining due: Rs. ${remaining.toFixed(2)}`, 400);
    }

    applyPaymentTo(target.doc, paymentEntry, target.due);
    if (target.kind === 'material') {
      await karigar.save();
    } else {
      await target.doc.save();
    }
    await ActivityLog.create({
      action: 'recordPayment',
      module: 'karigar',
      description: `Payment recorded for ${karigar.name} (${target.label}): ${paymentEntry.type === 'gold' ? `${paymentEntry.goldWeight}g gold (Rs. ${paymentEntry.goldValue})` : `Rs. ${paymentEntry.amount} cash`}${req.body.note ? ` - ${req.body.note}` : ''}`,
      performedBy: req.user._id,
      referenceId: karigar._id,
      referenceModel: 'Karigar',
    });
    return successResponse(res, { karigar, target: target.doc, paymentEntry }, 'Payment recorded successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getKarigarPaymentHistory = async (req, res) => {
  try {
    const karigar = await Karigar.findById(req.params.id).select('name materials');
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }

    const history = [];
    const pushEntries = (list, sourceType, sourceId, name) => {
      (list || []).forEach((p) => {
        history.push({
          sourceType,
          sourceId,
          materialName: name,
          date: p.date,
          amount: p.amount || 0,
          type: p.type || 'cash',
          goldWeight: p.goldWeight || 0,
          goldKarat: p.goldKarat || 24,
          goldPurity: p.goldPurity || 999,
          goldValue: p.goldValue || 0,
          note: p.note || '',
        });
      });
    };

    let totalDue = 0;
    let totalPaid = 0;
    karigar.materials.forEach((m, index) => {
      totalDue += Number(m.paymentDue) || Number(m.payment) || 0;
      totalPaid += Number(m.paymentReceived) || 0;
      pushEntries(m.paymentHistory, 'material', index, m.itemName);
    });

    const [items, lots] = await Promise.all([
      Item.find({ karigarId: karigar._id }).select('itemName SKU paymentDue paymentReceived paymentHistory'),
      LooseLot.find({ karigarId: karigar._id }).select('itemName lotBarcode paymentDue paymentReceived paymentHistory'),
    ]);
    items.forEach((i) => {
      totalDue += Number(i.paymentDue) || 0;
      totalPaid += Number(i.paymentReceived) || 0;
      pushEntries(i.paymentHistory, 'item', i._id, i.itemName || i.SKU);
    });
    lots.forEach((l) => {
      totalDue += Number(l.paymentDue) || 0;
      totalPaid += Number(l.paymentReceived) || 0;
      pushEntries(l.paymentHistory, 'lot', l._id, l.itemName || l.lotBarcode);
    });

    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    return successResponse(
      res,
      {
        history,
        summary: {
          totalDue: round(totalDue, 2),
          totalPaid: round(totalPaid, 2),
          pending: round(Math.max(0, totalDue - totalPaid), 2),
        },
      },
      'Payment history retrieved'
    );
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
