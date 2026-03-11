const mongoose = require('mongoose');

const cashflowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

cashflowSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const Cashflow = mongoose.model('Cashflow', cashflowSchema);

module.exports = Cashflow;

