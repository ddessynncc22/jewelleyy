const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const customerSchema = new mongoose.Schema(
  {
    customerCode: {
      type: String,
      required: [true, 'Customer code is required'],
      trim: true,
      uppercase: true,
    },
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
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    citizenshipNumber: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
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

customerSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.isActive = false;
  return this.save();
};

customerSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

customerSchema.index({ tenantId: 1, customerCode: 1 }, { unique: true });
customerSchema.index({ tenantId: 1, phone: 1 });

customerSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Customer', customerSchema);
