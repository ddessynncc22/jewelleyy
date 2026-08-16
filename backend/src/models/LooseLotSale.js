const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

// One sale line against a loose lot. `expectedWeight` is avgWeightPerPiece x
// piecesSold and `deviationPercent` measures how far the actual weighed value
// strayed from it — the reconciliation report uses both.
const looseLotSaleSchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LooseLot',
      required: [true, 'Lot reference is required'],
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },
    saleNumber: { type: String, trim: true, default: '' },
    piecesSold: {
      type: Number,
      required: [true, 'Pieces sold is required'],
      min: 0,
    },
    actualWeightSold: {
      type: Number,
      required: [true, 'Sold weight is required'],
      min: 0,
    },
    expectedWeight: {
      type: Number,
      default: 0,
    },
    weightSource: {
      type: String,
      enum: ['average', 'manual_weighed'],
      default: 'average',
    },
    deviationPercent: {
      type: Number,
      default: 0,
    },
    ratePerGram: {
      type: Number,
      default: 0,
    },
    metalValue: {
      type: Number,
      default: 0,
    },
    wastagePercent: {
      type: Number,
      default: 0,
      min: 0,
    },
    wastageAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    makingCharge: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      default: 0,
    },
    overrideReason: { type: String, default: '' },
    managerApproved: { type: Boolean, default: false },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performed by is required'],
    },
    soldAt: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

looseLotSaleSchema.index({ tenantId: 1, lot: 1, soldAt: -1 });
looseLotSaleSchema.index({ tenantId: 1, invoice: 1 });
looseLotSaleSchema.index({ tenantId: 1, soldAt: -1 });

looseLotSaleSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

looseLotSaleSchema.plugin(tenantPlugin);

module.exports = mongoose.model('LooseLotSale', looseLotSaleSchema);
