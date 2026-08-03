const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const karigarSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    address: {
      type: String,
      default: '',
    },
    specialization: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    materials: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        itemName: {
          type: String,
          required: true,
        },
        grossWeight: {
          type: Number,
          required: true,
          min: 0,
        },
        stoneWeight: {
          type: Number,
          default: 0,
        },
        purity: {
          type: Number,
          required: true,
        },
        karat: {
          type: Number,
          default: 0,
        },
        labourCharge: {
          type: Number,
          default: 0,
        },
        wastage: {
          type: Number,
          default: 0,
        },
        status: {
          type: String,
          enum: ['Issued', 'In Progress', 'Completed', 'Returned'],
          default: 'Issued',
        },
        finishedItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Item',
          default: null,
        },
        returnedDate: {
          type: Date,
          default: null,
        },
      },
    ],
    pendingJobs: {
      type: Number,
      default: 0,
    },
    totalIssued: {
      type: Number,
      default: 0,
    },
    totalReturned: {
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

karigarSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.isActive = false;
  return this.save();
};

karigarSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

karigarSchema.index({ tenantId: 1, name: 1 });
karigarSchema.index({ tenantId: 1, phone: 1 });

karigarSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Karigar', karigarSchema);
