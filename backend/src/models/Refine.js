const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

// A refinery entry for ONE item line. The gold weight given to the
// customer / credited (givenWeightG) is entered when the entry is
// created; the received weight comes back from the refinery later and
// is entered on a second visit (receive). Profit = received - given.
const refineSchema = new mongoose.Schema(
  {
    refineNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    sourceType: {
      type: String,
      enum: ['purchase', 'manual'],
      default: 'manual',
    },
    // Link back to the purchase item line when sent from a purchase.
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null,
    },
    purchaseItemIndex: {
      type: Number,
      default: -1,
    },
    metalType: {
      type: String,
      enum: ['gold', 'silver'],
      default: 'gold',
    },
    description: {
      type: String,
      default: '',
    },
    // Weight on the scale when the item arrives.
    actualWeightG: {
      type: Number,
      required: [true, 'Actual weight is required'],
      min: 0,
    },
    // Gold weight given to the customer / credited (expected weight).
    givenWeightG: {
      type: Number,
      required: [true, 'Given weight is required'],
      min: 0,
    },
    purityPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
    },
    karat: {
      type: Number,
      default: 0,
      min: 0,
      max: 24,
    },
    // Filled on the later "receive" visit.
    status: {
      type: String,
      enum: ['pending', 'received'],
      default: 'pending',
    },
    receivedWeightG: {
      type: Number,
      default: null,
      min: 0,
    },
    receivedPurity: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
    },
    receivedDate: {
      type: Date,
      default: null,
    },
    // Gold rate locked at issue time. The profit amount is booked at this
    // rate when the gold is received — never at the (changing) receive-day rate.
    ratePerGram: {
      type: Number,
      default: 0,
      min: 0,
    },
    rateLockedAt: {
      type: Date,
      default: null,
    },
    profitG: {
      type: Number,
      default: 0,
    },
    profitAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
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

refineSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

refineSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

refineSchema.index({ tenantId: 1, refineNumber: 1 }, { unique: true });
refineSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
refineSchema.index({ tenantId: 1, purchaseId: 1 });

refineSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Refine', refineSchema);
