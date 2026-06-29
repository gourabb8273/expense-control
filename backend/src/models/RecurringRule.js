const mongoose = require('mongoose');

const recurringRuleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['expense', 'investment'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    tag: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    expenseEssential: {
      type: String,
      enum: ['essential', 'nonessential'],
      required: false,
    },
    /** Day of month for generated entry (1–28). */
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 28,
      default: 1,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

recurringRuleSchema.index({ userId: 1, active: 1 });

const RecurringRule = mongoose.model('RecurringRule', recurringRuleSchema);

module.exports = RecurringRule;
