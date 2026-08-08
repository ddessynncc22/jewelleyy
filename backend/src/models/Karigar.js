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
    panNumber: {
      type: String,
      default: '',
      trim: true,
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
        metalType: {
          type: String,
          enum: ['gold', 'silver', 'diamond', 'gemstone'],
          default: 'gold',
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
        finalWeight: {
          type: Number,
          default: 0,
        },
        wastage: {
          type: Number,
          default: 0,
        },
        jartiPercent: {
          type: Number,
          default: 0,
        },
        jartiAmount: {
          type: Number,
          default: 0,
        },
        payment: {
          type: Number,
          default: 0,
        },
        paymentDue: {
          type: Number,
          default: 0,
        },
        paymentReceived: {
          type: Number,
          default: 0,
        },
        paymentStatus: {
          type: String,
          enum: ['pending', 'partial', 'paid'],
          default: 'pending',
        },
        goldReceived: [
          {
            date: {
              type: Date,
              default: Date.now,
            },
            weight: {
              type: Number,
              required: true,
              min: 0,
            },
            karat: {
              type: Number,
              default: 24,
            },
            purity: {
              type: Number,
              default: 999,
            },
            value: {
              type: Number,
              default: 0,
            },
            note: {
              type: String,
              default: '',
            },
          },
        ],
        paymentHistory: [
          {
            date: {
              type: Date,
              default: Date.now,
            },
            amount: {
              type: Number,
              required: true,
              min: 0,
            },
            type: {
              type: String,
              enum: ['cash', 'gold', 'mixed'],
              default: 'cash',
            },
            goldWeight: {
              type: Number,
              default: 0,
            },
            goldKarat: {
              type: Number,
              default: 24,
            },
            goldPurity: {
              type: Number,
              default: 999,
            },
            goldValue: {
              type: Number,
              default: 0,
            },
            note: {
              type: String,
              default: '',
            },
          },
        ],
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
