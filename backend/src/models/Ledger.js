const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const ledgerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ledger name is required'],
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: ['cash', 'bank', 'debtor', 'creditor', 'stock', 'income', 'expense'],
      required: [true, 'Ledger type is required'],
    },
    group: {
      type: String,
      default: '',
      trim: true,
    },
    partyType: {
      type: String,
      enum: ['customer', 'supplier', 'none'],
      default: 'none',
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    partyName: {
      type: String,
      default: '',
      trim: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
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

ledgerSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

ledgerSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

ledgerSchema.index({ tenantId: 1, name: 1 }, { unique: true });
ledgerSchema.index({ tenantId: 1, type: 1 });
ledgerSchema.index({ tenantId: 1, partyId: 1 });

ledgerSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Ledger', ledgerSchema);
