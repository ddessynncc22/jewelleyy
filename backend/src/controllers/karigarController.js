const Karigar = require('../models/Karigar');
const Item = require('../models/Item');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { generateSKU, generateBarcode } = require('../services/barcode');

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
    return paginatedResponse(res, karigars, total, Number(page), Number(limit));
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
    return successResponse(res, karigar);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createKarigar = async (req, res) => {
  try {
    const { name, phone, address, specialization } = req.body;
    if (!name || !phone) {
      return errorResponse(res, 'Name and phone are required', 400);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create karigar', 400);
    const existing = await Karigar.findOne({ phone });
    if (existing) {
      return errorResponse(res, 'Karigar with this phone already exists', 400);
    }
    const karigar = await Karigar.create({ name, phone, address, specialization, tenantId: req.tenantId });
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
    const { name, phone, address, specialization, isActive } = req.body;
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
    const { itemName, grossWeight, stoneWeight, purity, karat, labourCharge } = req.body;
    if (!itemName || !grossWeight || !purity) {
      return errorResponse(res, 'Item name, gross weight, and purity are required', 400);
    }
    const karigar = await Karigar.findById(req.params.id);
    if (!karigar) {
      return errorResponse(res, 'Karigar not found', 404);
    }
    karigar.materials.push({
      date: req.body.date ? new Date(req.body.date) : Date.now(),
      itemName,
      grossWeight,
      stoneWeight: stoneWeight || 0,
      purity,
      karat: karat || 0,
      labourCharge: labourCharge || 0,
      wastage: 0,
      status: 'Issued',
    });
    karigar.pendingJobs += 1;
    karigar.totalIssued += grossWeight;
    await karigar.save();
    await StockMovement.create({
      item: null,
      type: 'stockOut',
      category: 'With Karigar',
      quantity: 1,
      weight: grossWeight,
      purity,
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
    const issuedWeight = material.grossWeight;
    const wastage = issuedWeight - grossWeight;
    if (wastage < 0) {
      return errorResponse(res, 'Received weight cannot exceed issued weight', 400);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required', 400);
    const SKU = generateSKU(category, metalType, purity);
    const barcode = generateBarcode();
    const finishedItem = await Item.create({
      tenantId: req.tenantId, SKU, barcode, category, metalType, purity, karat: karat || Math.round((purity / 1000) * 24), itemName, grossWeight, stoneWeight: stoneWeight || 0, netMetalWeight: netMetalWeight || grossWeight, designCode: designCode || '', description: description || '', costPrice: costPrice || 0, costMakingCharge: costMakingCharge || 0, costWastagePercent: costWastagePercent || 0, sellingPrice: sellingPrice || 0, sellingMakingCharge: sellingMakingCharge || 0, sellingWastagePercent: sellingWastagePercent || 0, status: 'In Stock', images: [], karigarId: karigar._id,
    });
    material.status = 'Returned';
    material.wastage = wastage;
    material.finishedItem = finishedItem._id;
    material.returnedDate = Date.now();
    karigar.pendingJobs = Math.max(0, karigar.pendingJobs - 1);
    karigar.totalReturned += grossWeight;
    await karigar.save();
    await StockMovement.create({
      item: finishedItem._id,
      type: 'stockIn',
      category: 'Return from Karigar',
      quantity: 1,
      weight: grossWeight,
      purity,
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
    return successResponse(res, { karigar, finishedItem }, 'Finished item received successfully', 201);
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
        .map((m, index) => ({ ...m.toObject(), _index: index }))
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
    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      let end = null;
      if (endDate) {
        end = new Date(`${endDate}T23:59:59.999`);
      }
      materials = materials.filter((m) => {
        const d = new Date(m.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }
    const totalIssuedWeight = materials.reduce((sum, m) => sum + m.grossWeight, 0);
    const totalReturnedWeight = materials.filter((m) => m.status === 'Returned').reduce((sum, m) => sum + m.grossWeight, 0);
    const totalWastage = materials.filter((m) => m.status === 'Returned').reduce((sum, m) => sum + (m.wastage || 0), 0);
    const totalLabour = materials.reduce((sum, m) => sum + (m.labourCharge || 0), 0);
    const issuedCount = materials.length;
    const returnedCount = materials.filter((m) => m.status === 'Returned').length;
    const pendingCount = materials.filter((m) => m.status !== 'Returned').length;
    return successResponse(res, {
      karigar: { _id: karigar._id, name: karigar.name, phone: karigar.phone, specialization: karigar.specialization },
      summary: { issuedCount, returnedCount, pendingCount, totalIssuedWeight, totalReturnedWeight, totalWastage, totalLabour, wastagePercentage: totalIssuedWeight > 0 ? ((totalWastage / totalIssuedWeight) * 100).toFixed(2) : 0 },
      materials,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
