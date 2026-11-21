import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS, TYPE_COLORS, daysInMonth, totalsByKey, txDay } from '../utils/analytics';
import { VxCard, Legend, Segmented, EmptyChart } from './charts/ChartKit';
import { niceFloor } from './charts/chartUtils';
import LineAreaChart from './charts/LineAreaChart';
import { MonthBars } from './charts/BarCharts';
import { CategoryMonthHeatmap, YearCalendarHeatmap } from './charts/HeatCharts';

/** Read-only: all 12 months of entries for the year (GET only). */
function useYearTransactions(year) {
  const [state, setState] = useState({ year: null, months: [] });
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        api
          .get('/transactions', { params: { year, month: i + 1 } })
          .then((r) => r.data?.transactions || [])
          .catch(() => [])
      )
    ).then((months) => !cancelled && setState({ year, months }));
    return () => {
      cancelled = true;
    };
  }, [year]);
  return { months: state.year === year ? state.months : null };
}

function useBalanceYear(year) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/balance-sheet/year/${year}`)
      .then((r) => !cancelled && setData(r.data?.byMonth || null))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [year]);
  return data;
}

export default function YearAnalytics({ year, yearlySummary, yearlyCashflow }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const fmt = (v) => inr(Math.round(v));
  const { months } = useYearTransactions(year);
  const balance = useBalanceYear(year);
  const [heatType, setHeatType] = useState('expense');
  const today = new Date();
  const lastMonth = today.getFullYear() === year ? today.getMonth() + 1 : year < today.getFullYear() ? 12 : 0;

  const monthly = yearlySummary?.monthly || [];
  const inflow = (yearlyCashflow || []).map((v) => Number(v) || 0);
  const exp = Array.from({ length: 12 }, (_, i) => monthly[i]?.totalExpense || 0);
  const inv = Array.from({ length: 12 }, (_, i) => monthly[i]?.totalInvestment || 0);
  const saved = inflow.map((v, i) => (v > 0 ? v - exp[i] - inv[i] : 0));
  const rate = inflow.map((v, i) => (v > 0 ? Math.round(((v - exp[i]) / v) * 100) : 0));
  const activeMonths = rate.filter((r, i) => inflow[i] > 0).length;
  const avgRate = activeMonths ? Math.round(rate.reduce((s, r, i) => s + (inflow[i] > 0 ? r : 0), 0) / activeMonths) : null;
  const stop = Math.max(1, lastMonth);

  const heatRows = useMemo(() => {
    if (!months) return [];
    const perMonth = months.map((txs) => totalsByKey(txs, { type: heatType, key: 'category' }));
    const totals = new Map();
    perMonth.forEach((m) => m.forEach((v, k) => totals.set(k, (totals.get(k) || 0) + v)));
    return Array.from(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name]) => ({ name, values: perMonth.map((m) => m.get(name) || 0) }));
  }, [months, heatType]);

  const daily = useMemo(() => {
    if (!months) return null;
    return months.map((txs, mi) => {
      const arr = Array(daysInMonth(year, mi + 1)).fill(0);
      txs.forEach((tx) => {
        if (tx.type !== 'expense') return;
        const d = txDay(tx);
        if (d >= 1 && d <= arr.length) arr[d - 1] += Number(tx.amount) || 0;
      });
      return arr;
    });
  }, [months, year]);
  const noSpendDays = useMemo(() => {
    if (!daily || !lastMonth) return 0;
    const isThisYear = year === today.getFullYear();
    let count = 0;
    daily.slice(0, lastMonth).forEach((days, mi) => {
      const limit = isThisYear && mi + 1 === lastMonth ? today.getDate() : days.length;
      for (let d = 0; d < limit; d += 1) if (!days[d]) count += 1;
    });
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, lastMonth, year]);

  const nw = useMemo(() => {
    if (!balance) return null;
    const rows = Array.from({ length: 12 }, (_, i) => balance[i + 1] || { totalAssets: 0, totalDebts: 0, netWorth: 0 });
    if (!rows.some((r) => r.totalAssets || r.totalDebts)) return null;
    return {
      assets: rows.map((r) => r.totalAssets || 0),
      debts: rows.map((r) => r.totalDebts || 0),
      net: rows.map((r) => r.netWorth || 0),
    };
  }, [balance]);
  const nwChange = nw ? nw.net[stop - 1] - nw.net[0] : 0;

  return (
    <section className="vx-section" aria-label="Year analytics">
      <div className="vx-section-head">
        <h2>Year analytics · {year}</h2>
        <span className="muted small">Tap any chart for details</span>
      </div>
      <div className="vx-grid">
        <VxCard
          title="In vs out, month by month"
          subtitle={inflow.some(Boolean) ? `Saved ${hideAmounts ? '' : fmt(saved.reduce((a, b) => a + b, 0))} after spend & invest` : 'Monthly totals'}
          wide
        >
          <LineAreaChart
            labels={MONTH_LABELS}
            series={[
              { key: 'in', label: 'Inflow', color: TYPE_COLORS.inflow, values: inflow, stopAt: stop, width: 2.5 },
              { key: 'exp', label: 'Expense', color: TYPE_COLORS.expense, values: exp, stopAt: stop, area: true, width: 2.5 },
              { key: 'inv', label: 'Invested', color: TYPE_COLORS.investment, values: inv, stopAt: stop, width: 2.5 },
            ]}
            format={fmt}
            compact={compact}
            hideAmounts={hideAmounts}
          />
          <Legend
            items={[
              { label: 'Inflow', color: TYPE_COLORS.inflow, line: true },
              { label: 'Expense', color: TYPE_COLORS.expense },
              { label: 'Invested', color: TYPE_COLORS.investment, line: true },
            ]}
          />
        </VxCard>

        <VxCard title="Savings rate" subtitle={avgRate != null ? `Average ${avgRate}% · (inflow − expense) ÷ inflow` : 'Add inflow to see your savings rate'}>
          {activeMonths ? (
            <MonthBars
              labels={MONTH_LABELS.map((m) => m[0])}
              values={rate}
              color={(v) => (v >= 30 ? '#22c55e' : v >= 10 ? '#eab308' : '#f43f5e')}
              format={(v) => `${v}`}
              compact={(v) => `${v}%`}
              suffix="%"
              hideAmounts={false}
              highlight={lastMonth && year === today.getFullYear() ? lastMonth - 1 : null}
            />
          ) : (
            <EmptyChart text="No inflow saved for this year." />
          )}
        </VxCard>

        {nw && (
          <VxCard
            title="Net worth"
            subtitle={`${nwChange >= 0 ? '▲' : '▼'} ${hideAmounts ? '' : fmt(Math.abs(nwChange))} since Jan${hideAmounts ? '' : ` · debts now ${compact(nw.debts[stop - 1])}`}`}
          >
            <LineAreaChart
              labels={MONTH_LABELS}
              series={[
                { key: 'a', label: 'Assets', color: '#06b6d4', values: nw.assets, stopAt: stop, width: 1.75 },
                { key: 'n', label: 'Net worth', color: '#22c55e', values: nw.net, stopAt: stop, area: true, endDot: true, width: 2.75 },
              ]}
              format={fmt}
              compact={compact}
              hideAmounts={hideAmounts}
              yMin={niceFloor(Math.min(...nw.net.slice(0, stop)) * 0.9)}
            />
            <Legend
              items={[
                { label: 'Net worth', color: '#22c55e' },
                { label: 'Assets', color: '#06b6d4', line: true },
              ]}
            />
          </VxCard>
        )}

        <VxCard
          title="Category heatmap"
          subtitle="Each row shaded vs its own busiest month: spot seasonal spends"
          right={<Segmented value={heatType} onChange={setHeatType} options={[{ value: 'expense', label: 'Spend' }, { value: 'investment', label: 'Invest' }]} />}
          wide
        >
          {!months ? (
            <EmptyChart text="Loading the year…" />
          ) : heatRows.length ? (
            <CategoryMonthHeatmap rows={heatRows} format={fmt} highlightMonth={year === today.getFullYear() ? lastMonth : null} rgb={heatType === 'expense' ? '249, 115, 22' : '34, 197, 94'} />
          ) : (
            <EmptyChart text="No entries this year." />
          )}
        </VxCard>

        <VxCard title="Daily spending" subtitle={daily ? `${noSpendDays} no-spend days so far` : ''} wide>
          {daily ? (
            <YearCalendarHeatmap
              year={year}
              dailyByMonth={daily}
              format={fmt}
              todayKey={`${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`}
            />
          ) : (
            <EmptyChart text="Loading the year…" />
          )}
        </VxCard>
      </div>
    </section>
  );
}
