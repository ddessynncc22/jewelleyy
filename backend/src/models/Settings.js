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
  looseWeightTolerancePercent: { type: Number, default: 15, min: 0, max: 100 },
  businessStartDate: { type: Date, default: Date.now },
  panNumber: { type: String, default: '' },
  goldTransportCharge: { type: Number, default: 0, min: 0 },
  silverTransportCharge: { type: Number, default: 0, min: 0 },
  logoUrl: { type: String, default: '' },
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
    if (this.logoUrl !== undefined) fields.logoUrl = this.logoUrl;
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
