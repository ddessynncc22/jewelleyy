const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantPlugin');

const trancheSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    dateTaken: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
    },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['payment', 'interest', 'partial_redemption', 'full_redemption', 'discount'],
      default: 'payment',
    },
    paymentType: {
      type: String,
      enum: ['principal', 'interest'],
      default: 'principal',
    },
    principalId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const pawnLoanSchema = new mongoose.Schema(
  {
    loanNumber: {
      type: String,
      required: [true, 'Loan number is required'],
      trim: true,
      uppercase: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    valuation: {
      marketValue: { type: Number, default: 0 },
      assessedBy: { type: String, default: '' },
      assessedDate: { type: Date },
      notes: { type: String, default: '' },
    },
    customer: {
      name: {
        type: String,
        required: [true, 'Customer name is required'],
      },
      phone: {
        type: String,
        required: [true, 'Customer phone is required'],
      },
      address: {
        type: String,
        default: '',
      },
      citizenshipNumber: {
        type: String,
        default: '',
      },
    },
    collateralPhotos: [
      {
        type: String,
      },
    ],
    itemDetails: {
      description: {
        type: String,
        required: [true, 'Item description is required'],
      },
      weight: {
        type: Number,
        required: true,
        min: 0,
      },
      purity: {
        type: Number,
        default: 0,
        min: 0,
      },
      karat: {
        type: Number,
        required: [true, 'Karat is required'],
        min: 0,
      },
    },
    tranches: [trancheSchema],
    loanAmount: {
      type: Number,
      required: [true, 'Loan amount is required'],
      min: 0,
    },
    interestRate: {
      type: Number,
      required: [true, 'Interest rate is required'],
      min: 0,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'Renewed', 'PartialRedemption', 'Redeemed', 'Forfeited'],
      default: 'Active',
    },
    statusDate: {
      type: Date,
      default: Date.now,
    },
    payments: [paymentSchema],
    totalPaid: {
      type: Number,
      default: 0,
    },
    interestCollected: {
      type: Number,
      default: 0,
    },
    balance: {
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

pawnLoanSchema.methods.recalculateDerivedFields = function () {
  const hasTranches = (this.tranches || []).length > 0;
  if (!hasTranches && this.loanAmount > 0) {
    this.tranches.push({ amount: this.loanAmount, dateTaken: this.startDate, status: 'active' });
  }
  const activeTranches = this.tranches.filter((t) => t.status === 'active');
  const totalPrincipalFromTranches = activeTranches.reduce((sum, t) => sum + (t.amount || 0), 0);

  if (totalPrincipalFromTranches > 0) {
    this.loanAmount = totalPrincipalFromTranches;
  }

  const principalPayments = this.payments.filter((p) => p.paymentType === 'principal' || (!p.paymentType && p.type !== 'interest' && p.type !== 'discount'));
  const interestPayments = this.payments.filter((p) => p.paymentType === 'interest' || p.type === 'interest');

  this.totalPaid = principalPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  this.interestCollected = interestPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  this.balance = Math.max(0, this.loanAmount - this.totalPaid);
};

pawnLoanSchema.pre('save', function (next) {
  this.recalculateDerivedFields();
  next();
});

pawnLoanSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

pawnLoanSchema.pre(/^find/, function (next) {
  if (!this._conditions || !this._conditions.hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
  next();
});

pawnLoanSchema.index({ tenantId: 1, loanNumber: 1 }, { unique: true });
pawnLoanSchema.index({ tenantId: 1, customerId: 1 });
pawnLoanSchema.index({ tenantId: 1, status: 1 });

pawnLoanSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PawnLoan', pawnLoanSchema);
