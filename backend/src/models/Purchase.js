const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const purchasePaymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['cash', 'bank', 'cheque'],
      default: 'cash',
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0,
    },
    reference: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// One purchased line. Supplier purchases are always refined bars;
// customer purchases are old items that may later be sent to the
// refinery via a Refine entry (refineStatus / refineId).
const purchaseItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ['bar', 'item'],
      default: 'bar',
    },
    metalType: {
      type: String,
      enum: ['gold', 'silver'],
      required: [true, 'Metal type is required'],
    },
    purityPercent: {
      type: Number,
      required: [true, 'Purity is required'],
      min: 1,
      max: 1000,
    },
    karat: {
      type: Number,
      default: 0,
      min: 0,
      max: 24,
    },
    grossWeightG: {
      type: Number,
      required: [true, 'Gross weight is required'],
      min: 0,
    },
    stoneWeightG: {
      type: Number,
      default: 0,
      min: 0,
    },
    fineWeightG: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Weight deduction % applied on customer buy-backs (wear, stones, dust).
    // givenWeightG = fineWeightG x (1 - deductionPercent/100) and is the
    // weight the customer is credited for.
    deductionPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    givenWeightG: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratePerGram: {
      type: Number,
      default: 0,
      min: 0,
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      default: '',
    },
    refineStatus: {
      type: String,
      enum: ['none', 'pending', 'refined'],
      default: 'none',
    },
    refineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Refine',
      default: null,
    },
  },
  { _id: true }
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['supplier', 'customer', 'pos_exchange'],
      required: [true, 'Purchase type is required'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    // Party snapshot. Supplier purchases carry supplierName (free text);
    // customer purchases carry an optional Customer ref plus a name snapshot.
    supplierName: {
      type: String,
      default: '',
      trim: true,
    },
    vatInvoiceNo: {
      type: String,
      default: '',
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    customerName: {
      type: String,
      default: '',
      trim: true,
    },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one purchase item is required',
      },
    },
    totals: {
      grossWeightG: { type: Number, default: 0 },
      fineWeightG: { type: Number, default: 0 },
      givenWeightG: { type: Number, default: 0 },
      goldValue: { type: Number, default: 0 },
      silverValue: { type: Number, default: 0 },
      totalValue: { type: Number, default: 0 },
    },
    rateLocked: {
      goldPerGram: { type: Number, default: 0 },
      silverPerGram: { type: Number, default: 0 },
      goldRateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rate', default: null },
      silverRateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rate', default: null },
      source: { type: String, enum: ['manual', 'live'], default: 'live' },
      lockedAt: { type: Date, default: Date.now },
    },
    payments: {
      type: [purchasePaymentSchema],
      default: [],
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    balanceDue: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'partial', 'credit'],
      default: 'credit',
    },
    notes: {
      type: String,
      default: '',
    },
    // Back-reference when this purchase was auto-created from a POS sale
    // (old-gold exchange). Lets the POS flow reverse the purchase on sale
    // deletion and lets the UI link back to the originating sale.
    saleRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

purchaseSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

purchaseSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

purchaseSchema.index({ tenantId: 1, purchaseNumber: 1 }, { unique: true });
purchaseSchema.index({ tenantId: 1, date: -1 });
purchaseSchema.index({ tenantId: 1, type: 1, date: -1 });
purchaseSchema.index({ tenantId: 1, saleRef: 1 }, { sparse: true });

purchaseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Purchase', purchaseSchema);
