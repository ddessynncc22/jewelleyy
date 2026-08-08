const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

// Running ledger of refined (fine) gold stock. Balance is read from the
// most recent entry's balanceAfter and new entries append on top —
// the same read-last-then-append pattern as CustomerLedger.
const refinedStockEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['in', 'out'],
      required: [true, 'Movement type is required'],
    },
    source: {
      type: String,
      enum: ['purchase', 'refine', 'custom_order', 'reversal', 'manual'],
      required: [true, 'Source is required'],
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceNumber: {
      type: String,
      default: '',
    },
    weightG: {
      type: Number,
      required: [true, 'Weight is required'],
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performed by is required'],
    },
  },
  {
    timestamps: true,
  }
);

refinedStockEntrySchema.index({ tenantId: 1, date: -1 });

refinedStockEntrySchema.plugin(tenantPlugin);

module.exports = mongoose.model('RefinedStockEntry', refinedStockEntrySchema);
