const express = require('express');
const mongoose = require('mongoose');
const Cashflow = require('../models/Cashflow');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function normalizeKind(rawKind) {
  if (rawKind === 'salary') return 'salary';
  if (rawKind === 'carryforward') return 'carryforward';
  return 'custom';
}

function defaultLabelForKind(kind) {
  if (kind === 'salary') return 'Salary';
  if (kind === 'carryforward') return 'Carried from previous month';
  return 'Other';
}

function sanitizeInflows(raw) {
  if (!Array.isArray(raw)) return [];
  let carryForwardSeen = false;
  return raw
    .map((row) => {
      const kind = normalizeKind(row.kind);
      if (kind === 'carryforward' && carryForwardSeen) return null;
      if (kind === 'carryforward') carryForwardSeen = true;
      const label =
        String(row.label || '').trim() || defaultLabelForKind(kind);
      return {
        label,
        amount: Math.max(0, Number(row.amount) || 0),
        kind,
      };
    })
    .filter(
      (row) =>
        row &&
        (row.kind === 'salary' ||
          row.kind === 'carryforward' ||
          row.amount > 0 ||
          row.label !== 'Other')
    );
}

function orderInflows(inflows) {
  const salary = inflows.filter((r) => r.kind === 'salary');
  const carry = inflows.filter((r) => r.kind === 'carryforward');
  const custom = inflows.filter((r) => r.kind !== 'salary' && r.kind !== 'carryforward');
  const salaryRow = salary[0] || { label: 'Salary', amount: 0, kind: 'salary' };
  return [salaryRow, ...carry, ...custom];
}

async function getMonthRemaining(userId, year, month) {
  let row = await Cashflow.findOne({ userId, year, month });
  row = await maybeMigrateLegacyCashflow(row, year, month);
  const inflows = row ? resolveInflows(row) : [{ label: 'Salary', amount: 0, kind: 'salary' }];
  const inflowTotal = Cashflow.totalFromInflows(inflows);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const transactions = await Transaction.find({
    userId,
    date: { $gte: start, $lt: end },
  });
  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const investment = transactions
    .filter((t) => t.type === 'investment')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  return {
    inflowTotal,
    expense,
    investment,
    remaining: inflowTotal - expense - investment,
  };
}

function resolveInflows(row) {
  if (!row) {
    return [{ label: 'Salary', amount: 0, kind: 'salary' }];
  }

  const legacyAmount = Number(row.amount) || 0;
  const storedInflows = Array.isArray(row.inflows) ? row.inflows : [];
  const hasNonSalaryInflows = storedInflows.some(
    (r) =>
      r.kind === 'carryforward' ||
      (r.kind !== 'salary' && Number(r.amount) > 0)
  );

  if (storedInflows.length > 0) {
    const mapped = orderInflows(
      storedInflows.map((r) => ({
        label: r.label,
        amount: r.amount || 0,
        kind: normalizeKind(r.kind),
      }))
    );
    const salaryRow = mapped.find((r) => r.kind === 'salary');
    const salaryAmount = Number(salaryRow?.amount) || 0;
    const inflowTotal = Cashflow.totalFromInflows(mapped);

    // Legacy rows: amount holds salary while inflows array is empty or salary-only zero
    if (legacyAmount > 0 && !hasNonSalaryInflows && (inflowTotal === 0 || salaryAmount === 0)) {
      return [{ label: 'Salary', amount: legacyAmount, kind: 'salary' }];
    }

    return mapped;
  }

  if (legacyAmount > 0) {
    return [{ label: 'Salary', amount: legacyAmount, kind: 'salary' }];
  }
  return [{ label: 'Salary', amount: 0, kind: 'salary' }];
}

function isFutureMonth(year, month) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year > currentYear) return true;
  if (year === currentYear && month > currentMonth) return true;
  return false;
}

async function maybeMigrateLegacyCashflow(row, year, month) {
  if (!row || isFutureMonth(year, month)) return row;

  const legacyAmount = Number(row.amount) || 0;
  if (legacyAmount <= 0) return row;

  const storedInflows = Array.isArray(row.inflows) ? row.inflows : [];
  const hasNonSalaryInflows = storedInflows.some(
    (r) =>
      r.kind === 'carryforward' ||
      (r.kind !== 'salary' && Number(r.amount) > 0)
  );
  if (hasNonSalaryInflows) return row;

  const resolved = resolveInflows(row);
  const salaryAmount = Number(resolved.find((r) => r.kind === 'salary')?.amount) || 0;
  if (salaryAmount > 0 && row.explicitInflow === true) return row;

  const migrated = [{ label: 'Salary', amount: legacyAmount, kind: 'salary' }];
  return Cashflow.findByIdAndUpdate(
    row._id,
    {
      inflows: migrated,
      amount: legacyAmount,
      explicitInflow: true,
    },
    { new: true }
  );
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
    let row = await Cashflow.findOne({ userId, year: y, month: m });
    row = await maybeMigrateLegacyCashflow(row, y, m);
    const [defaultSalary, lastKnownSalary] = await Promise.all([
      getDefaultSalary(userId),
      getLastKnownSalary(userId, y, m),
    ]);
    const inflows = resolveInflows(row);
    const hasSavedRecord = !!row;
    const savedTotal = row ? Cashflow.totalFromInflows(resolveInflows(row)) : 0;

    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevStats = await getMonthRemaining(userId, prevYear, prevMonth);
    const availableCarryForward = Math.max(0, prevStats.remaining);
    const carryForwardRow = inflows.find((r) => r.kind === 'carryforward');

    return res.json(
      formatCashflowResponse(y, m, inflows, {
        hasSavedRecord,
        savedTotal,
        lastKnownSalary,
        defaultMonthlySalary: defaultSalary,
        carryForward: {
          available: availableCarryForward,
          prevYear,
          prevMonth,
          prevMonthLabel: MONTH_NAMES[prevMonth],
          included: !!carryForwardRow,
          amount: carryForwardRow ? carryForwardRow.amount : availableCarryForward,
        },
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
      let row = rowByMonth.get(m);
      row = row ? await maybeMigrateLegacyCashflow(row, y, m) : null;
      const inflows = row ? resolveInflows(row) : [];
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
    for (const row of rows) {
      if (row.month >= 1 && row.month <= 12) {
        const migrated = await maybeMigrateLegacyCashflow(row, row.year, row.month);
        const inflows = resolveInflows(migrated);
        byMonth[row.month - 1] = Cashflow.totalFromInflows(inflows);
      }
    }
    return res.json({ year: y, months: byMonth });
  } catch (err) {
    console.error('Get yearly cashflow error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/cashflow  { year, month, inflows } or legacy { year, month, amount }
router.put('/', async (req, res) => {
  try {
    const { year, month, inflows, amount, explicitInflow } = req.body;
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

    const orderedInflows = orderInflows(normalizedInflows);
    const total = Cashflow.totalFromInflows(orderedInflows);
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const updatePayload = {
      inflows: orderedInflows,
      amount: total,
      explicitInflow: true,
    };

    const updated = await Cashflow.findOneAndUpdate(
      { userId, year: y, month: m },
      updatePayload,
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
