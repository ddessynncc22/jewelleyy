const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const voucherEntrySchema = new mongoose.Schema(
  {
    voucher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      required: [true, 'Voucher reference is required'],
      index: true,
    },
    ledger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
      required: [true, 'Ledger reference is required'],
      index: true,
    },
    debit: {
      type: Number,
      default: 0,
      min: 0,
    },
    credit: {
      type: Number,
      default: 0,
      min: 0,
    },
    narration: {
      type: String,
      default: '',
      trim: true,
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

voucherEntrySchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

voucherEntrySchema.index({ tenantId: 1, voucher: 1 });
voucherEntrySchema.index({ tenantId: 1, ledger: 1 });
voucherEntrySchema.index({ tenantId: 1, createdAt: 1 });

voucherEntrySchema.plugin(tenantPlugin);

module.exports = mongoose.model('VoucherEntry', voucherEntrySchema);