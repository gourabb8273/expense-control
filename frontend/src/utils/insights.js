// Pure helpers for month insights, unusual-spend alerts and the spending calendar.

export const MONTH_SHORT = Array.from({ length: 12 }).map((_, i) =>
  new Date(2000, i, 1).toLocaleString('default', { month: 'short' })
);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calendar date of a transaction. Dates are stored as midnight (UTC from the form,
 * server-local from recurring rules), so snap to the nearest UTC day boundary.
 */
export function txCalendarDate(tx) {
  const ms = new Date(tx.date).getTime();
  return new Date(Math.round(ms / DAY_MS) * DAY_MS);
}

export function shiftMonth(year, month, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function categoryTotals(transactions, type = 'expense') {
  const map = new Map();
  (transactions || []).forEach((tx) => {
    if (tx.type !== type) return;
    const key = (tx.category || 'Other').trim() || 'Other';
    map.set(key, (map.get(key) || 0) + (Number(tx.amount) || 0));
  });
  return map;
}

export function sumByType(transactions, type) {
  return (transactions || [])
    .filter((tx) => tx.type === type)
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
}

/** Expense categories that moved the most vs the previous month. */
export function categoryChanges(current, previous, { minDelta = 500, limit = 4 } = {}) {
  const cur = categoryTotals(current);
  const prev = categoryTotals(previous);
  const keys = new Set([...cur.keys(), ...prev.keys()]);
  const rows = [];
  keys.forEach((category) => {
    const now = cur.get(category) || 0;
    const before = prev.get(category) || 0;
    const delta = now - before;
    if (Math.abs(delta) < minDelta) return;
    rows.push({
      category,
      now,
      before,
      delta,
      pct: before > 0 ? Math.round((delta / before) * 100) : null,
    });
  });
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return rows.slice(0, limit);
}

export function savingsRate(inflow, expense) {
  if (!inflow || inflow <= 0) return null;
  return Math.round(((inflow - expense) / inflow) * 1000) / 10;
}

/**
 * End-of-month expense projection. Recurring entries are treated as fixed (not extrapolated);
 * everything else is projected at the average daily pace so far.
 * Returns null unless the month is the current calendar month.
 */
export function projectMonthExpense(transactions, year, month, now = new Date()) {
  if (now.getFullYear() !== year || now.getMonth() + 1 !== month) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysElapsed = now.getDate();
  let fixed = 0;
  let variable = 0;
  (transactions || []).forEach((tx) => {
    if (tx.type !== 'expense') return;
    const amount = Number(tx.amount) || 0;
    if (tx.recurringRuleId) fixed += amount;
    else variable += amount;
  });
  const spentSoFar = fixed + variable;
  const projected = fixed + (variable / daysElapsed) * daysInMonth;
  return {
    spentSoFar,
    projected: Math.round(projected),
    daysElapsed,
    daysInMonth,
  };
}

/**
 * Categories where this month's spend is well above the average of previous months.
 * historyMonths: array of transaction arrays for earlier months (any order).
 */
export function unusualSpend(current, historyMonths, { factor = 2, minExcess = 1000, minHistory = 2, limit = 2 } = {}) {
  const monthsWithData = (historyMonths || []).filter((list) =>
    (list || []).some((tx) => tx.type === 'expense')
  );
  if (monthsWithData.length < minHistory) return [];
  const sums = new Map();
  monthsWithData.forEach((list) => {
    categoryTotals(list).forEach((amount, category) => {
      sums.set(category, (sums.get(category) || 0) + amount);
    });
  });
  const rows = [];
  categoryTotals(current).forEach((now, category) => {
    const avg = (sums.get(category) || 0) / monthsWithData.length;
    if (avg <= 0) return;
    if (now >= avg * factor && now - avg >= minExcess) {
      rows.push({ category, now, avg, ratio: now / avg });
    }
  });
  rows.sort((a, b) => b.ratio - a.ratio);
  return rows.slice(0, limit);
}

/** Map of day-of-month -> { expense, investment, count } for one month. */
export function dailyTotals(transactions) {
  const map = new Map();
  (transactions || []).forEach((tx) => {
    const day = txCalendarDate(tx).getUTCDate();
    const row = map.get(day) || { expense: 0, investment: 0, count: 0 };
    row[tx.type] = (row[tx.type] || 0) + (Number(tx.amount) || 0);
    row.count += 1;
    map.set(day, row);
  });
  return map;
}
