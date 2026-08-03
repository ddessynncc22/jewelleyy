const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');
const { GRAMS_PER_LAAL, gramsToLaal } = require('../utils/rates');

const itemSchema = new mongoose.Schema(
  {
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
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
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
    karigarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Karigar',
      default: null,
    },
    stoneType: {
      type: String,
      default: '',
    },
    carat: {
      type: Number,
      default: 0,
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
        field: { type: String, enum: ['costPrice', 'sellingPrice'], required: true },
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
itemSchema.index({ tenantId: 1, category: 1, status: 1 });
itemSchema.index({ tenantId: 1, status: 1, quantity: 1 });
itemSchema.index({ tenantId: 1, metalType: 1, purity: 1 });
itemSchema.index({ tenantId: 1, barcode: 1 });

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
