const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

function buildTitleTagPipelines({ userId, start, end, txType }) {
  const baseMatch = {
    userId,
    date: { $gte: start, $lt: end },
    type: txType,
  };

  const titleRegex = /^\s*([^-\n]+?)\s*-\s*([^-\n]+?)\s*$/;

  const withParsed = [
    { $match: baseMatch },
    {
      $addFields: {
        _titleMatch: { $regexFind: { input: '$category', regex: titleRegex } },
      },
    },
    { $match: { _titleMatch: { $ne: null } } },
    {
      $addFields: {
        _titleTag: { $trim: { input: { $arrayElemAt: ['$_titleMatch.captures', 0] } } },
        _titleType: { $trim: { input: { $arrayElemAt: ['$_titleMatch.captures', 1] } } },
      },
    },
    { $match: { _titleTag: { $ne: '' }, _titleType: { $ne: '' } } },
  ];

  const byTag = [
    ...withParsed,
    { $group: { _id: '$_titleTag', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
  ];

  const byTagAndType = [
    ...withParsed,
    {
      $group: {
        _id: { tag: '$_titleTag', type: '$_titleType' },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.tag': 1, total: -1 } },
  ];

  return { byTag, byTagAndType };
}

function reshapeTitleTagDetails(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const tag = r?._id?.tag;
    const type = r?._id?.type;
    const total = Number(r?.total || 0);
    if (!tag || !type || total <= 0) return;
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag).push({ label: type, total });
  });
  const out = Array.from(map.entries()).map(([tag, items]) => ({
    tag,
    total: items.reduce((s, x) => s + (x.total || 0), 0),
    types: items.sort((a, b) => (b.total || 0) - (a.total || 0)),
  }));
  out.sort((a, b) => (b.total || 0) - (a.total || 0));
  return out;
}

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
      { $sort: { total: -1 } },
    ]);

    const investmentCategories = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'investment',
        },
      },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const expenseCategories = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'expense',
        },
      },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const investmentByTag = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'investment',
          tag: { $exists: true, $ne: '' },
        },
      },
      { $group: { _id: '$tag', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const expenseByTag = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'expense',
          tag: { $exists: true, $ne: '' },
        },
      },
      { $group: { _id: '$tag', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const expenseTitlePipes = buildTitleTagPipelines({ userId, start, end, txType: 'expense' });
    const investmentTitlePipes = buildTitleTagPipelines({ userId, start, end, txType: 'investment' });

    const [expenseByTitleTag, expenseByTitleTagType, investmentByTitleTag, investmentByTitleTagType] =
      await Promise.all([
        Transaction.aggregate(expenseTitlePipes.byTag),
        Transaction.aggregate(expenseTitlePipes.byTagAndType),
        Transaction.aggregate(investmentTitlePipes.byTag),
        Transaction.aggregate(investmentTitlePipes.byTagAndType),
      ]);

    const [essentialRow] = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'expense',
        },
      },
      {
        $group: {
          _id: null,
          essentialExpense: {
            $sum: {
              $cond: [{ $eq: ['$expenseEssential', 'essential'] }, '$amount', 0],
            },
          },
          nonessentialExpense: {
            $sum: {
              $cond: [{ $eq: ['$expenseEssential', 'nonessential'] }, '$amount', 0],
            },
          },
          uncategorizedExpense: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$expenseEssential', 'essential'] },
                    { $ne: ['$expenseEssential', 'nonessential'] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
        },
      },
    ]);

    return res.json({
      month,
      year,
      totalExpense: summary ? summary.totalExpense : 0,
      totalInvestment: summary ? summary.totalInvestment : 0,
      essentialExpense: essentialRow ? essentialRow.essentialExpense : 0,
      nonessentialExpense: essentialRow ? essentialRow.nonessentialExpense : 0,
      uncategorizedExpense: essentialRow ? essentialRow.uncategorizedExpense : 0,
      categories: categories.map((c) => ({ category: c._id, total: c.total })),
      investmentCategories: investmentCategories.map((c) => ({ category: c._id, total: c.total })),
      expenseCategories: expenseCategories.map((c) => ({ category: c._id, total: c.total })),
      investmentByTag: investmentByTag.map((c) => ({ tag: c._id, total: c.total })),
      expenseByTag: expenseByTag.map((c) => ({ tag: c._id, total: c.total })),
      investmentByTitleTag: investmentByTitleTag.map((c) => ({ tag: c._id, total: c.total })),
      expenseByTitleTag: expenseByTitleTag.map((c) => ({ tag: c._id, total: c.total })),
      investmentTitleTagBreakdown: reshapeTitleTagDetails(investmentByTitleTagType),
      expenseTitleTagBreakdown: reshapeTitleTagDetails(expenseByTitleTagType),
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
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const investmentCategories = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'investment',
        },
      },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const expenseCategories = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'expense',
        },
      },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const investmentByTag = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'investment',
          tag: { $exists: true, $ne: '' },
        },
      },
      { $group: { _id: '$tag', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const expenseByTag = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'expense',
          tag: { $exists: true, $ne: '' },
        },
      },
      { $group: { _id: '$tag', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const expenseTitlePipes = buildTitleTagPipelines({ userId, start, end, txType: 'expense' });
    const investmentTitlePipes = buildTitleTagPipelines({ userId, start, end, txType: 'investment' });

    const [expenseByTitleTag, expenseByTitleTagType, investmentByTitleTag, investmentByTitleTagType] =
      await Promise.all([
        Transaction.aggregate(expenseTitlePipes.byTag),
        Transaction.aggregate(expenseTitlePipes.byTagAndType),
        Transaction.aggregate(investmentTitlePipes.byTag),
        Transaction.aggregate(investmentTitlePipes.byTagAndType),
      ]);

    const essentialByMonthRows = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: start, $lt: end },
          type: 'expense',
        },
      },
      {
        $group: {
          _id: { $month: '$date' },
          essentialExpense: {
            $sum: {
              $cond: [{ $eq: ['$expenseEssential', 'essential'] }, '$amount', 0],
            },
          },
          nonessentialExpense: {
            $sum: {
              $cond: [{ $eq: ['$expenseEssential', 'nonessential'] }, '$amount', 0],
            },
          },
          uncategorizedExpense: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$expenseEssential', 'essential'] },
                    { $ne: ['$expenseEssential', 'nonessential'] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
        },
      },
    ]);

    const essentialMap = {};
    essentialByMonthRows.forEach((r) => {
      essentialMap[r._id] = {
        essentialExpense: r.essentialExpense || 0,
        nonessentialExpense: r.nonessentialExpense || 0,
        uncategorizedExpense: r.uncategorizedExpense || 0,
      };
    });

    const monthlySeries = [];
    for (let m = 1; m <= 12; m += 1) {
      const row = byMonth[m] || { expense: 0, investment: 0 };
      const ess = essentialMap[m] || {
        essentialExpense: 0,
        nonessentialExpense: 0,
        uncategorizedExpense: 0,
      };
      monthlySeries.push({
        month: m,
        totalExpense: row.expense,
        totalInvestment: row.investment,
        essentialExpense: ess.essentialExpense,
        nonessentialExpense: ess.nonessentialExpense,
        uncategorizedExpense: ess.uncategorizedExpense,
      });
    }

    return res.json({
      year,
      monthly: monthlySeries,
      categories: categoryAgg.map((c) => ({ category: c._id, total: c.total })),
      investmentCategories: investmentCategories.map((c) => ({ category: c._id, total: c.total })),
      expenseCategories: expenseCategories.map((c) => ({ category: c._id, total: c.total })),
      investmentByTag: investmentByTag.map((c) => ({ tag: c._id, total: c.total })),
      expenseByTag: expenseByTag.map((c) => ({ tag: c._id, total: c.total })),
      investmentByTitleTag: investmentByTitleTag.map((c) => ({ tag: c._id, total: c.total })),
      expenseByTitleTag: expenseByTitleTag.map((c) => ({ tag: c._id, total: c.total })),
      investmentTitleTagBreakdown: reshapeTitleTagDetails(investmentByTitleTagType),
      expenseTitleTagBreakdown: reshapeTitleTagDetails(expenseByTitleTagType),
    });
  } catch (err) {
    console.error('Yearly report error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

