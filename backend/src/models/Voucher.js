const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const voucherSchema = new mongoose.Schema(
  {
    voucherNumber: {
      type: String,
      required: [true, 'Voucher number is required'],
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['payment', 'receipt', 'contra', 'journal', 'metal_to_cash'],
      required: [true, 'Voucher type is required'],
    },
    date: {
      type: Date,
      required: [true, 'Voucher date is required'],
      default: Date.now,
    },
    narration: {
      type: String,
      default: '',
      trim: true,
    },
    referenceNo: {
      type: String,
      default: '',
      trim: true,
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

voucherSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

voucherSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

voucherSchema.index({ tenantId: 1, voucherNumber: 1 }, { unique: true });
voucherSchema.index({ tenantId: 1, type: 1 });
voucherSchema.index({ tenantId: 1, date: 1 });

voucherSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Voucher', voucherSchema);