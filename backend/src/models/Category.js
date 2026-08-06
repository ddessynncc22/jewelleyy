const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    parent: {
      // Points to the top-level category this subcategory belongs to.
      // null/undefined means this IS a top-level category.
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

categorySchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

categorySchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

// Name is unique per (tenant, parent), so two different top-level categories
// can each have their own "Rings" subcategory.
categorySchema.index({ tenantId: 1, parent: 1, name: 1 }, { unique: true });

categorySchema.plugin(tenantPlugin);

module.exports = mongoose.model('Category', categorySchema);
