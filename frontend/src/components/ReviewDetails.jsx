import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS, TYPE_COLORS, colorFor, sumBy, totalsByKey, txDay } from '../utils/analytics';
import { VxCard, Segmented, EmptyChart, Loading } from './charts/ChartKit';
import { CompareBars, MonthBars } from './charts/BarCharts';
import NetWorthTrend from './NetWorthTrend';

/** Read-only: the year's entries, inflow, balance sheets, and last year's category totals. */
function useReviewData(year) {
  const [state, setState] = useState({ year: null });
  useEffect(() => {
    let cancelled = false;
    const safe = (p, fb) => p.then((r) => r.data).catch(() => fb);
    Promise.all([
      Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          safe(api.get('/transactions', { params: { year, month: i + 1 } }), { transactions: [] }).then((d) => d.transactions || [])
        )
      ),
      safe(api.get('/cashflow/year', { params: { year } }), { months: [] }),
      safe(api.get(`/balance-sheet/year/${year}`), { byMonth: null }),
      safe(api.get('/reports/yearly', { params: { year: year - 1 } }), null),
    ]).then(([months, cash, bs, prevReport]) => {
      if (cancelled) return;
      setState({ year, months, inflow: (cash.months || []).map((v) => Number(v) || 0), bs: bs.byMonth, prevReport });
    });
    return () => {
      cancelled = true;
    };
  }, [year]);
  return state.year === year ? state : null;
}

const pct1 = (v, t) => (t > 0 ? Math.round((v / t) * 1000) / 10 : 0);

