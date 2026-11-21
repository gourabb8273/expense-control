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
  const assets = rows.map((r) => r.totalAssets || 0);
  const debts = rows.map((r) => r.totalDebts || 0);
  const net = rows.map((r) => r.netWorth || 0);
  const debtsSoFar = debts.slice(0, stop);
  const firstIdx = debtsSoFar.findIndex((v) => v > 0);
  const debtStart = firstIdx >= 0 ? debtsSoFar[firstIdx] : 0;
  const debtEnd = debtsSoFar[debtsSoFar.length - 1] || 0;
  // Month-on-month change in debt (negative = paid down)
  const paidRows = debtsSoFar
    .map((v, i) => ({ i, delta: i > 0 ? v - debtsSoFar[i - 1] : 0 }))
    .filter((r) => r.i > 0 && Math.round(r.delta) !== 0 && (debtsSoFar[r.i - 1] > 0 || r.delta > 0));
  return (
    <>
      <LineAreaChart
        labels={MONTH_LABELS}
        series={[
          { key: 'a', label: 'Assets', color: '#06b6d4', values: assets, stopAt: stop, width: 1.75 },
          { key: 'n', label: 'Net worth', color: '#22c55e', values: net, stopAt: stop, area: true, endDot: true, width: 2.75 },
          ...(debtsSoFar.some(Boolean)
            ? [{ key: 'd', label: 'Debts', color: '#f43f5e', values: debts, stopAt: stop, endDot: true, width: 2.25, dashed: true, axis: 'right' }]
            : []),
        ]}
        format={fmt}
        compact={compact}
        hideAmounts={hideAmounts}
        yMin={niceFloor(Math.min(...net.slice(0, stop)) * 0.9)}
      />
      <Legend
        items={[
          { label: 'Net worth', color: '#22c55e' },
          { label: 'Assets', color: '#06b6d4', line: true },
          ...(debtsSoFar.some(Boolean) ? [{ label: 'Debts (right axis)', color: '#f43f5e', dashed: true }] : []),
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
