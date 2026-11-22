import { useMemo } from 'react';
import { useFormatMoney } from '../utils/formatMoney';
import { safeToSpend, sumBy, MONTH_LABELS } from '../utils/analytics';
import { Sparkline } from './charts/BarCharts';
import { Loading } from './charts/ChartKit';

/**
 * Read-only "month at a glance" hero: safe-to-spend per day, pace bar and three KPI tiles with 6-month sparklines.
 */
export default function MonthGlance({ year, month, inflow, expense, investment, history, loading }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  // left = inflow − expense − investment (same as the app's “Remaining”)
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
  // exact to one decimal, e.g. 47.1%
  const savingsRate = inflow > 0 ? Math.round(((inflow - expense) / inflow) * 1000) / 10 : null;
  const investRate = inflow > 0 ? Math.round((investment / inflow) * 1000) / 10 : null;

  let tone = 'good';
  if (!inflow) tone = 'neutral';
  else if (s.left < 0) tone = 'bad';

  if (loading) {
    return (
      <section className="card glance glance-loading" aria-busy="true">
        <Loading text={`Loading ${MONTH_LABELS[month - 1]} ${year}…`} />
      </section>
    );
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

      {inflow > 0 && s.isCurrent && s.left > 0 && s.daysLeft > 0 && (
        <div className="glance-steps">
          <div className="glance-step glance-step-strong">
            <span>
              You can spend · {s.daysLeft} day{s.daysLeft === 1 ? '' : 's'} left
            </span>
            <b>{inr(Math.floor(s.left / s.daysLeft))} / day</b>
          </div>
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
