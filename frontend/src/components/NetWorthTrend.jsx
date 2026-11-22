import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS } from '../utils/analytics';
import { Legend } from './charts/ChartKit';
import BalanceBars from './charts/BalanceBars';

/**
 * Assets (bars up), debts (bars down) and net worth (line) on ONE scale, so they read together.
 * rows: 12 × { totalAssets, totalDebts, netWorth }
 */
export default function NetWorthTrend({ rows, stop = 12, highlight }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const fmt = (v) => inr(Math.round(v));
  // Months with no balance sheet at all (or in the future) are left empty
  const shaped = rows.map((r, i) =>
    i >= stop || !r || (!r.totalAssets && !r.totalDebts)
      ? null
      : { label: MONTH_LABELS[i], assets: r.totalAssets || 0, debts: r.totalDebts || 0, net: r.netWorth || 0 }
  );
  const known = shaped.map((r, i) => (r ? { ...r, i } : null)).filter(Boolean);
  const first = known[0];
  const last = known[known.length - 1];
  const hasDebt = known.some((r) => r.debts > 0);
  // Month-on-month change in debt (negative = paid down)
  const paidRows = known
    .map((r, k) => ({ i: r.i, delta: k > 0 ? r.debts - known[k - 1].debts : 0 }))
    .filter((r, k) => k > 0 && Math.round(r.delta) !== 0);

  if (!known.length) return null;

  return (
    <>
      <BalanceBars rows={shaped} labels={MONTH_LABELS} format={fmt} compact={compact} hideAmounts={hideAmounts} highlight={highlight} />
      <Legend
        items={[
          { label: 'Net worth', color: '#22c55e', line: true },
          { label: 'Assets (up)', color: '#06b6d4' },
          ...(hasDebt ? [{ label: 'Debts (down)', color: '#f43f5e' }] : []),
        ]}
      />
      {!hideAmounts && first && last && known.length > 1 && (
        <div className="nw-summary">
          <span>
            <i style={{ background: '#22c55e' }} />
            Net worth <b>{compact(first.net)} → {compact(last.net)}</b>
          </span>
          <span>
            <i style={{ background: '#06b6d4' }} />
            Assets <b>{compact(first.assets)} → {compact(last.assets)}</b>
          </span>
          {hasDebt && (
            <span>
              <i style={{ background: '#f43f5e' }} />
              Debts <b>{compact(first.debts)} → {compact(last.debts)}</b>
              {first.debts > 0 && last.debts !== first.debts && (
                <em className={last.debts < first.debts ? 'good' : 'bad'}>
                  {last.debts < first.debts ? '▼' : '▲'} {Math.round((Math.abs(last.debts - first.debts) / first.debts) * 100)}%
                </em>
              )}
            </span>
          )}
        </div>
      )}
      {!hideAmounts && hasDebt && paidRows.length > 0 && (
        <div className="nw-debt-steps" aria-label="Debt change each month">
          <span className="nw-debt-steps-label">Debt each month:</span>
          {paidRows.map((r) => (
            <span key={r.i} className={`nw-debt-step ${r.delta <= 0 ? 'good' : 'bad'}`}>
              {MONTH_LABELS[r.i]} {r.delta <= 0 ? '−' : '+'}
              {compact(Math.abs(r.delta))}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
