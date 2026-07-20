const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    tag: { type: String, trim: true, default: '' },
    platform: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const investmentPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    items: {
      type: [lineItemSchema],
      default: [],
    },
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
  },
  { timestamps: true }
);

investmentPlanSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const InvestmentPlan = mongoose.model('InvestmentPlan', investmentPlanSchema);

module.exports = InvestmentPlan;
