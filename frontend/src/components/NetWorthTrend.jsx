import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS } from '../utils/analytics';
import { Legend } from './charts/ChartKit';
import { niceFloor } from './charts/chartUtils';
import LineAreaChart from './charts/LineAreaChart';
import { MonthBars } from './charts/BarCharts';

/**
 * Net worth & assets as lines, debts as their own bar chart underneath (so small debts stay readable).
 * rows: 12 × { totalAssets, totalDebts, netWorth }
 */
export default function NetWorthTrend({ rows, stop = 12, highlight }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const fmt = (v) => inr(Math.round(v));
  const assets = rows.map((r) => r.totalAssets || 0);
  const debts = rows.map((r) => r.totalDebts || 0);
  const net = rows.map((r) => r.netWorth || 0);
  const shownDebts = debts.map((v, i) => (i < stop ? v : 0));
  return (
    <>
      <LineAreaChart
        labels={MONTH_LABELS}
        series={[
          { key: 'a', label: 'Assets', color: '#06b6d4', values: assets, stopAt: stop, width: 1.75 },
          { key: 'n', label: 'Net worth', color: '#22c55e', values: net, stopAt: stop, area: true, endDot: true, width: 2.75 },
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
          { label: 'Debts (below)', color: '#f43f5e' },
        ]}
      />
      {shownDebts.some(Boolean) && (
        <div className="nw-debts">
          <span className="nw-debts-title">
            Debts
            {!hideAmounts && stop > 1 && (
              <small>
                {' '}
                · {debts[stop - 1] <= debts[0] ? '▼' : '▲'} {compact(Math.abs(debts[stop - 1] - debts[0]))} since Jan
              </small>
            )}
          </span>
          <MonthBars
            labels={MONTH_LABELS.map((m) => m[0])}
            values={shownDebts}
            color="#f43f5e"
            format={fmt}
            compact={compact}
            hideAmounts={hideAmounts}
            height={130}
            highlight={highlight}
          />
        </div>
      )}
    </>
  );
}
