const express = require('express');
const mongoose = require('mongoose');
const Cashflow = require('../models/Cashflow');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

function sanitizeInflows(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const kind = row.kind === 'salary' ? 'salary' : 'custom';
      const label = String(row.label || '').trim() || (kind === 'salary' ? 'Salary' : 'Other');
      return {
        label,
        amount: Math.max(0, Number(row.amount) || 0),
        kind,
      };
    })
    .filter((row) => row.kind === 'salary' || row.amount > 0 || row.label !== 'Other');
}

function resolveInflows(row, fallbackSalary = 0) {
  if (row) {
    const legacyAmount = Number(row.amount) || 0;
    if (row.inflows?.length) {
      const mapped = row.inflows.map((r) => ({
        label: r.label,
        amount: r.amount || 0,
        kind: r.kind === 'salary' ? 'salary' : 'custom',
      }));
      const inflowTotal = Cashflow.totalFromInflows(mapped);
      if (inflowTotal > 0) return mapped;
      if (legacyAmount > 0) {
        return [{ label: 'Salary', amount: legacyAmount, kind: 'salary' }];
      }
    } else if (legacyAmount > 0) {
      return [{ label: 'Salary', amount: legacyAmount, kind: 'salary' }];
    }
    if (fallbackSalary > 0) {
      return [{ label: 'Salary', amount: fallbackSalary, kind: 'salary' }];
    }
    return [{ label: 'Salary', amount: 0, kind: 'salary' }];
  }
  if (fallbackSalary > 0) {
    return [{ label: 'Salary', amount: fallbackSalary, kind: 'salary' }];
  }
  return [{ label: 'Salary', amount: 0, kind: 'salary' }];
}

async function getLastKnownSalary(userId, excludeYear, excludeMonth) {
  return Cashflow.getLastKnownSalary(userId, excludeYear, excludeMonth);
}

async function getDefaultSalary(userId) {
  const user = await User.findById(userId).select('defaultMonthlySalary');
  return user?.defaultMonthlySalary || 0;
}

function formatCashflowResponse(y, m, inflows, extra = {}) {
  const total = Cashflow.totalFromInflows(inflows);
  return { year: y, month: m, inflows, total, amount: total, ...extra };
}

// GET /api/cashflow?year=YYYY&month=MM -> single month with inflows
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
    const [row, defaultSalary, lastKnownSalary] = await Promise.all([
      Cashflow.findOne({ userId, year: y, month: m }),
      getDefaultSalary(userId),
      getLastKnownSalary(userId, y, m),
    ]);
    const fallbackSalary = defaultSalary || lastKnownSalary || 0;
    const inflows = resolveInflows(row, fallbackSalary);
    const hasSavedRecord = !!row;
    const savedTotal = row
      ? row.inflows?.length
        ? Cashflow.totalFromInflows(row.inflows)
        : Number(row.amount) || 0
      : 0;
    return res.json(
      formatCashflowResponse(y, m, inflows, {
        hasSavedRecord,
        savedTotal,
        lastKnownSalary,
        defaultMonthlySalary: defaultSalary,
      })
    );
  } catch (err) {
    console.error('Get cashflow error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/cashflow/year/breakdown?year=YYYY -> per-month inflows + year totals by source
router.get('/year/breakdown', async (req, res) => {
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
    const rowByMonth = new Map(rows.map((row) => [row.month, row]));

    const months = [];
    const sourceTotals = {};

    for (let m = 1; m <= 12; m += 1) {
      const row = rowByMonth.get(m);
      const inflows = row ? resolveInflows(row, 0) : [];
      const total = Cashflow.totalFromInflows(inflows);
      months.push({ month: m, inflows, total });
      inflows.forEach((inf) => {
        const key = inf.label || 'Other';
        sourceTotals[key] = (sourceTotals[key] || 0) + (Number(inf.amount) || 0);
      });
    }

    const bySource = Object.entries(sourceTotals)
      .map(([label, amount]) => ({ label, amount }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return res.json({ year: y, months, bySource });
  } catch (err) {
    console.error('Get yearly cashflow breakdown error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/cashflow/year?year=YYYY -> array of 12 totals
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
        const total =
          row.inflows?.length > 0
            ? Cashflow.totalFromInflows(row.inflows)
            : row.amount || 0;
        byMonth[row.month - 1] = total;
      }
    });
    return res.json({ year: y, months: byMonth });
  } catch (err) {
    console.error('Get yearly cashflow error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/cashflow  { year, month, inflows } or legacy { year, month, amount }
router.put('/', async (req, res) => {
  try {
    const { year, month, inflows, amount } = req.body;
    if (year == null || month == null) {
      return res.status(400).json({ message: 'year and month are required' });
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) {
      return res.status(400).json({ message: 'Invalid year or month' });
    }

    let normalizedInflows;
    if (Array.isArray(inflows)) {
      normalizedInflows = sanitizeInflows(inflows);
      if (normalizedInflows.length === 0) {
        normalizedInflows = [{ label: 'Salary', amount: 0, kind: 'salary' }];
      }
    } else if (amount != null) {
      const a = Number(amount);
      if (Number.isNaN(a) || a < 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      normalizedInflows = [{ label: 'Salary', amount: a, kind: 'salary' }];
    } else {
      return res
        .status(400)
        .json({ message: 'inflows or amount is required' });
    }

    const total = Cashflow.totalFromInflows(normalizedInflows);
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const updated = await Cashflow.findOneAndUpdate(
      { userId, year: y, month: m },
      { inflows: normalizedInflows, amount: total },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const resolved = resolveInflows(updated);
    return res.json(formatCashflowResponse(updated.year, updated.month, resolved));
  } catch (err) {
    console.error('Upsert cashflow error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