export default function ReviewDetails({ year }) {
  const { inr, compact, signed, hideAmounts } = useFormatMoney();
  const fmt = (v) => inr(Math.round(v));
  const data = useReviewData(year);
  const [catType, setCatType] = useState('expense');
  const [catKey, setCatKey] = useState('category');
  const today = new Date();
  const lastMonth = year === today.getFullYear() ? today.getMonth() + 1 : year < today.getFullYear() ? 12 : 0;

  const calc = useMemo(() => {
    if (!data) return null;
    const { months, inflow } = data;
    const all = months.flat();
    const perMonth = months.map((txs, i) => {
      const exp = sumBy(txs, 'expense');
      const inv = sumBy(txs, 'investment');
      const inn = inflow[i] || 0;
      return { i, inn, exp, inv, saved: inn - exp - inv, rate: inn > 0 ? pct1(inn - exp, inn) : null };
    });
    const active = perMonth.filter((m) => m.i < Math.max(1, lastMonth) && (m.inn || m.exp || m.inv));
    const totIn = active.reduce((s, m) => s + m.inn, 0);
    const totExp = active.reduce((s, m) => s + m.exp, 0);
    const totInv = active.reduce((s, m) => s + m.inv, 0);
    const totSaved = totIn - totExp - totInv;
    const withRate = active.filter((m) => m.rate != null);
    const best = withRate.slice().sort((a, b) => b.rate - a.rate)[0];
    const worst = withRate.slice().sort((a, b) => a.rate - b.rate)[0];
    const essential = all.filter((t) => t.type === 'expense' && t.expenseEssential === 'essential');
    const nonEss = all.filter((t) => t.type === 'expense' && t.expenseEssential === 'nonessential');
    const biggest = all
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    return {
      all,
      perMonth,
      active,
      totIn,
      totExp,
      totInv,
      totSaved,
      best,
      worst,
      monthsCount: active.length || 1,
      ess: sumBy(essential),
      nonEss: sumBy(nonEss),
      biggest,
    };
  }, [data, lastMonth]);

  const catRows = useMemo(() => {
    if (!calc) return [];
    const cur = totalsByKey(calc.all, { type: catType, key: catKey });
    const prevList =
      catKey === 'category'
        ? data.prevReport?.[catType === 'expense' ? 'expenseCategories' : 'investmentCategories'] || []
        : data.prevReport?.[catType === 'expense' ? 'expenseByTag' : 'investmentByTag'] || [];
    const prev = new Map(prevList.map((r) => [r.category ?? r.tag, r.total]));
    const hasPrev = prevList.length > 0;
    return Array.from(cur, ([name, value]) => ({
      name,
      value,
      prev: hasPrev ? prev.get(name) || 0 : undefined,
      avg: value / calc.monthsCount,
      color: colorFor(name),
    })).sort((a, b) => b.value - a.value);
  }, [calc, catType, catKey, data]);

  const nwRows = useMemo(() => (data?.bs ? Array.from({ length: 12 }, (_, i) => data.bs[i + 1] || null) : null), [data]);
  const nwStory = useMemo(() => {
    if (!nwRows) return null;
    const known = nwRows.slice(0, Math.max(1, lastMonth)).filter((r) => r && (r.totalAssets || r.totalDebts));
    if (known.length < 1) return null;
    const a = known[0];
    const b = known[known.length - 1];
    return { a, b, nw: b.netWorth - a.netWorth, assets: b.totalAssets - a.totalAssets, debts: b.totalDebts - a.totalDebts };
  }, [nwRows, lastMonth]);

  if (!data || !calc) {
    return (
      <div className="card">
        <Loading text={`Putting together more details for ${year}…`} />
      </div>
    );
  }
  if (!calc.active.length) return null;

  const T = Math.max(calc.totIn, calc.totExp + calc.totInv, 1);
  const parts = [
    { key: 'exp', label: 'Spent', v: calc.totExp, c: TYPE_COLORS.expense },
    { key: 'inv', label: 'Invested', v: calc.totInv, c: TYPE_COLORS.investment },
    ...(calc.totSaved > 0 ? [{ key: 'sav', label: 'Kept (not spent or invested)', v: calc.totSaved, c: TYPE_COLORS.saved }] : []),
  ];
  const monthLabels = MONTH_LABELS.map((m) => m[0]);

  return (
    <section className="review-details" aria-label="More details">
      <h2 className="review-details-title">The details</h2>
      <div className="vx-grid">
        <VxCard
          title={calc.totIn > 0 ? `Out of ${hideAmounts ? 'every ₹100' : compact(calc.totIn)} that came in` : 'Where the money went'}
          subtitle={calc.totIn > 0 ? 'Exact split of your inflow for the year' : 'Add inflow to see the split'}
          wide
        >
          <div className="flow-bar">
            {parts.map((p) => (
              <span key={p.key} className="flow-seg is-active" style={{ width: `${(p.v / T) * 100}%`, background: p.c }} />
            ))}
          </div>
          <ul className="rd-split">
            {parts.map((p) => (
              <li key={p.key}>
                <i style={{ background: p.c }} />
                <span>{p.label}</span>
                <b>{fmt(p.v)}</b>
                <em>{calc.totIn > 0 ? `${pct1(p.v, calc.totIn)}%` : ''}</em>
              </li>
            ))}
            {calc.totSaved < 0 && (
              <li className="bad">
                <i style={{ background: '#f43f5e' }} />
                <span>Spent + invested beyond inflow</span>
                <b>{fmt(-calc.totSaved)}</b>
                <em />
              </li>
            )}
          </ul>
          <p className="vx-hint">
            Per month on average: {fmt(calc.totIn / calc.monthsCount)} in · {fmt(calc.totExp / calc.monthsCount)} spent ·{' '}
            {fmt(calc.totInv / calc.monthsCount)} invested
          </p>
        </VxCard>

        <VxCard
          title="Saved each month"
          subtitle={
            calc.best && calc.worst
              ? `Best ${MONTH_LABELS[calc.best.i]} (${calc.best.rate}%) · lowest ${MONTH_LABELS[calc.worst.i]} (${calc.worst.rate}%)`
              : 'Savings rate = (inflow − spent) ÷ inflow'
          }
          wide
        >
          <MonthBars
            labels={monthLabels}
            values={calc.perMonth.map((m) => (m.i < lastMonth ? m.rate ?? 0 : 0))}
            color={(v) => (v >= 30 ? '#22c55e' : v >= 10 ? '#eab308' : '#f43f5e')}
            format={(v) => `${v}`}
            compact={(v) => `${Math.round(v)}%`}
            suffix="%"
            hideAmounts={false}
            height={170}
          />
          <div className="rd-table-wrap no-swipe">
            <table className="rd-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>In</th>
                  <th>Spent</th>
                  <th>Invested</th>
                  <th>Saved</th>
                </tr>
              </thead>
              <tbody>
                {calc.active.map((m) => (
                  <tr key={m.i}>
                    <td>{MONTH_LABELS[m.i]}</td>
                    <td>{compact(m.inn)}</td>
                    <td className="exp">{compact(m.exp)}</td>
                    <td className="inv">{compact(m.inv)}</td>
                    <td className={m.saved >= 0 ? 'good' : 'bad'}>
                      {compact(m.saved)}
                      {m.rate != null && <small> {m.rate}%</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </VxCard>

        {nwStory && nwRows && (
          <VxCard title="Net worth & debt this year" subtitle="Assets up, debts down, net worth as the line" wide>
            <ul className="rd-story">
              <li className={nwStory.nw >= 0 ? 'good' : 'bad'}>
                Net worth {nwStory.nw >= 0 ? 'grew' : 'fell'} by <b>{fmt(Math.abs(nwStory.nw))}</b> ({compact(nwStory.a.netWorth)} → {compact(nwStory.b.netWorth)})
              </li>
              <li className={nwStory.debts <= 0 ? 'good' : 'bad'}>
                Debt {nwStory.debts <= 0 ? 'came down' : 'went up'} by <b>{fmt(Math.abs(nwStory.debts))}</b>
                {nwStory.a.totalDebts > 0 && ` (${Math.round((Math.abs(nwStory.debts) / nwStory.a.totalDebts) * 100)}%)`} ({compact(nwStory.a.totalDebts)} → {compact(nwStory.b.totalDebts)})
              </li>
              <li className={nwStory.assets >= 0 ? 'good' : 'bad'}>
                Assets {nwStory.assets >= 0 ? 'grew' : 'fell'} by <b>{fmt(Math.abs(nwStory.assets))}</b> ({compact(nwStory.a.totalAssets)} → {compact(nwStory.b.totalAssets)})
              </li>
            </ul>
            <NetWorthTrend rows={nwRows.map((r) => r || { totalAssets: 0, totalDebts: 0, netWorth: 0 })} stop={Math.max(1, lastMonth)} />
          </VxCard>
        )}

        <VxCard
          title={catType === 'expense' ? 'Spending breakdown' : 'Investment breakdown'}
          subtitle={`Share of the year · average per month${catRows.some((r) => r.prev != null) ? ` · marker = ${year - 1}` : ''}`}
          right={
            <div className="vx-controls">
              <Segmented value={catType} onChange={setCatType} options={[{ value: 'expense', label: 'Spend' }, { value: 'investment', label: 'Invest' }]} />
              <Segmented value={catKey} onChange={setCatKey} options={[{ value: 'category', label: 'Category' }, { value: 'tag', label: 'Tag' }]} />
            </div>
          }
          wide
        >
          {catRows.length ? (
            <>
              <CompareBars
                rows={catRows.slice(0, 12).map((r) => ({ ...r, prev: r.prev }))}
                format={fmt}
                total={catRows.reduce((s, r) => s + r.value, 0)}
                hideAmounts={hideAmounts}
                upIsGood={catType === 'investment'}
                deltaLabel={`vs ${year - 1}`}
                newLabel={`New in ${year}`}
              />
              <ul className="rd-avg">
                {catRows.slice(0, 12).map((r) => (
                  <li key={r.name}>
                    <span>{r.name}</span>
                    <b>{fmt(r.avg)}/mo</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyChart text="Nothing recorded." />
          )}
        </VxCard>

        {calc.ess + calc.nonEss > 0 && (
          <VxCard title="Needs vs wants" subtitle="Expenses you marked essential vs non-essential">
            <div className="flow-bar">
              <span className="flow-seg is-active" style={{ width: `${pct1(calc.ess, calc.totExp)}%`, background: '#0ea5e9' }} />
              <span className="flow-seg is-active" style={{ width: `${pct1(calc.nonEss, calc.totExp)}%`, background: '#f97316' }} />
            </div>
            <ul className="rd-split">
              <li>
                <i style={{ background: '#0ea5e9' }} />
                <span>Essential</span>
                <b>{fmt(calc.ess)}</b>
                <em>{pct1(calc.ess, calc.totExp)}%</em>
              </li>
              <li>
                <i style={{ background: '#f97316' }} />
                <span>Non-essential</span>
                <b>{fmt(calc.nonEss)}</b>
                <em>{pct1(calc.nonEss, calc.totExp)}%</em>
              </li>
              {calc.totExp - calc.ess - calc.nonEss > 0 && (
                <li>
                  <i style={{ background: '#64748b' }} />
                  <span>Not marked</span>
                  <b>{fmt(calc.totExp - calc.ess - calc.nonEss)}</b>
                  <em>{pct1(calc.totExp - calc.ess - calc.nonEss, calc.totExp)}%</em>
                </li>
              )}
            </ul>
          </VxCard>
        )}

        {calc.biggest.length > 0 && (
          <VxCard title="5 biggest expenses" subtitle="Single entries">
            <ol className="rd-biggest">
              {calc.biggest.map((t) => {
                const d = new Date(t.date);
                return (
                  <li key={t._id}>
                    <span>
                      {t.category}
                      <small>
                        {MONTH_LABELS[d.getUTCMonth()]} {txDay(t)}
                        {t.description ? ` · ${t.description}` : ''}
                      </small>
                    </span>
                    <b>{fmt(t.amount)}</b>
                  </li>
                );
              })}
            </ol>
          </VxCard>
        )}
      </div>
      {!hideAmounts && calc.totSaved !== 0 && (
        <p className="muted small rd-foot">
          {signed(Math.round(calc.totSaved))} left after spending and investing in {year}
          {lastMonth < 12 && year === today.getFullYear() ? ' so far' : ''}.
        </p>
      )}
    </section>
  );
}
