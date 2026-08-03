const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema(
  {
    metalType: {
      type: String,
      enum: ['gold', 'silver'],
      required: [true, 'Metal type is required'],
    },
    rate: {
      type: Number,
      required: [true, 'Rate is required'],
      min: 0,
    },
    unit: {
      type: String,
      enum: ['tola', 'gram'],
      required: [true, 'Unit is required'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

rateSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

rateSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

rateSchema.index({ metalType: 1, date: -1 });
rateSchema.index({ metalType: 1, unit: 1, date: -1 });

module.exports = mongoose.model('Rate', rateSchema);
