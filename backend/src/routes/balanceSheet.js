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

function cloneLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((i) => ({
      name: String(i.name || '').trim(),
      value: Math.max(0, Number(i.value) || 0),
    }))
    .filter((i) => i.name);
}

function snapshotTotals(assets, debts) {
  const totalAssets = assets.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const totalDebts = debts.reduce((s, i) => s + (Number(i.value) || 0), 0);
  return { totalAssets, totalDebts, netWorth: totalAssets - totalDebts };
}

/** Walk backward until a saved month is found (fixes gaps when intermediate months were never saved). */
async function resolveCarriedFromChain(userIdOid, year, month) {
  let y = year;
  let m = month;
  for (let step = 0; step < 120; step += 1) {
    const prev = getPreviousMonth(y, m);
    y = prev.year;
    m = prev.month;
    const doc = await BalanceSheet.findOne({ userId: userIdOid, year: y, month: m }).lean();
    if (doc) {
      const assets = cloneLines(doc.assets);
      const debts = cloneLines(doc.debts);
      return {
        assets,
        debts,
        carriedFrom: { year: y, month: m },
      };
    }
  }
  return { assets: [], debts: [], carriedFrom: null };
}

router.get('/', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);

    const doc = await BalanceSheet.findOne({ userId, year, month }).lean();

    if (!doc) {
      const carried = await resolveCarriedFromChain(userId, year, month);
      return res.json({
        year,
        month,
        assets: carried.assets,
        debts: carried.debts,
        carriedFrom: carried.carriedFrom,
        saved: false,
      });
    }

    return res.json({
      year: doc.year,
      month: doc.month,
      assets: cloneLines(doc.assets),
      debts: cloneLines(doc.debts),
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
    const y = parseInt(req.params.year, 10);
    if (!y) return res.status(400).json({ message: 'year is required' });

    const userId = new mongoose.Types.ObjectId(req.user.id);

    const docs = await BalanceSheet.find({
      userId,
      $or: [{ year: y }, { year: y - 1, month: 12 }],
    }).lean();

    const docMap = new Map();
    docs.forEach((d) => {
      docMap.set(`${d.year}-${d.month}`, d);
    });

    let effective = { assets: [], debts: [] };
    const decKey = `${y - 1}-12`;
    if (docMap.has(decKey)) {
      const d = docMap.get(decKey);
      effective = {
        assets: cloneLines(d.assets),
        debts: cloneLines(d.debts),
      };
    }

    const byMonth = {};
    for (let month = 1; month <= 12; month += 1) {
      const key = `${y}-${month}`;
      const savedDoc = docMap.get(key);
      if (savedDoc) {
        effective = {
          assets: cloneLines(savedDoc.assets),
          debts: cloneLines(savedDoc.debts),
        };
      }
      const assets = cloneLines(effective.assets);
      const debts = cloneLines(effective.debts);
      const { totalAssets, totalDebts, netWorth } = snapshotTotals(assets, debts);
      byMonth[month] = {
        totalAssets,
        totalDebts,
        netWorth,
        assets,
        debts,
        saved: !!savedDoc,
      };
    }

    return res.json({ year: y, byMonth });
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

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const doc = await BalanceSheet.findOneAndUpdate(
      { userId, year, month },
      {
        assets: assetsList
          .map((a) => ({ name: String(a.name || '').trim(), value: Number(a.value) || 0 }))
          .filter((a) => a.name),
        debts: debtsList
          .map((d) => ({ name: String(d.name || '').trim(), value: Number(d.value) || 0 }))
          .filter((d) => d.name),
      },
      { new: true, upsert: true }
    );

    return res.json({
      year: doc.year,
      month: doc.month,
      assets: cloneLines(doc.assets),
      debts: cloneLines(doc.debts),
      saved: true,
    });
  } catch (err) {
    console.error('Put balance sheet error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
