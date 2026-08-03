const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const customerLedgerSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required'],
    },
    transactionType: {
      type: String,
      enum: ['credit', 'payment'],
      required: [true, 'Transaction type is required'],
    },
    reference: {
      type: String,
      default: '',
    },
    referenceModel: {
      type: String,
      default: '',
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

customerLedgerSchema.index({ tenantId: 1, customer: 1, transactionDate: -1 });
customerLedgerSchema.index({ tenantId: 1, referenceId: 1 });

customerLedgerSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CustomerLedger', customerLedgerSchema);
