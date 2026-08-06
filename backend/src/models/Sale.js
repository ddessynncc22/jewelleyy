const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const saleItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    weight: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    purity: {
      type: Number,
      default: 0,
    },
    makingCharge: {
      type: Number,
      default: 0,
    },
    wastagePercent: {
      type: Number,
      default: 5,
    },
    ratePerGram: {
      type: Number,
      default: 0,
    },
    metalValue: {
      type: Number,
      default: 0,
    },
    stonePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    saleNumber: {
      type: String,
      required: [true, 'Sale number is required'],
      trim: true,
      uppercase: true,
    },
    items: [saleItemSchema],
    paymentType: {
      type: String,
      enum: ['cash', 'khaata', 'partial', 'oldGoldExchange'],
      required: [true, 'Payment type is required'],
    },
    cashAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    khaataAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    oldGoldDetails: {
      description: { type: String, default: '' },
      weight: { type: Number, default: 0 },
      purity: { type: Number, default: 0 },
      deductionPercent: { type: Number, default: 0 },
      netWeight: { type: Number, default: 0 },
      value: { type: Number, default: 0 },
      valuedAmount: { type: Number, default: 0 },
      deductibleAmount: { type: Number, default: 0 },
    },
    taxDetails: {
      totalTax: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      taxes: [
        {
          name: { type: String, required: true },
          rate: { type: Number, required: true },
          amount: { type: Number, required: true },
        },
      ],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: 0,
    },
    diamondAmount: {
      // Diamond portion (Rs) of this sale, tracked so the tenant's annual
      // diamond sales can be tallied against the 13% VAT threshold.
      type: Number,
      default: 0,
      min: 0,
    },
    actualAmountReceived: {
      type: Number,
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sold by is required'],
    },
    cashierName: {
      type: String,
      trim: true,
      default: '',
    },
    saleDate: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

saleSchema.pre('save', function (next) {
  const totalWithTax = this.totalAmount + (this.taxDetails?.totalTax || 0) - (this.discountAmount || 0);
  this.balance = totalWithTax - this.paidAmount;
  if (this.balance < 0) this.balance = 0;
  next();
});

saleSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

saleSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

saleSchema.index({ tenantId: 1, saleNumber: 1 }, { unique: true });
saleSchema.index({ tenantId: 1, saleDate: -1 });
saleSchema.index({ tenantId: 1, customer: 1 });

saleSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Sale', saleSchema);
