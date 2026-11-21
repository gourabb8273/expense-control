import { useMemo, useState } from 'react';
import { useFormatMoney } from '../utils/formatMoney';
import {
  MONTH_LABELS,
  colorFor,
  compareCategories,
  cumulativeByDay,
  daysInMonth,
  detectSubscriptions,
  sumBy,
  topWithOther,
  totalsByKey,
  TYPE_COLORS,
} from '../utils/analytics';
import { VxCard, Legend, Segmented, EmptyChart } from './charts/ChartKit';
import LineAreaChart from './charts/LineAreaChart';
import { CompareBars, Waterfall } from './charts/BarCharts';
import { Sankey, Treemap } from './charts/FlowCharts';

/** Read-only visual analytics for one month. Uses only data already loaded by the dashboard. */
export default function MonthAnalytics({ year, month, transactions, history, historyLoading, inflows, inflowTotal, onPickCategory, pickedCategory }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const fmt = (v) => inr(Math.round(v));
  const [groupBy, setGroupBy] = useState('category');
  const [txType, setTxType] = useState('expense');
  const [compareIdx, setCompareIdx] = useState(0);
  const today = new Date();
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === month;
  const n = daysInMonth(year, month);
  const hist = useMemo(() => history || [], [history]);
  const prevMonth = hist[0];
  const compareTo = hist[compareIdx] || prevMonth;

  // ---- Spending pace (cumulative)
  const pace = useMemo(() => {
    const cur = cumulativeByDay(transactions, year, month);
    const prev = prevMonth ? cumulativeByDay(prevMonth.transactions, prevMonth.year, prevMonth.month) : [];
    const at = (arr, i) => (arr.length ? arr[Math.max(0, Math.min(arr.length - 1, Math.round(((i + 1) / n) * arr.length) - 1))] || 0 : 0);
    const prevScaled = Array.from({ length: n }, (_, i) => at(prev, i));
    const avgSeries = Array.from({ length: n }, () => 0);
    const usable = hist.filter((h) => (h.transactions || []).some((t) => t.type === 'expense'));
    usable.forEach((h) => {
      const c = cumulativeByDay(h.transactions, h.year, h.month);
      for (let i = 0; i < n; i += 1) avgSeries[i] += at(c, i) / usable.length;
    });
    return { cur, prevScaled, avgSeries, hasAvg: usable.length > 0 };
  }, [transactions, prevMonth, hist, year, month, n]);
  const stopAt = isCurrent ? today.getDate() : n;
  const spentSoFar = pace.cur[stopAt - 1] || 0;
  const avgAtSameDay = pace.avgSeries[stopAt - 1] || 0;
  const paceDiff = spentSoFar - avgAtSameDay;

  // ---- Category / tag comparison
  const compareRows = useMemo(() => {
    const rows = compareCategories(transactions, compareTo?.transactions || [], { type: txType, key: groupBy })
      .filter((r) => r.value > 0 || r.prev > 0)
      .map((r) => ({ ...r, color: colorFor(r.name) }));
    return topWithOther(rows.filter((r) => r.value > 0).concat(rows.filter((r) => r.value === 0)), 8);
  }, [transactions, compareTo, txType, groupBy]);
  const typeTotal = sumBy(transactions, txType);

  // ---- What changed (waterfall)
  const waterfall = useMemo(() => {
    if (!prevMonth) return null;
    const rows = compareCategories(transactions, prevMonth.transactions, { type: 'expense', key: 'category' });
    const start = sumBy(prevMonth.transactions, 'expense');
    const end = sumBy(transactions, 'expense');
    const sorted = rows.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const top = sorted.slice(0, 5).filter((r) => Math.abs(r.delta) > 0);
    const restDelta = end - start - top.reduce((s, r) => s + r.delta, 0);
    const steps = top.map((r) => ({ name: r.name, delta: r.delta }));
    if (Math.abs(restDelta) >= 1) steps.push({ name: 'Everything else', delta: restDelta });
    return { start, end, steps, biggest: top[0] };
  }, [transactions, prevMonth]);

  // ---- Sankey
  const sankey = useMemo(() => {
    const exp = sumBy(transactions, 'expense');
    const inv = sumBy(transactions, 'investment');
    const srcRows = (inflows || []).filter((r) => Number(r.amount) > 0).map((r) => ({ name: r.label || 'Inflow', value: Number(r.amount), color: TYPE_COLORS.inflow }));
    let sources = srcRows.length ? srcRows : inflowTotal > 0 ? [{ name: 'Inflow', value: inflowTotal, color: TYPE_COLORS.inflow }] : [];
    const totalIn = sources.reduce((s, r) => s + r.value, 0);
    if (exp + inv > totalIn) sources = [...sources, { name: 'From savings', value: exp + inv - totalIn, color: '#94a3b8' }];
    const leaves = (type) => {
      const rows = Array.from(totalsByKey(transactions, { type, key: 'category' }), ([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      const top = topWithOther(rows, type === 'expense' ? 6 : 3);
      return top.map((r) => ({ ...r, color: r.isOther ? '#64748b' : colorFor(r.name) }));
    };
    const buckets = [];
    if (exp > 0) buckets.push({ name: 'Expenses', value: exp, color: TYPE_COLORS.expense, children: leaves('expense') });
    if (inv > 0) buckets.push({ name: 'Invested', value: inv, color: TYPE_COLORS.investment, children: leaves('investment') });
    const left = totalIn - exp - inv;
    if (left > 0) buckets.push({ name: 'Left', value: left, color: TYPE_COLORS.saved, children: [{ name: 'Unspent', value: left, color: TYPE_COLORS.saved }] });
    return { sources, buckets, ok: sources.length > 0 && buckets.length > 0 };
  }, [transactions, inflows, inflowTotal]);

  // ---- Treemap (tag → category)
  const treeItems = useMemo(() => {
    const map = new Map();
    (transactions || []).forEach((tx) => {
      if (tx.type !== 'expense') return;
      const k = `${tx.tag || 'Untagged'}|${tx.category}`;
      map.set(k, (map.get(k) || 0) + (Number(tx.amount) || 0));
    });
    return Array.from(map, ([k, value]) => {
      const [group, name] = k.split('|');
      return { name, group, value, color: colorFor(group) };
    });
  }, [transactions]);

  // ---- Subscriptions
  const subs = useMemo(
    () => (historyLoading ? [] : detectSubscriptions(transactions, hist.slice(0, 5))),
    [transactions, hist, historyLoading]
  );
  const subsYearly = subs.filter((s) => s.activeThisMonth).reduce((s, r) => s + r.yearly, 0);

  const dayLabels = Array.from({ length: n }, (_, i) => String(i + 1));
  const prevLabel = prevMonth ? MONTH_LABELS[prevMonth.month - 1] : '';

  return (
    <section className="vx-section" aria-label="Visual analytics">
      <div className="vx-section-head">
        <h2>Visual analytics</h2>
        <span className="muted small">Tap any chart for details</span>
      </div>
      <div className="vx-grid">
        <VxCard
          title="Spending pace"
          subtitle={
            pace.hasAvg && spentSoFar > 0
              ? `${hideAmounts ? '' : `${fmt(Math.abs(paceDiff))} `}${paceDiff > 0 ? 'more' : 'less'} than your usual by day ${stopAt}`
              : 'Cumulative expense through the month'
          }
          wide
        >
          {spentSoFar > 0 || pace.hasAvg ? (
            <>
              <LineAreaChart
                labels={dayLabels}
                series={[
                  ...(pace.hasAvg ? [{ key: 'avg', label: '6-mo average', color: '#94a3b8', values: pace.avgSeries, dashed: true, width: 1.75 }] : []),
                  ...(prevMonth ? [{ key: 'prev', label: prevLabel, color: '#818cf8', values: pace.prevScaled, width: 1.75 }] : []),
                  { key: 'cur', label: MONTH_LABELS[month - 1], color: TYPE_COLORS.expense, values: pace.cur, stopAt, area: true, endDot: true, width: 2.75 },
                ]}
                marker={isCurrent ? { index: stopAt - 1, label: 'Today' } : null}
                format={fmt}
                compact={compact}
                hideAmounts={hideAmounts}
              />
              <Legend
                items={[
                  { label: `${MONTH_LABELS[month - 1]} (this month)`, color: TYPE_COLORS.expense },
                  ...(prevMonth ? [{ label: prevLabel, color: '#818cf8', line: true }] : []),
                  ...(pace.hasAvg ? [{ label: '6-mo average', color: '#94a3b8', dashed: true }] : []),
                ]}
              />
            </>
          ) : (
            <EmptyChart text="No expenses yet this month." />
          )}
        </VxCard>

        <VxCard
          title="Where it went"
          subtitle={
            compareTo
              ? `Sorted by amount · marker = ${MONTH_LABELS[compareTo.month - 1]} ${compareTo.year !== year ? compareTo.year : ''}`
              : 'Sorted by amount'
          }
          right={
            <div className="vx-controls">
              <Segmented value={txType} onChange={setTxType} options={[{ value: 'expense', label: 'Spend' }, { value: 'investment', label: 'Invest' }]} />
              <Segmented value={groupBy} onChange={setGroupBy} options={[{ value: 'category', label: 'Category' }, { value: 'tag', label: 'Tag' }]} />
            </div>
          }
        >
          {hist.length > 1 && (
            <label className="vx-inline-select">
              Compare with
              <select value={compareIdx} onChange={(e) => setCompareIdx(Number(e.target.value))}>
                {hist.map((h, i) => (
                  <option key={`${h.year}-${h.month}`} value={i}>
                    {MONTH_LABELS[h.month - 1]} {h.year}
                  </option>
                ))}
              </select>
            </label>
          )}
          {compareRows.some((r) => r.value > 0) ? (
            <>
              <CompareBars
                rows={compareRows.filter((r) => r.value > 0)}
                format={fmt}
                total={typeTotal}
                hideAmounts={hideAmounts}
                selected={pickedCategory}
                onSelect={groupBy === 'category' ? onPickCategory : undefined}
              />
              {groupBy === 'category' && onPickCategory && <p className="vx-hint">Tap a row to filter your entries.</p>}
            </>
          ) : (
            <EmptyChart text={`No ${txType === 'expense' ? 'spending' : 'investments'} this month.`} />
          )}
        </VxCard>

        {waterfall && waterfall.steps.length > 0 && (
          <VxCard
            title={`What changed since ${prevLabel}`}
            subtitle={
              waterfall.biggest
                ? `Biggest move: ${waterfall.biggest.name} ${waterfall.biggest.delta > 0 ? '▲' : '▼'}${hideAmounts ? '' : ` ${fmt(Math.abs(waterfall.biggest.delta))}`}`
                : ''
            }
          >
            <Waterfall
              start={waterfall.start}
              end={waterfall.end}
              steps={waterfall.steps}
              startLabel={`${prevLabel} spend`}
              endLabel={`${MONTH_LABELS[month - 1]} spend`}
              format={fmt}
              compact={compact}
              hideAmounts={hideAmounts}
            />
          </VxCard>
        )}

        <VxCard title="Money flow" subtitle="Inflow → spend / invest / left → categories" wide>
          {sankey.ok ? (
            <Sankey sources={sankey.sources} buckets={sankey.buckets} format={fmt} hideAmounts={hideAmounts} />
          ) : (
            <EmptyChart text="Add inflow and entries to see the flow." />
          )}
        </VxCard>

        <VxCard title="Spend map" subtitle="Box size = share of spend · colour = tag">
          {treeItems.length ? (
            <Treemap items={treeItems} format={fmt} hideAmounts={hideAmounts} total={sumBy(transactions, 'expense')} />
          ) : (
            <EmptyChart text="No expenses yet this month." />
          )}
        </VxCard>

        <VxCard
          title="Repeating charges"
          subtitle={subs.length ? `Same amount ${'≥'}3 of the last 6 months · ${hideAmounts ? '' : `${fmt(subsYearly)}/yr`}` : 'Detected from your entries'}
        >
          {historyLoading ? (
            <EmptyChart text="Looking at the last 6 months…" />
          ) : subs.length ? (
            <ul className="vx-subs">
              {subs.slice(0, 8).map((s) => (
                <li key={`${s.name}-${s.amount}`} className={s.activeThisMonth ? '' : 'is-missing'}>
                  <span className="vx-subs-dot" style={{ background: colorFor(s.name) }} />
                  <span className="vx-subs-name">
                    {s.name}
                    <small>
                      {s.monthsSeen}/6 months{s.recurring ? ' · recurring rule' : ''}
                      {!s.activeThisMonth ? ' · not yet this month' : ''}
                    </small>
                  </span>
                  <span className="vx-subs-amt">
                    {fmt(s.amount)}
                    <small>{hideAmounts ? '' : `${compact(s.yearly)}/yr`}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyChart text="No repeating charges found." />
          )}
        </VxCard>
      </div>
    </section>
  );
}
