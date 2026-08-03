const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },
    module: {
      type: String,
      required: [true, 'Module is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceModel: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

activityLogSchema.index({ tenantId: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, module: 1, action: 1 });
activityLogSchema.index({ tenantId: 1, performedBy: 1 });

activityLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
