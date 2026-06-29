const express = require('express');
const RecurringRule = require('../models/RecurringRule');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

function normalizeExpenseEssential(type, raw) {
  if (type !== 'expense') return undefined;
  if (raw === 'essential' || raw === 'nonessential') return raw;
  return undefined;
}

function monthRange(year, month) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10) - 1;
  return {
    start: new Date(y, m, 1),
    end: new Date(y, m + 1, 1),
  };
}

function entryDateForRule(year, month, dayOfMonth) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10) - 1;
  const day = Math.min(Math.max(Number(dayOfMonth) || 1, 1), 28);
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, lastDay));
}

async function appliedRuleIds(userId, year, month) {
  const { start, end } = monthRange(year, month);
  const rows = await Transaction.find({
    userId,
    recurringRuleId: { $ne: null },
    date: { $gte: start, $lt: end },
  })
    .select('recurringRuleId')
    .lean();
  return new Set(rows.map((r) => String(r.recurringRuleId)));
}

function ruleToPreview(rule, year, month) {
  return {
    ruleId: rule._id,
    name: rule.name,
    type: rule.type,
    amount: rule.amount,
    category: rule.category,
    tag: rule.tag || '',
    description: rule.description || '',
    expenseEssential: rule.expenseEssential,
    dayOfMonth: rule.dayOfMonth || 1,
    date: entryDateForRule(year, month, rule.dayOfMonth),
  };
}

