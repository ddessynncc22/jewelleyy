const mongoose = require('mongoose');

const accessRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['registration', 'password_reset'],
      required: [true, 'Request type is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    message: {
      type: String,
      trim: true,
      default: '',
    },
    requestedRole: {
      type: String,
      enum: ['admin', 'manager', 'staff'],
      default: 'staff',
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    tenantId: {
      type: Number,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

accessRequestSchema.index({ status: 1, createdAt: -1 });
accessRequestSchema.index({ email: 1, type: 1 });

module.exports = mongoose.model('AccessRequest', accessRequestSchema);
