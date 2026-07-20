const express = require('express');
const mongoose = require('mongoose');
const InvestmentPlan = require('../models/InvestmentPlan');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

function cloneItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => ({
      name: String(i.name || '').trim(),
      amount: Math.max(0, Number(i.amount) || 0),
      tag: String(i.tag || '').trim(),
      platform: String(i.platform || '').trim(),
    }))
    .filter((i) => i.name);
}

function snapshotTotal(items) {
  return items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
}

function getPreviousMonth(year, month) {
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  return { year: prevYear, month: prevMonth };
}

/** Walk backward until a saved portfolio plan is found. */
async function resolveCarriedFromChain(userIdOid, year, month) {
  let y = year;
  let m = month;
  for (let step = 0; step < 120; step += 1) {
    const prev = getPreviousMonth(y, m);
    y = prev.year;
    m = prev.month;
    const doc = await InvestmentPlan.findOne({ userId: userIdOid, year: y, month: m }).lean();
    if (doc) {
      return {
        items: cloneItems(doc.items),
        notes: doc.notes || '',
        carriedFrom: { year: y, month: m },
      };
    }
  }
  return { items: [], notes: '', carriedFrom: null };
}

router.get('/', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const doc = await InvestmentPlan.findOne({ userId, year, month }).lean();

    if (!doc) {
      const carried = await resolveCarriedFromChain(userId, year, month);
      return res.json({
        year,
        month,
        items: carried.items,
        notes: carried.notes,
        carriedFrom: carried.carriedFrom,
        saved: false,
      });
    }

    return res.json({
      year: doc.year,
      month: doc.month,
      items: cloneItems(doc.items),
      notes: doc.notes || '',
      carriedFrom: null,
      saved: true,
      savedAt: doc.updatedAt || doc.createdAt,
    });
  } catch (err) {
    console.error('Get investment plan error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/previous', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const carried = await resolveCarriedFromChain(userId, year, month);

    return res.json({
      items: carried.items,
      notes: carried.notes,
      found: !!carried.carriedFrom,
      from: carried.carriedFrom,
    });
  } catch (err) {
    console.error('Get previous investment plan error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/year/:year', async (req, res) => {
  try {
    const y = parseInt(req.params.year, 10);
    if (!y) return res.status(400).json({ message: 'year is required' });

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const docs = await InvestmentPlan.find({
      userId,
      $or: [{ year: y }, { year: y - 1, month: 12 }],
    }).lean();

    const docMap = new Map();
    docs.forEach((d) => {
      docMap.set(`${d.year}-${d.month}`, d);
    });

    let effective = { items: [], notes: '' };
    const decKey = `${y - 1}-12`;
    if (docMap.has(decKey)) {
      const d = docMap.get(decKey);
      effective = {
        items: cloneItems(d.items),
        notes: d.notes || '',
      };
    }

    const byMonth = {};
    for (let month = 1; month <= 12; month += 1) {
      const key = `${y}-${month}`;
      const savedDoc = docMap.get(key);
      if (savedDoc) {
        effective = {
          items: cloneItems(savedDoc.items),
          notes: savedDoc.notes || '',
        };
      }
      const items = cloneItems(effective.items);
      byMonth[month] = {
        items,
        notes: effective.notes,
        total: snapshotTotal(items),
        saved: !!savedDoc,
        savedAt: savedDoc ? savedDoc.updatedAt || savedDoc.createdAt : null,
      };
    }

    return res.json({ year: y, byMonth });
  } catch (err) {
    console.error('Get investment plan year error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const { year, month, items, notes } = req.body;
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const itemsList = cloneItems(Array.isArray(items) ? items : []);
    const notesText = String(notes || '').trim().slice(0, 2000);

    if (itemsList.length === 0 && !notesText) {
      await InvestmentPlan.deleteOne({ userId, year, month });
      return res.json({
        year,
        month,
        items: [],
        notes: '',
        carriedFrom: null,
        saved: false,
      });
    }

    const doc = await InvestmentPlan.findOneAndUpdate(
      { userId, year, month },
      { items: itemsList, notes: notesText },
      { new: true, upsert: true }
    );

    return res.json({
      year: doc.year,
      month: doc.month,
      items: cloneItems(doc.items),
      notes: doc.notes || '',
      carriedFrom: null,
      saved: true,
      savedAt: doc.updatedAt || doc.createdAt,
    });
  } catch (err) {
    console.error('Put investment plan error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