router.get('/', async (req, res) => {
  try {
    const rules = await RecurringRule.find({ userId: req.user.id }).sort({ name: 1 });
    return res.json({ rules });
  } catch (err) {
    console.error('List recurring rules error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }

    const rules = await RecurringRule.find({ userId: req.user.id, active: true }).sort({ name: 1 });
    const applied = await appliedRuleIds(req.user.id, year, month);
    const pending = rules
      .filter((r) => !applied.has(String(r._id)))
      .map((r) => ruleToPreview(r, year, month));

    return res.json({ year, month, pending, totalActive: rules.length });
  } catch (err) {
    console.error('Pending recurring error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      type,
      amount,
      category,
      tag,
      description,
      expenseEssential,
      dayOfMonth,
      active,
    } = req.body;

    if (!name || !type || amount == null || !category) {
      return res.status(400).json({ message: 'name, type, amount, and category are required' });
    }

    const rule = await RecurringRule.create({
      userId: req.user.id,
      name: String(name).trim(),
      type,
      amount: Number(amount) || 0,
      category: String(category).trim(),
      tag: tag ? String(tag).trim() : '',
      description: description || '',
      expenseEssential: normalizeExpenseEssential(type, expenseEssential),
      dayOfMonth: Math.min(Math.max(Number(dayOfMonth) || 1, 1), 28),
      active: active !== false,
    });

    return res.status(201).json({ rule });
  } catch (err) {
    console.error('Create recurring rule error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      amount,
      category,
      tag,
      description,
      expenseEssential,
      dayOfMonth,
      active,
    } = req.body;

    const existing = await RecurringRule.findOne({ _id: id, userId: req.user.id });
    if (!existing) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    const nextType = type || existing.type;
    const update = {};
    if (name != null) update.name = String(name).trim();
    if (type != null) update.type = type;
    if (amount != null) update.amount = Number(amount) || 0;
    if (category != null) update.category = String(category).trim();
    if (tag != null) update.tag = String(tag).trim();
    if (description != null) update.description = description;
    if (dayOfMonth != null) {
      update.dayOfMonth = Math.min(Math.max(Number(dayOfMonth) || 1, 1), 28);
    }
    if (active != null) update.active = !!active;

    if (expenseEssential !== undefined) {
      const ess = normalizeExpenseEssential(nextType, expenseEssential);
      if (ess) update.expenseEssential = ess;
    }

    const unset = {};
    if (nextType === 'investment') {
      unset.expenseEssential = '';
    } else if (expenseEssential !== undefined && !normalizeExpenseEssential(nextType, expenseEssential)) {
      unset.expenseEssential = '';
    }

    const op = { $set: update };
    if (Object.keys(unset).length) op.$unset = unset;

    const rule = await RecurringRule.findOneAndUpdate({ _id: id, userId: req.user.id }, op, {
      new: true,
    });

    return res.json({ rule });
  } catch (err) {
    console.error('Update recurring rule error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const rule = await RecurringRule.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!rule) {
      return res.status(404).json({ message: 'Rule not found' });
    }
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete recurring rule error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/apply', async (req, res) => {
  try {
    const year = parseInt(req.body.year, 10);
    const month = parseInt(req.body.month, 10);
    const dryRun = !!req.body.dryRun;
    const ruleIds = Array.isArray(req.body.ruleIds) ? req.body.ruleIds.map(String) : null;

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }

    let rules = await RecurringRule.find({ userId: req.user.id, active: true }).sort({ name: 1 });
    if (ruleIds?.length) {
      rules = rules.filter((r) => ruleIds.includes(String(r._id)));
    }

    const applied = await appliedRuleIds(req.user.id, year, month);
    const toApply = rules.filter((r) => !applied.has(String(r._id)));

    if (dryRun) {
      return res.json({
        year,
        month,
        created: toApply.map((r) => ruleToPreview(r, year, month)),
        skipped: rules.filter((r) => applied.has(String(r._id))).map((r) => ({
          ruleId: r._id,
          name: r.name,
          reason: 'already_applied',
        })),
      });
    }

    const created = [];
    const skipped = [];

    for (const rule of rules) {
      if (applied.has(String(rule._id))) {
        skipped.push({ ruleId: rule._id, name: rule.name, reason: 'already_applied' });
        continue;
      }

      const date = entryDateForRule(year, month, rule.dayOfMonth);
      const tx = await Transaction.create({
        userId: req.user.id,
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        tag: rule.tag || '',
        description: rule.description || '',
        date,
        expenseEssential: normalizeExpenseEssential(rule.type, rule.expenseEssential),
        recurringRuleId: rule._id,
      });
      created.push({ ruleId: rule._id, name: rule.name, transaction: tx });
    }

    return res.json({ year, month, created, skipped });
  } catch (err) {
    console.error('Apply recurring rules error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/** Copy all transactions from previous calendar month into target month (new rows, no recurring link). */
router.post('/copy-from-previous', async (req, res) => {
  try {
    const year = parseInt(req.body.year, 10);
    const month = parseInt(req.body.month, 10);
    const dryRun = !!req.body.dryRun;

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'year and month are required (month 1-12)' });
    }

    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const { start: prevStart, end: prevEnd } = monthRange(prevYear, prevMonth);
    const { start: curStart, end: curEnd } = monthRange(year, month);

    const prevTxs = await Transaction.find({
      userId: req.user.id,
      date: { $gte: prevStart, $lt: prevEnd },
    }).lean();

    if (prevTxs.length === 0) {
      return res.json({ year, month, created: [], message: 'No entries in previous month' });
    }

    const previews = prevTxs.map((tx) => {
      const day = Math.min(new Date(tx.date).getDate(), 28);
      const lastDay = new Date(year, month, 0).getDate();
      const date = new Date(year, month - 1, Math.min(day, lastDay));
      return {
        sourceId: tx._id,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        tag: tx.tag || '',
        description: tx.description || '',
        expenseEssential: tx.expenseEssential,
        date,
      };
    });

    if (dryRun) {
      return res.json({ year, month, previews, count: previews.length });
    }

    const created = [];
    for (const p of previews) {
      const tx = await Transaction.create({
        userId: req.user.id,
        type: p.type,
        amount: p.amount,
        category: p.category,
        tag: p.tag,
        description: p.description,
        date: p.date,
        expenseEssential: p.expenseEssential,
      });
      created.push(tx);
    }

    return res.json({ year, month, created, count: created.length });
  } catch (err) {
    console.error('Copy from previous month error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
