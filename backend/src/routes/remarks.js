const express = require('express');
const mongoose = require('mongoose');
const Remark = require('../models/Remark');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

function parseYearMonth(year, month) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!y) return null;
  if (Number.isNaN(m) || m < 0 || m > 12) return null;
  return { y, m };
}

// GET /api/remarks?year=YYYY&month=MM  (month 0 = year-level)
router.get('/', async (req, res) => {
  try {
    const parsed = parseYearMonth(req.query.year, req.query.month ?? 0);
    if (!parsed) {
      return res.status(400).json({ message: 'year and month (0-12) are required' });
    }
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const row = await Remark.findOne({ userId, year: parsed.y, month: parsed.m });
    return res.json({
      year: parsed.y,
      month: parsed.m,
      text: row?.text || '',
    });
  } catch (err) {
    console.error('Get remark error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/remarks/year?year=YYYY -> year remark + all month remarks
router.get('/year', async (req, res) => {
  try {
    const y = parseInt(req.query.year, 10);
    if (!y) {
      return res.status(400).json({ message: 'year is required' });
    }
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const rows = await Remark.find({ userId, year: y }).lean();
    let yearText = '';
    const months = Array(12).fill('');
    rows.forEach((row) => {
      if (row.month === 0) yearText = row.text || '';
      else if (row.month >= 1 && row.month <= 12) months[row.month - 1] = row.text || '';
    });
    return res.json({ year: y, yearText, months });
  } catch (err) {
    console.error('Get year remarks error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/remarks  { year, month, text }
router.put('/', async (req, res) => {
  try {
    const { year, month, text } = req.body;
    const parsed = parseYearMonth(year, month ?? 0);
    if (!parsed) {
      return res.status(400).json({ message: 'Invalid year or month (0-12)' });
    }
    const bodyText = text == null ? '' : String(text).trim().slice(0, 5000);
    const userId = new mongoose.Types.ObjectId(req.user.id);

    if (!bodyText) {
      await Remark.deleteOne({ userId, year: parsed.y, month: parsed.m });
      return res.json({ year: parsed.y, month: parsed.m, text: '' });
    }

    const updated = await Remark.findOneAndUpdate(
      { userId, year: parsed.y, month: parsed.m },
      { text: bodyText },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({
      year: updated.year,
      month: updated.month,
      text: updated.text,
    });
  } catch (err) {
    console.error('Upsert remark error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
