const mongoose = require('mongoose');

const remarkSchema = new mongoose.Schema(
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
    /** 0 = year-level remark; 1–12 = month remark */
    month: {
      type: Number,
      required: true,
      min: 0,
      max: 12,
      index: true,
    },
    text: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
    },
  },
  { timestamps: true }
);

remarkSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const Remark = mongoose.model('Remark', remarkSchema);

module.exports = Remark;
