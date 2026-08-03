const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const customOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      trim: true,
      uppercase: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    customer: {
      name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
      },
      phone: {
        type: String,
        required: [true, 'Customer phone is required'],
        trim: true,
      },
      address: {
        type: String,
        default: '',
      },
    },
    branch: {
      type: String,
      default: '',
    },
    designReference: {
      type: String,
      default: '',
    },
    designImages: [
      {
        type: String,
      },
    ],
    category: {
      type: String,
      enum: ['gold', 'silver', 'diamond'],
      required: [true, 'Category is required'],
    },
    requestedWeight: {
      type: Number,
      required: [true, 'Requested weight is required'],
      min: 0,
    },
    purity: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
    },
    karat: {
      type: Number,
      default: 0,
    },
    targetCompletionDate: {
      type: Date,
      default: null,
    },
    advanceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalMakingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    wastageVariance: {
      type: Number,
      default: 0,
    },
    itemName: {
      type: String,
      default: '',
    },
    itemDescription: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['booked', 'material_issued', 'in_progress', 'ready', 'delivered', 'cancelled'],
      default: 'booked',
    },
    karigarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Karigar',
      default: null,
    },
    karigarJobId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    deliveredItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
    },
    cancellation: {
      refundAmount: { type: Number, default: 0 },
      forfeitAmount: { type: Number, default: 0 },
      reason: { type: String, default: '' },
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        note: { type: String, default: '' },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
      },
    ],
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

customOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
customOrderSchema.index({ tenantId: 1, status: 1 });
customOrderSchema.index({ tenantId: 1, customerId: 1 });
customOrderSchema.index({ tenantId: 1, karigarId: 1 });
customOrderSchema.index({ tenantId: 1, targetCompletionDate: 1 });

customOrderSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

customOrderSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

customOrderSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CustomOrder', customOrderSchema);
