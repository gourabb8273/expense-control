// Pure, read-only helpers for the new visual analytics and planning cards.
// Nothing here writes data; everything is derived from transactions / summaries the app already loads.
import { txCalendarDate, shiftMonth } from './insights';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// One fixed colour per category name, so "Food" looks the same in every chart.
const PALETTE = [
  '#818cf8', '#f97316', '#22c55e', '#06b6d4', '#ec4899', '#eab308',
  '#a855f7', '#14b8a6', '#f43f5e', '#84cc16', '#3b82f6', '#fb923c',
];
export function colorFor(name) {
  const s = String(name || 'Other').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export const TYPE_COLORS = { expense: '#f97316', investment: '#22c55e', inflow: '#818cf8', saved: '#06b6d4' };

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Day-of-month (1..31) for a transaction, using the same calendar-date rule as the rest of the app. */
export function txDay(tx) {
  return txCalendarDate(tx).getUTCDate();
}

/** Cumulative expense per day: array of length daysInMonth. */
export function cumulativeByDay(transactions, year, month, type = 'expense') {
  const n = daysInMonth(year, month);
  const daily = Array(n).fill(0);
  (transactions || []).forEach((tx) => {
    if (tx.type !== type) return;
    const d = txDay(tx);
    if (d >= 1 && d <= n) daily[d - 1] += Number(tx.amount) || 0;
  });
  let run = 0;
  return daily.map((v) => {
    run += v;
    return run;
  });
}

export function sumBy(transactions, type) {
  return (transactions || [])
    .filter((tx) => !type || tx.type === type)
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
}

export function totalsByKey(transactions, { type = 'expense', key = 'category' } = {}) {
  const map = new Map();
  (transactions || []).forEach((tx) => {
    if (type && tx.type !== type) return;
    const k = String(tx[key] || '').trim() || (key === 'tag' ? 'Untagged' : 'Other');
    map.set(k, (map.get(k) || 0) + (Number(tx.amount) || 0));
  });
  return map;
}

/** Sorted rows { name, value, prev, delta } comparing two transaction sets. */
export function compareCategories(current, previous, opts = {}) {
  const cur = totalsByKey(current, opts);
  const prev = totalsByKey(previous, opts);
  const names = new Set([...cur.keys(), ...prev.keys()]);
  return Array.from(names)
    .map((name) => {
      const value = cur.get(name) || 0;
      const p = prev.get(name) || 0;
      return { name, value, prev: p, delta: value - p };
    })
    .sort((a, b) => b.value - a.value || b.prev - a.prev);
}

/** Keep the top N rows and fold the rest into "Other". */
export function topWithOther(rows, n = 8, valueKey = 'value') {
  if (rows.length <= n) return rows;
  const head = rows.slice(0, n);
  const rest = rows.slice(n);
  const other = { name: `Other (${rest.length})`, isOther: true };
  Object.keys(rest[0]).forEach((k) => {
    if (typeof rest[0][k] === 'number') other[k] = rest.reduce((s, r) => s + (r[k] || 0), 0);
  });
  other[valueKey] = rest.reduce((s, r) => s + (r[valueKey] || 0), 0);
  return [...head, other];
}

/**
 * Safe to spend per day for the rest of the month.
 * left = inflow − expense − investment − still-pending recurring outflows.
 */
export function safeToSpend({ inflow, expense, investment, pendingRecurring = 0, year, month, today = new Date() }) {
  const n = daysInMonth(year, month);
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === month;
  const isPast = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1);
  const daysLeft = isCurrent ? n - today.getDate() + 1 : isPast ? 0 : n;
  const left = (Number(inflow) || 0) - (Number(expense) || 0) - (Number(investment) || 0) - pendingRecurring;
  return {
    left,
    daysLeft,
    perDay: daysLeft > 0 ? Math.max(0, left) / daysLeft : 0,
    isCurrent,
    isPast,
    dayOfMonth: isCurrent ? today.getDate() : isPast ? n : 0,
    daysInMonth: n,
  };
}

/** Same description/category + similar amount seen in ≥3 of the last months → likely subscription. */
export function detectSubscriptions(current, history, { minMonths = 3 } = {}) {
  const months = [current, ...(history || []).map((h) => h.transactions || [])];
  const seen = new Map();
  months.forEach((txs, idx) => {
    const inThisMonth = new Set();
    (txs || []).forEach((tx) => {
      if (tx.type !== 'expense') return;
      const label = String(tx.category || '').trim();
      if (!label) return;
      const amt = Math.round(Number(tx.amount) || 0);
      const key = `${label.toLowerCase()}|${amt}`;
      if (inThisMonth.has(key)) return;
      inThisMonth.add(key);
      if (!seen.has(key)) seen.set(key, { name: label, amount: amt, months: new Set(), lastDay: null, recurring: !!tx.recurringRuleId });
      const row = seen.get(key);
      row.months.add(idx);
      if (idx === 0 || row.lastDay == null) row.lastDay = txDay(tx);
      if (tx.recurringRuleId) row.recurring = true;
    });
  });
  return Array.from(seen.values())
    .filter((r) => r.months.size >= minMonths)
    .map((r) => ({ ...r, monthsSeen: r.months.size, yearly: r.amount * 12, activeThisMonth: r.months.has(0) }))
    .sort((a, b) => b.yearly - a.yearly);
}

