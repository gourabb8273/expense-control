const mongoose = require('mongoose');

const staticCategorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['investment', 'expense'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

staticCategorySchema.index({ userId: 1, type: 1 });

const StaticCategory = mongoose.model('StaticCategory', staticCategorySchema);

module.exports = StaticCategory;
