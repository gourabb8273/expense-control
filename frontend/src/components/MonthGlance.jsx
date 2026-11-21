import { useMemo } from 'react';
import { useFormatMoney } from '../utils/formatMoney';
import { safeToSpend, sumBy, MONTH_LABELS } from '../utils/analytics';
import { Sparkline } from './charts/BarCharts';

/**
 * Read-only "month at a glance" hero: safe-to-spend per day, pace bar and three KPI tiles with 6-month sparklines.
 * pendingRecurring: sum of recurring outflows not yet added this month (from GET /recurring/pending).
 */
export default function MonthGlance({ year, month, inflow, expense, investment, history, pendingRecurring = 0, loading }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  // left = inflow − expense − investment (same as the app's “Remaining”); bills are subtracted separately below
  const s = safeToSpend({ inflow, expense, investment, year, month });

  const trend = useMemo(() => {
    const past = (history || []).slice().reverse();
    const exp = [...past.map((h) => sumBy(h.transactions, 'expense')), expense];
    const inv = [...past.map((h) => sumBy(h.transactions, 'investment')), investment];
    const labels = [...past.map((h) => MONTH_LABELS[h.month - 1]), MONTH_LABELS[month - 1]];
    return { exp, inv, labels };
  }, [history, expense, investment, month]);

  const prevExp = trend.exp.length > 1 ? trend.exp[trend.exp.length - 2] : null;
  const expDelta = prevExp ? Math.round(((expense - prevExp) / prevExp) * 100) : null;
  const avgExp = trend.exp.length > 1 ? trend.exp.slice(0, -1).reduce((a, b) => a + b, 0) / (trend.exp.length - 1) : 0;
  const savingsRate = inflow > 0 ? Math.round(((inflow - expense) / inflow) * 100) : null;
  const investRate = inflow > 0 ? Math.round((investment / inflow) * 100) : null;

  // Pace: share of month gone vs share of usual spend already spent
  const timePct = s.daysInMonth ? Math.round((s.dayOfMonth / s.daysInMonth) * 100) : 0;
  const spendPct = avgExp > 0 ? Math.round((expense / avgExp) * 100) : null;
  const ahead = spendPct != null && s.isCurrent && spendPct > timePct + 8;

  const afterBills = s.left - pendingRecurring;
  let tone = 'good';
  if (!inflow) tone = 'neutral';
  else if (s.left < 0) tone = 'bad';
  else if (ahead || (s.isCurrent && afterBills < 0)) tone = 'warn';

  if (loading) {
    return <section className="card glance glance-loading" aria-busy="true"><div className="skeleton-line" /><div className="skeleton-line short" /></section>;
  }

  return (
    <section className={`card glance glance-${tone}`} aria-label="Month at a glance">
      <div className="glance-top">
        <div className="glance-main">
          <span className="glance-eyebrow">
            {!inflow ? `${MONTH_LABELS[month - 1]} ${year}` : s.left >= 0 ? `Left in ${MONTH_LABELS[month - 1]}` : `Over budget in ${MONTH_LABELS[month - 1]}`}
          </span>
          <span className="glance-big">{inflow ? inr(Math.abs(s.left)) : '—'}</span>
          {inflow > 0 ? (
            <span className="glance-equation">
              {compact(inflow)} in − {compact(expense)} spent − {compact(investment)} invested
            </span>
          ) : (
            <span className="glance-sub">Add this month’s inflow to see what’s left</span>
          )}
        </div>
        {savingsRate != null && (
          <div className="glance-ring" title="Savings rate: (inflow − expense) ÷ inflow">
            <svg viewBox="0 0 44 44" width="64" height="64" aria-hidden="true">
              <circle cx="22" cy="22" r="18" className="ring-track" />
              <circle
                cx="22"
                cy="22"
                r="18"
                className="ring-fill"
                strokeDasharray={`${Math.max(0, Math.min(100, savingsRate)) * 1.131} 200`}
                transform="rotate(-90 22 22)"
              />
            </svg>
            <span className="glance-ring-val">{savingsRate}%</span>
            <span className="glance-ring-label">saved</span>
          </div>
        )}
      </div>

      {inflow > 0 && s.isCurrent && s.left > 0 && (
        <div className="glance-steps">
          {pendingRecurring > 0 && (
            <div className="glance-step">
              <span>Bills still to add</span>
              <b>− {inr(pendingRecurring)}</b>
            </div>
          )}
          {pendingRecurring > 0 && (
            <div className="glance-step">
              <span>After bills</span>
              <b className={afterBills < 0 ? 'neg' : ''}>{afterBills < 0 ? '− ' : ''}{inr(Math.abs(afterBills))}</b>
            </div>
          )}
          <div className="glance-step glance-step-strong">
            <span>
              Daily budget · {s.daysLeft} day{s.daysLeft === 1 ? '' : 's'} left
            </span>
            <b>{afterBills > 0 ? `${inr(Math.floor(afterBills / s.daysLeft))} / day` : '₹0 / day'}</b>
          </div>
        </div>
      )}

      {s.isCurrent && avgExp > 0 && (
        <div className="glance-pace">
          <div className="glance-pace-bar">
            <span className="glance-pace-fill" style={{ width: `${Math.min(100, spendPct)}%` }} />
            <span className="glance-pace-today" style={{ left: `${timePct}%` }} />
          </div>
          <span className="glance-pace-text">
            {ahead ? 'Spending faster than usual: ' : 'On track: '}
            {spendPct}% of a typical month’s spend used, {timePct}% of the month gone
          </span>
        </div>
      )}

      <div className="glance-tiles">
        <div className="glance-tile">
          <span className="glance-tile-label">Spent</span>
          <span className="glance-tile-val expense">{hideAmounts ? inr(expense) : compact(expense)}</span>
          {expDelta != null && (
            <span className={`glance-tile-delta ${expDelta > 0 ? 'up' : 'down'}`}>
              {expDelta > 0 ? '▲' : '▼'} {Math.abs(expDelta)}% vs {trend.labels[trend.labels.length - 2]}
            </span>
          )}
          <Sparkline values={trend.exp} color="#f97316" />
        </div>
        <div className="glance-tile">
          <span className="glance-tile-label">Invested</span>
          <span className="glance-tile-val invest">{hideAmounts ? inr(investment) : compact(investment)}</span>
          {investRate != null && <span className="glance-tile-delta neutral">{investRate}% of inflow</span>}
          <Sparkline values={trend.inv} color="#22c55e" />
        </div>
        <div className="glance-tile">
          <span className="glance-tile-label">Inflow</span>
          <span className="glance-tile-val inflow">{hideAmounts ? inr(inflow) : compact(inflow)}</span>
          <span className="glance-tile-delta neutral">
            {inflow > 0 ? `${Math.round(((expense + investment) / inflow) * 100)}% used` : 'not set'}
          </span>
        </div>
      </div>
    </section>
  );
}