/** Group transactions by calendar day, newest first: [{ key, date, total, items }]. */
export function groupByDay(transactions) {
  const map = new Map();
  (transactions || []).forEach((tx) => {
    const d = txCalendarDate(tx);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, { key, date: d, expense: 0, investment: 0, items: [] });
    const g = map.get(key);
    g.items.push(tx);
    g[tx.type === 'investment' ? 'investment' : 'expense'] += Number(tx.amount) || 0;
  });
  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}

export function dayLabel(date, today = new Date()) {
  const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const diff = Math.round((t - date) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Most-used categories over recent months, for quick-add chips. */
export function frequentCategories(transactionsLists, type = 'expense', limit = 8) {
  const map = new Map();
  transactionsLists.flat().forEach((tx) => {
    if (tx.type !== type || !tx.category) return;
    const k = tx.category.trim();
    const row = map.get(k) || { name: k, count: 0, tag: tx.tag || '', essential: tx.expenseEssential || '', lastAmount: tx.amount };
    row.count += 1;
    map.set(k, row);
  });
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Evaluate a simple calculator expression like "450+120*2" safely (digits and + - * / . only). */
export function evalAmount(expr) {
  const s = String(expr || '').replace(/[,\s₹]/g, '');
  if (!s) return NaN;
  if (!/^[\d.+\-*/()]+$/.test(s)) return NaN;
  // Shunting-yard
  const out = [];
  const ops = [];
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const tokens = s.match(/\d+\.?\d*|\.\d+|[+\-*/()]/g) || [];
  let prevWasOp = true;
  for (const t of tokens) {
    if (/^[\d.]/.test(t)) {
      out.push(parseFloat(t));
      prevWasOp = false;
    } else if (t === '(') {
      ops.push(t);
      prevWasOp = true;
    } else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
      ops.pop();
      prevWasOp = false;
    } else {
      if (prevWasOp && t === '-') out.push(0);
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop());
      ops.push(t);
      prevWasOp = true;
    }
  }
  while (ops.length) out.push(ops.pop());
  const st = [];
  for (const t of out) {
    if (typeof t === 'number') st.push(t);
    else {
      const b = st.pop();
      const a = st.pop();
      if (a == null || b == null) return NaN;
      st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : a / b);
    }
  }
  const v = st.length === 1 ? st[0] : NaN;
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
}

/** Local YYYY-MM-DD (fixes the UTC "yesterday" issue before 5:30 AM IST for new quick-add entries). */
export function localDateInput(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Next due date for a recurring rule relative to today. */
export function nextDueDate(rule, today = new Date()) {
  const day = Math.min(Math.max(Number(rule.dayOfMonth) || 1, 1), 28);
  let d = new Date(today.getFullYear(), today.getMonth(), day);
  if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    d = new Date(today.getFullYear(), today.getMonth() + 1, day);
  }
  return d;
}

export function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function transactionsToCsvRows(transactions) {
  const header = ['Date', 'Type', 'Category', 'Tag', 'Essential', 'Amount', 'Description', 'Recurring'];
  const rows = (transactions || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((tx) => [
      txCalendarDate(tx).toISOString().slice(0, 10),
      tx.type,
      tx.category,
      tx.tag || '',
      tx.expenseEssential || '',
      Number(tx.amount) || 0,
      tx.description || '',
      tx.recurringRuleId ? 'yes' : '',
    ]);
  return [header, ...rows];
}

export { shiftMonth };

/**
 * Recurring rules count as "already added" if this month has a matching entry added by hand:
 * same type and the same category (or the rule name / category appears in the entry's category or description).
 * The amount can differ (e.g. EMI rule ₹20k but you paid ₹30k). Read-only helper.
 */
export function splitPendingRecurring(pending, transactions) {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const txs = (transactions || []).filter((t) => !t.recurringRuleId);
  const covered = [];
  const still = [];
  (pending || []).forEach((p) => {
    const cat = norm(p.category);
    const name = norm(p.name);
    const match = txs.find((t) => {
      if (t.type !== p.type) return false;
      const tc = norm(t.category);
      const td = norm(t.description);
      return (cat && tc === cat) || (name && (tc === name || tc.includes(name) || td.includes(name))) || (cat && td.includes(cat));
    });
    if (match) covered.push({ ...p, matchedWith: match });
    else still.push(p);
  });
  return { pending: still, covered };
}
