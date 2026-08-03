const CustomOrder = require('../models/CustomOrder');
const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Karigar = require('../models/Karigar');
const Item = require('../models/Item');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const { generateSKU, generateBarcode } = require('../services/barcode');
const { getNextCustomerCode } = require('../services/sequence');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { scopeAggregate } = require('../utils/tenant');

const DAY_MS = 86400000;
const ACTIVE_STATUSES = ['booked', 'material_issued', 'in_progress', 'ready'];
const VALID_TRANSITIONS = {
  booked: ['material_issued', 'cancelled'],
  material_issued: ['in_progress', 'ready', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

function daysOverdue(order, asOf = new Date()) {
  if (!order.targetCompletionDate) return 0;
  if (['delivered', 'cancelled'].includes(order.status)) return 0;
  const diff = Math.floor((new Date(asOf) - new Date(order.targetCompletionDate)) / DAY_MS);
  return Math.max(0, diff);
}

function enrichOrder(order) {
  return {
    ...order,
    balanceDue: Math.max(0, (order.finalPrice || 0) - (order.advanceAmount || 0)),
    daysOverdue: daysOverdue(order),
  };
}

async function resolveCustomer(body, req) {
  let cust = null;
  if (body.customerId) {
    cust = await Customer.findById(body.customerId);
  }
  if (!cust && body.customer && body.customer.phone) {
    cust = await Customer.findOne({ phone: body.customer.phone });
  }
  if (!cust) {
    if (!req.tenantId) return null;
    const customerCode = await getNextCustomerCode(req.tenantId);
    cust = await Customer.create({
      customerCode,
      name: body.customer.name,
      phone: body.customer.phone,
      address: body.customer.address || '',
      tenantId: req.tenantId,
    });
  }
  return cust;
}

function collectDesignImages(req) {
  if (Array.isArray(req.files) && req.files.length > 0) {
    const base = req.uploadBaseUrl || '';
    return req.files.map((f) => `${base}/${f.filename}`);
  }
  if (req.body.designImages) {
    return Array.isArray(req.body.designImages) ? req.body.designImages : [req.body.designImages];
  }
  return [];
}

async function findKarigarJob(order) {
  if (!order.karigarId || !order.karigarJobId) return null;
  const karigar = await Karigar.findById(order.karigarId).lean();
  if (!karigar) return null;
  const jobId = order.karigarJobId.toString();
  const material = (karigar.materials || []).find((m) => m._id.toString() === jobId);
  if (!material) return null;
  return { karigar: { _id: karigar._id, name: karigar.name, phone: karigar.phone, specialization: karigar.specialization }, material };
}

async function updateKarigarMaterial(order, patch) {
  if (!order.karigarId || !order.karigarJobId) return null;
  const karigar = await Karigar.findById(order.karigarId);
  if (!karigar) return null;
  const jobId = order.karigarJobId.toString();
  const material = (karigar.materials || []).find((m) => m._id.toString() === jobId);
  if (!material) return null;
  const oldStatus = material.status;
  if (patch.status) material.status = patch.status;
  if (patch.status === 'Returned' && oldStatus !== 'Returned') {
    material.wastage = patch.wastage ?? material.wastage ?? 0;
    material.returnedDate = new Date();
    karigar.pendingJobs = Math.max(0, (karigar.pendingJobs || 0) - 1);
    karigar.totalReturned = (karigar.totalReturned || 0) + (patch.finalWeight || 0);
  }
  if (patch.finishedItem) material.finishedItem = patch.finishedItem;
  await karigar.save();
  return karigar;
}

async function logActivity(req, module, action, description, referenceId, referenceModel) {
  await ActivityLog.create({
    action,
    module,
    description,
    performedBy: req.user._id,
    referenceId,
    referenceModel,
  });
}

exports.getCustomOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, branch, karigarId, overdue, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (branch) query.branch = branch;
    if (karigarId) query.karigarId = karigarId;
    if (overdue === 'true') {
      query.status = { $nin: ['delivered', 'cancelled'] };
      query.targetCompletionDate = { $lt: new Date() };
    }
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { itemName: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total, statusCounts, overdueCount] = await Promise.all([
      CustomOrder.find(query)
        .populate('karigarId', 'name phone')
        .populate('deliveredItemId', 'SKU itemName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      CustomOrder.countDocuments(query),
      CustomOrder.aggregate(scopeAggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])),
      CustomOrder.countDocuments({ status: { $nin: ['delivered', 'cancelled'] }, targetCompletionDate: { $lt: new Date() } }),
    ]);
    return paginatedResponse(res, orders.map(enrichOrder), total, Number(page), Number(limit), 'Custom orders retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.getCustomOrder = async (req, res) => {
  try {
    const order = await CustomOrder.findById(req.params.id)
      .populate('karigarId', 'name phone specialization')
      .populate('deliveredItemId', 'SKU itemName category metalType purity grossWeight netMetalWeight sellingPrice images')
      .populate('customerId', 'name phone customerCode')
      .populate('statusHistory.performedBy', 'name')
      .lean();
    if (!order) {
      return errorResponse(res, 'Custom order not found', 404);
    }
    const karigarJob = await findKarigarJob(order);
    const balanceDue = Math.max(0, (order.finalPrice || 0) - (order.advanceAmount || 0));
    return successResponse(res, {
      order: enrichOrder(order),
      karigarJob,
      balanceDue,
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createCustomOrder = async (req, res) => {
  try {
    const { customer, category, requestedWeight } = req.body;
    if (!customer || !customer.name || !customer.phone) {
      return errorResponse(res, 'Customer name and phone are required', 400);
    }
    if (!category || !requestedWeight || requestedWeight <= 0) {
      return errorResponse(res, 'Category and a positive requested weight are required', 400);
    }
    if (!req.body.karat && req.body.karat !== 0) {
      return errorResponse(res, 'Karat is required', 400);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create custom order', 400);
    const cust = await resolveCustomer(req.body, req);
    if (!cust) return errorResponse(res, 'Could not resolve customer', 400);
    const orderCount = await CustomOrder.countDocuments({ isDeleted: false });
    const orderNumber = `CO-${String(orderCount + 1).padStart(5, '0')}`;
    const designImages = collectDesignImages(req);
    const order = await CustomOrder.create({
      tenantId: req.tenantId,
      orderNumber,
      customerId: cust._id,
      customer: { name: cust.name, phone: cust.phone, address: cust.address || '' },
      branch: req.body.branch || '',
      designReference: req.body.designReference || '',
      designImages,
      category,
      requestedWeight: Number(requestedWeight),
      purity: req.body.purity || 0,
      karat: req.body.karat || 0,
      targetCompletionDate: req.body.targetCompletionDate || null,
      advanceAmount: req.body.advanceAmount || 0,
      estimatedPrice: req.body.estimatedPrice || 0,
      karigarId: req.body.karigarId || null,
      itemName: req.body.itemName || '',
      itemDescription: req.body.itemDescription || '',
      status: 'booked',
      statusHistory: [{ status: 'booked', note: 'Order booked', performedBy: req.user._id }],
    });
    await logActivity(req, 'customOrder', 'create', `Custom order ${orderNumber} booked for ${cust.name}`, order._id, 'CustomOrder');
    return successResponse(res, order, 'Custom order created', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.addAdvance = async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || Number(amount) <= 0) {
      return errorResponse(res, 'A positive advance amount is required', 400);
    }
    const order = await CustomOrder.findById(req.params.id);
    if (!order) return errorResponse(res, 'Custom order not found', 404);
    if (['delivered', 'cancelled'].includes(order.status)) {
      return errorResponse(res, 'Order is already closed', 400);
    }
    order.advanceAmount = (order.advanceAmount || 0) + Number(amount);
    order.statusHistory.push({ status: order.status, note: `Advance of ${amount} received${note ? ` - ${note}` : ''}`, performedBy: req.user._id });
    await order.save();
    await logActivity(req, 'customOrder', 'addAdvance', `Advance of ${amount} received for ${order.orderNumber}`, order._id, 'CustomOrder');
    return successResponse(res, order, 'Advance added successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status: newStatus, note } = req.body;
    if (!newStatus || !VALID_TRANSITIONS[newStatus]) {
      return errorResponse(res, 'Invalid status value', 400);
    }
    const order = await CustomOrder.findById(req.params.id);
    if (!order) return errorResponse(res, 'Custom order not found', 404);
    const current = order.status;
    if (!VALID_TRANSITIONS[current].includes(newStatus)) {
      return errorResponse(res, `Cannot move order from ${current} to ${newStatus}`, 400);
    }

    switch (newStatus) {
      case 'material_issued': {
        const { karigarId } = req.body;
        if (!karigarId) return errorResponse(res, 'A karigar is required to issue material', 400);
        const karigar = await Karigar.findById(karigarId);
        if (!karigar) return errorResponse(res, 'Karigar not found', 404);
        order.karigarId = karigarId;
        karigar.materials.push({
          date: new Date(),
          itemName: order.itemName || `Custom order ${order.orderNumber}`,
          grossWeight: order.requestedWeight,
          stoneWeight: 0,
          purity: order.purity || 0,
          karat: order.karat || 0,
          labourCharge: order.finalMakingCharge || 0,
          wastage: 0,
          status: 'Issued',
        });
        karigar.pendingJobs = (karigar.pendingJobs || 0) + 1;
        karigar.totalIssued = (karigar.totalIssued || 0) + order.requestedWeight;
        await karigar.save();
        order.karigarJobId = karigar.materials[karigar.materials.length - 1]._id;
        await StockMovement.create({
          item: null,
          type: 'stockOut',
          category: 'With Karigar',
          quantity: 1,
          weight: order.requestedWeight,
          purity: order.purity || 0,
          reference: `Order: ${order.orderNumber}`,
          notes: `Raw material issued to ${karigar.name} for custom order ${order.orderNumber}`,
          performedBy: req.user._id,
        });
        break;
      }
      case 'in_progress': {
        if (!order.karigarJobId) return errorResponse(res, 'Material must be issued before starting work', 400);
        await updateKarigarMaterial(order, { status: 'In Progress' });
        break;
      }
      case 'ready': {
        if (!order.karigarJobId) return errorResponse(res, 'Material must be issued before marking ready', 400);
        const { finalWeight, finalMakingCharge, itemName, itemDescription } = req.body;
        if (finalWeight === undefined || Number(finalWeight) <= 0) {
          return errorResponse(res, 'Final weight is required', 400);
        }
        const wastage = order.requestedWeight - Number(finalWeight);
        if (wastage < 0) return errorResponse(res, 'Final weight cannot exceed the issued weight', 400);
        order.finalWeight = Number(finalWeight);
        order.finalMakingCharge = finalMakingCharge || 0;
        order.wastageVariance = Number(wastage.toFixed(3));
        if (itemName) order.itemName = itemName;
        if (itemDescription !== undefined) order.itemDescription = itemDescription;
        await updateKarigarMaterial(order, { status: 'Returned', wastage, finalWeight: Number(finalWeight) });
        break;
      }
      case 'delivered': {
        if (current !== 'ready') return errorResponse(res, 'Order must be ready before delivery', 400);
        const { finalPrice, itemName, itemDescription } = req.body;
        if (finalPrice === undefined || Number(finalPrice) < 0) {
          return errorResponse(res, 'Final price is required', 400);
        }
        if (!req.tenantId) return errorResponse(res, 'Tenant context required', 400);
        const item = await Item.create({
          tenantId: req.tenantId,
          SKU: generateSKU(order.category, order.category, order.purity || 0),
          barcode: generateBarcode(),
          category: order.category,
          metalType: order.category,
          purity: order.purity || 0,
          karat: order.karat || 0,
          itemName: itemName || order.itemName || `Custom ${order.category} order`,
          description: itemDescription || order.itemDescription || '',
          grossWeight: order.finalWeight || order.requestedWeight,
          stoneWeight: 0,
          netMetalWeight: order.finalWeight || order.requestedWeight,
          designCode: order.designReference || '',
          costPrice: 0,
          sellingPrice: Number(finalPrice),
          makingCharge: order.finalMakingCharge || 0,
          status: 'Sold',
          images: order.designImages || [],
        });
        await StockMovement.create({
          item: item._id,
          type: 'stockOut',
          category: 'Custom Order',
          quantity: 1,
          weight: order.finalWeight || order.requestedWeight,
          purity: order.purity || 0,
          reference: order.orderNumber,
          notes: `Custom order ${order.orderNumber} delivered to ${order.customer?.name || ''}`,
          performedBy: req.user._id,
        });
        order.finalPrice = Number(finalPrice);
        order.deliveredItemId = item._id;
        if (itemName) order.itemName = itemName;
        if (itemDescription !== undefined) order.itemDescription = itemDescription;
        await updateKarigarMaterial(order, { finishedItem: item._id });
        const balanceDue = Number(finalPrice) - (order.advanceAmount || 0);
        if (balanceDue > 0 && order.customerId) {
          const lastLedger = await CustomerLedger.findOne({ customer: order.customerId }).sort({ transactionDate: -1 });
          const prevBalance = lastLedger ? lastLedger.balanceAfter : 0;
          await CustomerLedger.create({
            customer: order.customerId,
            transactionType: 'credit',
            reference: order.orderNumber,
            referenceModel: 'CustomOrder',
            referenceId: order._id,
            amount: balanceDue,
            balanceAfter: prevBalance + balanceDue,
            note: `Custom order ${order.orderNumber} - balance after advance of ${order.advanceAmount}`,
            transactionDate: new Date(),
          });
        }
        break;
      }
      case 'cancelled': {
        const refundAmount = Number(req.body.refundAmount || 0);
        const forfeitAmount = Number(req.body.forfeitAmount || 0);
        order.cancellation = {
          refundAmount,
          forfeitAmount,
          reason: req.body.reason || '',
        };
        if (order.karigarId && order.karigarJobId) {
          await updateKarigarMaterial(order, { status: 'Returned', wastage: order.requestedWeight, finalWeight: 0 });
        }
        break;
      }
      default:
        break;
    }

    order.status = newStatus;
    order.statusHistory.push({ status: newStatus, note: note || '', performedBy: req.user._id });
    await order.save();
    await logActivity(req, 'customOrder', 'updateStatus', `Custom order ${order.orderNumber} moved from ${current} to ${newStatus}`, order._id, 'CustomOrder');
    return successResponse(res, enrichOrder(order.toObject()), `Order moved to ${newStatus}`);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteCustomOrder = async (req, res) => {
  try {
    const order = await CustomOrder.findById(req.params.id);
    if (!order) return errorResponse(res, 'Custom order not found', 404);
    await order.softDelete();
    await logActivity(req, 'customOrder', 'delete', `Custom order ${order.orderNumber} deleted`, order._id, 'CustomOrder');
    return successResponse(res, null, 'Custom order deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
