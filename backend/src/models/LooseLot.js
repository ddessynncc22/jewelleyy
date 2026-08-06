const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

// Loose/Bunch items (nose pins, tops, studs, beads) cannot be individually
// barcode-tagged. They are tracked by LOT rather than by piece. Each lot hangs
// off a parent Item (itemType: 'loose') that holds the shared design fields.
// Quantity/weight accounting lives here (remainingPieces/remainingWeight);
// the parent Item.quantity/grossWeight are informational only.
const looseLotSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Parent item is required'],
    },
    lotBarcode: {
      type: String,
      required: [true, 'Lot barcode is required'],
      trim: true,
      uppercase: true,
    },
    lotNumber: {
      type: String,
      trim: true,
      default: '',
    },
    // Denormalized copies of the parent item's design fields so the POS screen
    // and reports do not need a join for every read.
    itemName: { type: String, default: '' },
    designCode: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    subcategory: { type: String, trim: true, default: '' },
    metalType: {
      type: String,
      enum: ['gold', 'silver', 'diamond', 'gemstone'],
      required: [true, 'Metal type is required'],
    },
    purity: {
      type: Number,
      required: [true, 'Purity is required'],
      min: 0,
      max: 1000,
    },
    karat: { type: Number, default: 0 },

    length: { type: Number, default: 0, min: 0 },
    lengthUnit: { type: String, enum: ['inch', 'cm', 'mm'], default: 'mm' },
    diameter: { type: Number, default: 0, min: 0 },

    karigarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Karigar',
      default: null,
    },

    totalGrossWeight: {
      type: Number,
      required: [true, 'Total gross weight is required'],
      min: 0,
    },
    totalPieces: {
      type: Number,
      required: [true, 'Total pieces is required'],
      min: 1,
    },
    avgWeightPerPiece: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingPieces: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingWeight: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Reference rate captured at creation. Valuation always uses the LIVE rate
    // from the Rate model (per the product decision); this is a fallback when
    // no live rate exists.
    ratePerGram: {
      type: Number,
      default: 0,
      min: 0,
    },

    makingChargeType: {
      type: String,
      enum: ['per_piece', 'per_gram', 'percentage', 'none'],
      default: 'per_piece',
    },
    makingChargeValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Low-stock alert triggers on EITHER dimension (each is optional; 0 = off).
    lowStockPiecesThreshold: { type: Number, default: 0, min: 0 },
    lowStockWeightThreshold: { type: Number, default: 0, min: 0 },

    notes: { type: String, default: '' },

    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
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

looseLotSchema.index({ tenantId: 1, lotBarcode: 1 }, { unique: true });
looseLotSchema.index({ tenantId: 1, karigarId: 1 });
looseLotSchema.index({ tenantId: 1, status: 1, metalType: 1 });
looseLotSchema.index({ tenantId: 1, item: 1 });
looseLotSchema.index({ tenantId: 1, remainingPieces: 1 });

looseLotSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

looseLotSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

looseLotSchema.pre('save', function (next) {
  this.remainingPieces = Math.max(0, this.remainingPieces || 0);
  this.remainingWeight = Math.max(0, this.remainingWeight || 0);
  // Only derive the average from the creation totals when the lot is brand new.
  // After a sale the controller explicitly sets avgWeightPerPiece from the
  // remaining weight/pieces, and a later save must not reset it.
  if (this.isNew && this.totalPieces > 0) {
    this.avgWeightPerPiece = Number((this.totalGrossWeight / this.totalPieces).toFixed(4));
  }
  if (this.remainingPieces <= 0) {
    this.remainingPieces = 0;
    this.remainingWeight = 0;
    this.status = 'closed';
  }
  next();
});

looseLotSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

looseLotSchema.plugin(tenantPlugin);

module.exports = mongoose.model('LooseLot', looseLotSchema);
