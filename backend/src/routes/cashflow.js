const express = require('express');
const mongoose = require('mongoose');
const Cashflow = require('../models/Cashflow');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/cashflow?year=YYYY&month=MM -> single month
router.get('/', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) {
      return res.status(400).json({ message: 'Invalid year or month' });
    }
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const row = await Cashflow.findOne({ userId, year: y, month: m });
    return res.json({
      year: y,
      month: m,
      amount: row ? row.amount : 0,
    });
  } catch (err) {
    console.error('Get cashflow error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/cashflow/year?year=YYYY -> array of 12 numbers
router.get('/year', async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ message: 'year is required' });
    }
    const y = parseInt(year, 10);
    if (!y) {
      return res.status(400).json({ message: 'Invalid year' });
    }
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const rows = await Cashflow.find({ userId, year: y });
    const byMonth = Array(12).fill(0);
    rows.forEach((row) => {
      if (row.month >= 1 && row.month <= 12) {
        byMonth[row.month - 1] = row.amount || 0;
      }
    });
    return res.json({ year: y, months: byMonth });
  } catch (err) {
    console.error('Get yearly cashflow error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/cashflow  { year, month, amount }
router.put('/', async (req, res) => {
  try {
    const { year, month, amount } = req.body;
    if (year == null || month == null || amount == null) {
      return res
        .status(400)
        .json({ message: 'year, month and amount are required' });
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const a = Number(amount);
    if (!y || !m || m < 1 || m > 12 || Number.isNaN(a) || a < 0) {
      return res.status(400).json({ message: 'Invalid year, month or amount' });
    }
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const updated = await Cashflow.findOneAndUpdate(
      { userId, year: y, month: m },
      { amount: a },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({
      year: updated.year,
      month: updated.month,
      amount: updated.amount,
    });
  } catch (err) {
    console.error('Upsert cashflow error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

