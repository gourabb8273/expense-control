import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS } from '../utils/analytics';
import { Legend } from './charts/ChartKit';
import { niceFloor } from './charts/chartUtils';
import LineAreaChart from './charts/LineAreaChart';

/**
 * Net worth & assets as lines, debts as their own bar chart underneath (so small debts stay readable).
 * rows: 12 × { totalAssets, totalDebts, netWorth }
 */
export default function NetWorthTrend({ rows, stop = 12 }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const fmt = (v) => inr(Math.round(v));
  // Months with no balance sheet at all are gaps (null), not zeros, so lines don't plunge
  const empty = (r) => !r || (!r.totalAssets && !r.totalDebts);
  const assets = rows.map((r) => (empty(r) ? null : r.totalAssets || 0));
  const debts = rows.map((r) => (empty(r) ? null : r.totalDebts || 0));
  const net = rows.map((r) => (empty(r) ? null : r.netWorth || 0));
  const rawDebts = debts.slice(0, stop);
  const debtsSoFar = rawDebts.map((v) => v ?? 0);
  const known = rawDebts.map((v, i) => ({ v, i })).filter((r) => r.v != null);
  const debtStart = known.length ? known[0].v : 0;
  const debtEnd = known.length ? known[known.length - 1].v : 0;
  // Month-on-month change in debt (negative = paid down); skips months with no balance sheet
  const paidRows = known
    .map((r, k) => ({ i: r.i, delta: k > 0 ? r.v - known[k - 1].v : 0 }))
    .filter((r, k) => k > 0 && Math.round(r.delta) !== 0);

  return (
    <>
      <LineAreaChart
        labels={MONTH_LABELS}
        series={[
          { key: 'a', label: 'Assets', color: '#06b6d4', values: assets, stopAt: stop, width: 1.75 },
          { key: 'n', label: 'Net worth', color: '#22c55e', values: net, stopAt: stop, area: true, endDot: true, width: 2.75 },
          ...(debtsSoFar.some(Boolean)
            ? [{ key: 'd', label: 'Debts', color: '#f43f5e', values: debts, stopAt: stop, endDot: true, width: 2, axis: 'right' }]
            : []),
        ]}
        format={fmt}
        compact={compact}
        hideAmounts={hideAmounts}
        yMin={niceFloor(Math.min(...net.slice(0, stop).filter((v) => v != null)) * 0.9)}
      />
      <Legend
        items={[
          { label: 'Net worth', color: '#22c55e' },
          { label: 'Assets', color: '#06b6d4', line: true },
          ...(debtsSoFar.some(Boolean) ? [{ label: 'Debts (right scale)', color: '#f43f5e', line: true }] : []),
        ]}
      />
      {debtsSoFar.some(Boolean) && (
        <div className="nw-debts">
          <span className="nw-debts-title">
            Debts
            {!hideAmounts && (
              <small>
                {' '}
                · {compact(debtStart)} → {compact(debtEnd)}
                {debtStart > 0 && debtEnd !== debtStart && (
                  <> ({debtEnd < debtStart ? '▼' : '▲'} {compact(Math.abs(debtEnd - debtStart))}, {Math.round((Math.abs(debtEnd - debtStart) / debtStart) * 100)}%)</>
                )}
              </small>
            )}
          </span>
          {!hideAmounts && paidRows.length > 0 && (
            <div className="nw-debt-steps">
              {paidRows.map((r) => (
                <span key={r.i} className={`nw-debt-step ${r.delta <= 0 ? 'good' : 'bad'}`}>
                  {MONTH_LABELS[r.i]} {r.delta <= 0 ? '−' : '+'}
                  {compact(Math.abs(r.delta))}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
