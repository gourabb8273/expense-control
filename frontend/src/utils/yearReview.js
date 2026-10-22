import { MONTH_SHORT, txCalendarDate } from './insights';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pctChange(now, before) {
  if (!before || before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

/**
 * Year-in-review stats from a year's transactions (all months), monthly inflow totals,
 * the previous year's totals and net worth start/end. Pure; no API access.
 */
export function buildYearReview({
  year,
  transactions,
  inflowByMonth,
  prevYear,
  netWorthStart,
  netWorthEnd,
  now = new Date(),
}) {
  const txs = transactions || [];
  const expenses = txs.filter((t) => t.type === 'expense');
  const investments = txs.filter((t) => t.type === 'investment');
  const sum = (list) => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const totalInflow = (inflowByMonth || []).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalExpense = sum(expenses);
  const totalInvestment = sum(investments);
  const savingsRate =
    totalInflow > 0 ? Math.round(((totalInflow - totalExpense) / totalInflow) * 1000) / 10 : null;

  const byCategory = (list) => {
    const map = new Map();
    list.forEach((t) => {
      const key = (t.category || 'Other').trim() || 'Other';
      const row = map.get(key) || { category: key, total: 0, count: 0 };
      row.total += Number(t.amount) || 0;
      row.count += 1;
      map.set(key, row);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  };
  const expenseCats = byCategory(expenses);
  const investmentCats = byCategory(investments);
  const goTo = [...expenseCats].sort((a, b) => b.count - a.count)[0] || null;

  // Months that have happened (all 12 for past years)
  const isCurrentYear = now.getFullYear() === year;
  const lastMonth = isCurrentYear ? now.getMonth() + 1 : 12;
  const monthExpense = Array(12).fill(0);
  const dayExpense = new Map(); // 'm-d' -> amount
  const weekdayExpense = Array(7).fill(0);
  expenses.forEach((t) => {
    const d = txCalendarDate(t);
    const amount = Number(t.amount) || 0;
    monthExpense[d.getUTCMonth()] += amount;
    weekdayExpense[d.getUTCDay()] += amount;
    const key = `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    dayExpense.set(key, (dayExpense.get(key) || 0) + amount);
  });
  const activeMonths = monthExpense
    .map((total, i) => ({ month: i + 1, label: MONTH_SHORT[i], total }))
    .filter((m) => m.month <= lastMonth && m.total > 0);
  const biggestMonth = activeMonths.reduce((a, b) => (!a || b.total > a.total ? b : a), null);
  const lightestMonth = activeMonths.length > 1
    ? activeMonths.reduce((a, b) => (!a || b.total < a.total ? b : a), null)
    : null;

  const biggestExpense = expenses.reduce(
    (a, b) => (!a || (Number(b.amount) || 0) > (Number(a.amount) || 0) ? b : a),
    null
  );

  const weekdayMax = Math.max(...weekdayExpense);
  const busiestWeekday = weekdayMax > 0 ? WEEKDAY_NAMES[weekdayExpense.indexOf(weekdayMax)] : null;

  // No-spend days and longest streak, from Jan 1 to today (or Dec 31)
  const end = isCurrentYear ? new Date(year, now.getMonth(), now.getDate()) : new Date(year, 11, 31);
  let daysElapsed = 0;
  let noSpendDays = 0;
  let streak = 0;
  let longestStreak = 0;
  for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) {
    daysElapsed += 1;
    if (dayExpense.has(`${d.getMonth() + 1}-${d.getDate()}`)) {
      streak = 0;
    } else {
      noSpendDays += 1;
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
    }
  }

  return {
    year,
    isCurrentYear,
    entries: txs.length,
    totalInflow,
    totalExpense,
    totalInvestment,
    savingsRate,
    avgDailySpend: daysElapsed > 0 ? Math.round(totalExpense / daysElapsed) : 0,
    topExpenseCategories: expenseCats.slice(0, 3),
    topExpenseShare:
      expenseCats[0] && totalExpense > 0 ? Math.round((expenseCats[0].total / totalExpense) * 100) : null,
    topInvestmentCategory: investmentCats[0] || null,
    goTo,
    biggestMonth,
    lightestMonth,
    biggestExpense,
    busiestWeekday,
    noSpendDays,
    longestNoSpendStreak: longestStreak,
    daysElapsed,
    expenseChangePct: pctChange(totalExpense, prevYear?.totalExpense),
    investmentChangePct: pctChange(totalInvestment, prevYear?.totalInvestment),
    netWorthStart,
    netWorthEnd,
    netWorthChange:
      netWorthStart != null && netWorthEnd != null ? netWorthEnd - netWorthStart : null,
  };
}
