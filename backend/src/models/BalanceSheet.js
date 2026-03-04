const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const balanceSheetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    assets: {
      type: [lineItemSchema],
      default: [],
    },
    debts: {
      type: [lineItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

balanceSheetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const BalanceSheet = mongoose.model('BalanceSheet', balanceSheetSchema);

module.exports = BalanceSheet;
