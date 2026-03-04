const express = require('express');
const mongoose = require('mongoose');
const BalanceSheet = require('../models/BalanceSheet');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

function getPreviousMonth(year, month) {
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  return { year: prevYear, month: prevMonth };
}

router.get('/', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);

    let doc = await BalanceSheet.findOne({ userId, year, month });

    if (!doc) {
      const { year: prevYear, month: prevMonth } = getPreviousMonth(year, month);
      const prev = await BalanceSheet.findOne({ userId, year: prevYear, month: prevMonth });
      return res.json({
        year,
        month,
        assets: prev ? prev.assets : [],
        debts: prev ? prev.debts : [],
        carriedFrom: prev ? { year: prevYear, month: prevMonth } : null,
        saved: false,
      });
    }

    return res.json({
      year: doc.year,
      month: doc.month,
      assets: doc.assets,
      debts: doc.debts,
      carriedFrom: null,
      saved: true,
    });
  } catch (err) {
    console.error('Get balance sheet error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/year/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (!year) return res.status(400).json({ message: 'year is required' });

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const docs = await BalanceSheet.find({ userId, year }).sort({ month: 1 });

    const byMonth = {};
    for (let m = 1; m <= 12; m++) {
      const doc = docs.find((d) => d.month === m);
      const totalAssets = doc ? doc.assets.reduce((s, i) => s + i.value, 0) : 0;
      const totalDebts = doc ? doc.debts.reduce((s, i) => s + i.value, 0) : 0;
      byMonth[m] = {
        totalAssets,
        totalDebts,
        netWorth: totalAssets - totalDebts,
        assets: doc ? doc.assets : [],
        debts: doc ? doc.debts : [],
      };
    }

    return res.json({ year, byMonth });
  } catch (err) {
    console.error('Get balance sheet year error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const { year, month, assets, debts } = req.body;
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }
    const assetsList = Array.isArray(assets) ? assets : [];
    const debtsList = Array.isArray(debts) ? debts : [];

    const userId = req.user.id;
    const doc = await BalanceSheet.findOneAndUpdate(
      { userId, year, month },
      {
        assets: assetsList.map((a) => ({ name: String(a.name || '').trim(), value: Number(a.value) || 0 })).filter((a) => a.name),
        debts: debtsList.map((d) => ({ name: String(d.name || '').trim(), value: Number(d.value) || 0 })).filter((d) => d.name),
      },
      { new: true, upsert: true }
    );

    return res.json({
      year: doc.year,
      month: doc.month,
      assets: doc.assets,
      debts: doc.debts,
      saved: true,
    });
  } catch (err) {
    console.error('Put balance sheet error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
