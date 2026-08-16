const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');
const { GRAMS_PER_LAAL, gramsToLaal } = require('../utils/rates');
const { generateQrToken } = require('../services/barcode');

const itemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ['tagged', 'loose'],
      default: 'tagged',
    },
    SKU: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      default: '',
    },
    qrToken: {
      // Opaque, non-guessable token embedded in the printed QR tag. Random UUID
      // per item; used by the tenant-scoped QR lookup, never the raw item id.
      type: String,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    subcategory: {
      type: String,
      trim: true,
      default: '',
    },
    designCode: {
      type: String,
      trim: true,
      default: '',
    },
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    images: [
      {
        type: String,
      },
    ],
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    grossWeight: {
      type: Number,
      required: [true, 'Gross weight is required'],
      min: 0,
    },
    stoneWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    netMetalWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    grossWeightInLaal: {
      type: Number,
      default: 0,
      min: 0,
    },
    netMetalWeightInLaal: {
      type: Number,
      default: 0,
      min: 0,
    },
    stoneWeightInLaal: {
      type: Number,
      default: 0,
      min: 0,
    },
    metalType: {
      type: String,
      enum: ['gold', 'silver', 'diamond', 'gemstone'],
      required: [true, 'Metal type is required'],
    },
    gemstoneType: { type: String, default: '' },
    purity: {
      type: Number,
      required: [true, 'Purity is required'],
      min: 0,
      max: 1000,
    },
    karat: {
      type: Number,
      default: 0,
    },
    length: {
      type: Number,
      default: 0,
      min: 0,
    },
    lengthUnit: {
      type: String,
      enum: ['inch', 'cm', 'mm'],
      default: 'mm',
    },
    diameter: {
      type: Number,
      default: 0,
      min: 0,
    },
    ringSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    karigarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Karigar',
      default: null,
    },
    // Karigar labour payment tracking for items assigned a karigar directly at
    // creation (no material/issue record — those are paid via karigar.materials[]).
    paymentDue: { type: Number, default: 0, min: 0 },
    paymentReceived: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
    paymentHistory: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, default: 0, min: 0 },
        type: { type: String, enum: ['cash', 'gold', 'mixed'], default: 'cash' },
        goldWeight: { type: Number, default: 0 },
        goldKarat: { type: Number, default: 24 },
        goldPurity: { type: Number, default: 999 },
        goldValue: { type: Number, default: 0 },
        note: { type: String, default: '' },
      },
    ],
    stoneType: {
      type: String,
      default: '',
    },
    carat: {
      type: Number,
      default: 0,
    },
    stoneCarat: {
      // Carats per stone (universal across all gemstones).
      type: Number,
      default: 0,
      min: 0,
    },
    stoneWeightGram: {
      // Pre-computed total stone weight in grams = stoneQuantity * stoneCarat * 0.2.
      // Stored (not derived at query time) so downstream reports read it directly.
      type: Number,
      default: 0,
      min: 0,
    },
    stoneQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    stoneRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    stoneAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cut: {
      type: String,
      default: '',
    },
    clarity: {
      type: String,
      default: '',
    },
    certificationNumber: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'In Stock',
        'Sold',
        'With Karigar',
        'Pawn Collateral',
        'On Approval',
        'Branch Transfer',
        'Damaged',
        'Melted',
      ],
      default: 'In Stock',
    },
    currentLocation: {
      type: String,
      default: '',
    },
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    costMakingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    costWastagePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    costStonePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingMakingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingWastagePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    sellingStonePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    makingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    wastagePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    linkedItems: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        type: { type: String, enum: ['pair', 'set', 'matching'], default: 'set' },
      },
    ],
    notes: [
      {
        text: { type: String, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    certificates: [
      {
        type: { type: String, default: '' },
        fileUrl: { type: String, default: '' },
      },
    ],
    priceHistory: [
      {
        field: { type: String, enum: ['costPrice', 'sellingPrice', 'costStonePrice', 'sellingStonePrice'], required: true },
        oldValue: { type: Number },
        newValue: { type: Number },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
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

itemSchema.index({ tenantId: 1, SKU: 1 }, { unique: true });
itemSchema.index({ tenantId: 1, itemType: 1 });
itemSchema.index({ tenantId: 1, category: 1, status: 1 });
itemSchema.index({ tenantId: 1, status: 1, quantity: 1 });
itemSchema.index({ tenantId: 1, metalType: 1, purity: 1 });
itemSchema.index({ tenantId: 1, barcode: 1 });
itemSchema.index({ tenantId: 1, qrToken: 1 }, { unique: true, sparse: true });

itemSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

itemSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

itemSchema.pre('save', function (next) {
  // Mint a QR token on every creation path (create, clone, bulk, custom-order
  // delivery, karigar receive, loose parent), so no item can persist without one.
  if (!this.qrToken) {
    this.qrToken = generateQrToken();
  }
  this.grossWeightInLaal = gramsToLaal(this.grossWeight);
  this.netMetalWeightInLaal = gramsToLaal(this.netMetalWeight);
  this.stoneWeightInLaal = gramsToLaal(this.stoneWeight);
  next();
});

itemSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

itemSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Item', itemSchema);
