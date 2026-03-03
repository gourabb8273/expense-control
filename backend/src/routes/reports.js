const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10) - 1;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 1);
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const [summary] = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          totalExpense: {
            $sum: {
              $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
            },
          },
          totalInvestment: {
            $sum: {
              $cond: [{ $eq: ['$type', 'investment'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    const categories = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);

    return res.json({
      month,
      year,
      totalExpense: summary ? summary.totalExpense : 0,
      totalInvestment: summary ? summary.totalInvestment : 0,
      categories: categories.map((c) => ({
        category: c._id,
        total: c.total,
      })),
    });
  } catch (err) {
    console.error('Monthly report error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/yearly', async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ message: 'year is required' });
    }

    const y = parseInt(year, 10);
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const monthly = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
    ]);

    const byMonth = {};
    monthly.forEach((row) => {
      const monthKey = row._id.month;
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { expense: 0, investment: 0 };
      }
      byMonth[monthKey][row._id.type] = row.total;
    });

    const categoryAgg = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const monthlySeries = [];
    for (let m = 1; m <= 12; m += 1) {
      const row = byMonth[m] || { expense: 0, investment: 0 };
      monthlySeries.push({
        month: m,
        totalExpense: row.expense,
        totalInvestment: row.investment,
      });
    }

    return res.json({
      year,
      monthly: monthlySeries,
      categories: categoryAgg.map((c) => ({
        category: c._id,
        total: c.total,
      })),
    });
  } catch (err) {
    console.error('Yearly report error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

