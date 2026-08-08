const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const metalToCashDetailSchema = new mongoose.Schema(
  {
    voucher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      required: [true, 'Voucher reference is required'],
      index: true,
    },
    metalType: {
      type: String,
      enum: ['gold', 'silver'],
      required: [true, 'Metal type is required'],
    },
    purity: {
      type: Number,
      default: 999,
      min: 0,
      max: 1000,
    },
    weightG: {
      type: Number,
      required: [true, 'Weight in grams is required'],
      min: 0,
    },
    ratePerG: {
      type: Number,
      required: [true, 'Rate per gram is required'],
      min: 0,
    },
    value: {
      type: Number,
      default: 0,
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

metalToCashDetailSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

metalToCashDetailSchema.index({ tenantId: 1, voucher: 1 });

metalToCashDetailSchema.plugin(tenantPlugin);

module.exports = mongoose.model('MetalToCashDetail', metalToCashDetailSchema);