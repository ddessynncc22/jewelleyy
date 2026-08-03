const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  tenantId: { type: Number, required: true, unique: true },
  storeName: { type: String, default: 'My Jewellery Store' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  currency: { type: String, default: 'NPR' },
  defaultPurity: { type: Number, default: 916 },
  defaultKarat: { type: Number, default: 22 },
  lowStockThreshold: { type: Number, default: 5 },
  businessStartDate: { type: Date, default: Date.now },
  taxSettings: { type: mongoose.Schema.Types.Mixed, default: {} },
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
}, { timestamps: true });

settingsSchema.post('save', async function () {
  if (!this.tenantId) return;
  try {
    const Tenant = require('./Tenant');
    const fields = {};
    if (this.storeName !== undefined) fields.storeName = this.storeName;
    if (this.email !== undefined) fields.contactEmail = this.email;
    if (this.phone !== undefined) fields.contactPhone = this.phone;
    if (this.address !== undefined) fields.address = this.address;
    if (this.currency !== undefined) fields.currency = this.currency;
    if (this.defaultPurity !== undefined) fields.defaultPurity = this.defaultPurity;
    if (this.defaultKarat !== undefined) fields.defaultKarat = this.defaultKarat;
    if (this.lowStockThreshold !== undefined) fields.lowStockThreshold = this.lowStockThreshold;
    if (this.taxSettings !== undefined) fields.taxSettings = this.taxSettings;
    if (this.nepalTaxSettings !== undefined) fields.nepalTaxSettings = this.nepalTaxSettings;
    if (Object.keys(fields).length > 0) {
      await Tenant.findOneAndUpdate({ tenantNumber: this.tenantId }, { $set: fields });
    }
  } catch (err) {
    console.error('[Settings.post-save] Failed to sync tenant:', err.message);
  }
});

settingsSchema.statics.getSettings = async function () {
  const { getCurrentTenantId } = require('../middleware/tenantPlugin');
  const tenantId = getCurrentTenantId();
  if (!tenantId) return null;
  let settings = await this.findOne({ tenantId });
  if (!settings) {
    settings = await this.create({ tenantId });
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
