const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');
const { gramsToLaal } = require('../utils/rates');

const stockMovementSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
    },
    type: {
      type: String,
      enum: ['stockIn', 'stockOut'],
      required: [true, 'Movement type is required'],
    },
    category: {
      type: String,
      enum: [
        'Purchase',
        'Purchase Return',
        'Sale',
        'Sale Return',
        'Transfer In',
        'Transfer Out',
        'Adjustment',
        'With Karigar',
        'Return from Karigar',
        'Custom Order',
        'Pawn Redemption',
        'Pawn Issuance',
        'Melted',
        'Damaged',
        'Manufacturing',
        'Consignment/Approval',
      ],
      required: [true, 'Category is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: 0,
    },
    weight: {
      type: Number,
      default: 0,
      min: 0,
    },
    weightInLaal: {
      type: Number,
      default: 0,
      min: 0,
    },
    purity: {
      type: Number,
      default: 0,
    },
    reference: {
      type: String,
      default: '',
    },
    referenceModel: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performed by is required'],
    },
    movementDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

stockMovementSchema.index({ tenantId: 1, item: 1, movementDate: -1 });
stockMovementSchema.index({ tenantId: 1, type: 1, category: 1 });
stockMovementSchema.index({ tenantId: 1, performedBy: 1 });
stockMovementSchema.index({ tenantId: 1, movementDate: -1 });

stockMovementSchema.pre('save', function (next) {
  this.weightInLaal = gramsToLaal(this.weight);
  next();
});

stockMovementSchema.plugin(tenantPlugin);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
