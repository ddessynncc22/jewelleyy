const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    tenantNumber: {
      type: Number,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Tenant name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    contactPhone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    planType: {
      type: String,
      enum: ['standard', 'premium', 'enterprise'],
      default: 'standard',
    },
    vatNumber: {
      type: String,
      default: '',
    },
    logoUrl: {
      type: String,
      default: '',
    },
    storeName: {
      type: String,
      default: 'My Jewellery Store',
    },
    currency: {
      type: String,
      default: 'NPR',
    },
    defaultPurity: {
      type: Number,
      default: 916,
    },
    defaultKarat: {
      type: Number,
      default: 22,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
    businessStartDate: {
      type: Date,
      default: Date.now,
    },
    taxSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    nepalTaxSettings: {
      enabled: { type: Boolean, default: false },
      luxuryTax: { type: Number, default: 0 },
      vatRate: { type: Number, default: 13 },
      vatEnabled: { type: Boolean, default: true },
      irdPrintEnabled: { type: Boolean, default: true },
      fiscalYearStart: { type: String, default: '04' },
      panNumber: { type: String, default: '' },
      includeInInvoice: { type: Boolean, default: true },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

tenantSchema.pre('save', async function (next) {
  if (this.isNew && !this.tenantNumber) {
    const Counter = mongoose.model('Counter');
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: 'tenantNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.tenantNumber = counter.seq;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Tenant', tenantSchema);
