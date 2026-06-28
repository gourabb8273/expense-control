const mongoose = require('mongoose');

const inflowSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    kind: { type: String, enum: ['salary', 'custom'], default: 'custom' },
  },
  { _id: false }
);

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
    inflows: {
      type: [inflowSchema],
      default: [],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

cashflowSchema.statics.totalFromInflows = function totalFromInflows(inflows) {
  return (inflows || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
};

cashflowSchema.statics.getLastKnownSalary = async function getLastKnownSalary(
  userId,
  excludeYear,
  excludeMonth
) {
  const rows = await this.find({ userId })
    .sort({ year: -1, month: -1 })
    .limit(24);
  for (const row of rows) {
    if (row.year === excludeYear && row.month === excludeMonth) continue;
    if (row.inflows?.length) {
      const salaryRow = row.inflows.find((r) => r.kind === 'salary' && r.amount > 0);
      if (salaryRow) return salaryRow.amount;
      const total = this.totalFromInflows(row.inflows);
      if (total > 0) return total;
    }
    if (row.amount > 0) return row.amount;
  }
  return 0;
};

cashflowSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const Cashflow = mongoose.model('Cashflow', cashflowSchema);

module.exports = Cashflow;

