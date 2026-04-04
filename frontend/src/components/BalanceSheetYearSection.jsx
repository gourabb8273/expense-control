import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  ChartDataLabels
);

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6', '#64748b'];
const DEBT_MIX_COLORS = ['#fecaca', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a'];

/** Rupee ticks short on axis; full amounts in tooltip. */
function compactInrAxis(value) {
  const n = Math.abs(Number(value) || 0);
  const sign = Number(value) < 0 ? '-' : '';
  if (n >= 1e7) return `${sign}₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${sign}₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${sign}₹${(n / 1e3).toFixed(0)}k`;
  if (n === 0) return '₹0';
  return `${sign}₹${Math.round(n)}`;
}

/** Compare to previous calendar month in the same year (Jan has no in-year prior). */
function getPrevMonthRow(byMonth, monthNum) {
  if (monthNum <= 1) return null;
  return byMonth[monthNum - 1] || null;
}

function MomDeltaCell({ prevAssetsOrDebts, currVal, kind }) {
  const p = Number(prevAssetsOrDebts);
  const c = Number(currVal) || 0;
  if (prevAssetsOrDebts === undefined || prevAssetsOrDebts === null) {
    return (
      <td className="balance-sheet-mom-cell">
        <span className="balance-sheet-mom-main balance-sheet-mom-neutral">—</span>
        <span className="balance-sheet-mom-pct balance-sheet-mom-neutral">no prior month</span>
      </td>
    );
  }
  const prev = Number.isFinite(p) ? p : 0;
  const diff = c - prev;
  const pct = prev !== 0 ? (diff / prev) * 100 : null;
  const pctStr = pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : prev === 0 && c !== 0 ? '—' : '0.0%';

  let mainClass = 'balance-sheet-mom-neutral';
  if (diff > 0) mainClass = kind === 'assets' ? 'balance-sheet-mom-good' : 'balance-sheet-mom-bad';
  else if (diff < 0) mainClass = kind === 'assets' ? 'balance-sheet-mom-bad' : 'balance-sheet-mom-good';

  const absStr = `${diff >= 0 ? '+' : '-'}₹${Math.abs(diff).toLocaleString('en-IN')}`;
  const tip =
    prev === 0 && c !== 0 && pct == null
      ? `Previous month was ₹0; change ₹${c.toLocaleString('en-IN')}`
      : `Previous month: ₹${prev.toLocaleString('en-IN')} → this month: ₹${c.toLocaleString('en-IN')}`;

  return (
    <td className="balance-sheet-mom-cell" title={tip}>
      <span className={`balance-sheet-mom-main ${mainClass}`}>{absStr}</span>
      <span className={`balance-sheet-mom-pct ${mainClass}`}>{pctStr}</span>
    </td>
  );
}

/**
 * Months to show: not after "today" for the selected year, not future years,
 * and only months with saved sheet or non-zero assets/debts (no leading empty months).
 */
function getVisibleMonthNumbers(year, byMonth) {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  let endM;
  if (year > cy) return [];
  if (year < cy) endM = 12;
  else endM = cm;

  const out = [];
  for (let m = 1; m <= endM; m += 1) {
    const row = byMonth[m] || { totalAssets: 0, totalDebts: 0, saved: false };
    const ta = Number(row.totalAssets) || 0;
    const td = Number(row.totalDebts) || 0;
    const saved = !!row.saved;
    if (saved || ta > 0 || td > 0) {
      out.push(m);
    }
  }
  return out;
}

function topLineNames(byMonth, field, topN, monthNums) {
  const totals = {};
  monthNums.forEach((m) => {
    const lines = byMonth[m]?.[field] || [];
    lines.forEach((i) => {
      const n = (i.name || '').trim();
      if (!n) return;
      totals[n] = (totals[n] || 0) + (Number(i.value) || 0);
    });
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);
}

function monthPercentsForField(byMonth, field, topNames, monthNums, colorPalette) {
  const labels = monthNums.map((m) => MONTH_NAMES[m]);
  const palette = colorPalette || PIE_COLORS;
  const datasets = topNames.map((name, idx) => ({
    label: name,
    data: [],
    backgroundColor: palette[idx % palette.length],
    stack: field,
  }));
  const otherDs = {
    label: 'Other',
    data: [],
    backgroundColor: '#475569',
    stack: field,
  };

  monthNums.forEach((m) => {
    const lines = byMonth[m]?.[field] || [];
    const map = {};
    lines.forEach((i) => {
      const n = (i.name || '').trim();
      if (!n) return;
      map[n] = (map[n] || 0) + (Number(i.value) || 0);
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    if (total <= 0) {
      datasets.forEach((ds) => ds.data.push(0));
      otherDs.data.push(0);
      return;
    }
    let topSum = 0;
    topNames.forEach((name, idx) => {
      const v = map[name] || 0;
      topSum += v;
      datasets[idx].data.push((v / total) * 100);
    });
    const other = Math.max(0, total - topSum);
    otherDs.data.push((other / total) * 100);
  });

  return { labels, datasets: [...datasets, otherDs] };
}

function BalanceSheetYearSection({ year, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!year) return;
    setLoading(true);
    let cancelled = false;
    api
      .get(`/balance-sheet/year/${year}`)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setData({ year, byMonth: {} });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, refreshKey]);

  const {
    byMonth = {},
    visibleMonthNums,
    chartMonths,
    assetsArr,
    debtsArr,
    netArr,
    hasAny,
    growthSummary,
    isFutureYear,
  } = useMemo(() => {
    if (!data) {
      return {
        byMonth: {},
        visibleMonthNums: [],
        chartMonths: [],
        assetsArr: [],
        debtsArr: [],
        netArr: [],
        hasAny: false,
        growthSummary: null,
        isFutureYear: false,
      };
    }
    const bm = data.byMonth || {};
    const now = new Date();
    const isFuture = year > now.getFullYear();

    const monthNums = getVisibleMonthNumbers(year, bm);
    const months = monthNums.map((m) => MONTH_NAMES[m]);
    const aArr = monthNums.map((m) => {
      const row = bm[m] || {};
      return Number(row.totalAssets) || 0;
    });
    const dArr = monthNums.map((m) => {
      const row = bm[m] || {};
      return Number(row.totalDebts) || 0;
    });
    const nArr = monthNums.map((m) => {
      const row = bm[m] || {};
      return Number(row.netWorth) || 0;
    });

    const any = monthNums.length > 0 && (aArr.some((a) => a > 0) || dArr.some((d) => d > 0));

    let gSummary = null;
    if (any && monthNums.length > 0) {
      const firstIdx = nArr.findIndex((_, i) => aArr[i] !== 0 || dArr[i] !== 0);
      let lastIdx = -1;
      for (let i = 0; i < nArr.length; i += 1) {
        if (aArr[i] !== 0 || dArr[i] !== 0) lastIdx = i;
      }
      if (firstIdx !== -1 && lastIdx !== -1 && lastIdx >= firstIdx) {
        const startNet = nArr[firstIdx] || 0;
        const lastNet = nArr[lastIdx] || 0;
        const totalChange = lastNet - startNet;
        const totalPct = startNet !== 0 ? (totalChange / Math.abs(startNet)) * 100 : null;
        const prevIdx = lastIdx > 0 ? lastIdx - 1 : -1;
        let monthChange = null;
        if (prevIdx >= 0) {
          const prevNet = nArr[prevIdx] || 0;
          const diff = lastNet - prevNet;
          const pct = prevNet !== 0 ? (diff / Math.abs(prevNet)) * 100 : null;
          monthChange = {
            diff,
            pct,
            fromLabel: months[prevIdx],
            toLabel: months[lastIdx],
          };
        }
        gSummary = {
          totalChange,
          totalPct,
          monthChange,
          lastLabel: months[lastIdx],
        };
      }
    }

    return {
      byMonth: bm,
      visibleMonthNums: monthNums,
      chartMonths: months,
      assetsArr: aArr,
      debtsArr: dArr,
      netArr: nArr,
      hasAny: any,
      growthSummary: gSummary,
      isFutureYear: isFuture,
    };
  }, [data, year]);

  const lineData = useMemo(
    () => ({
      labels: chartMonths,
      datasets: [
        {
          label: 'Assets',
          data: assetsArr,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
        {
          label: 'Debts',
          data: debtsArr,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    }),
    [chartMonths, assetsArr, debtsArr]
  );

  const assetTopNames = useMemo(
    () => topLineNames(byMonth, 'assets', 6, visibleMonthNums),
    [byMonth, visibleMonthNums]
  );
  const debtTopNames = useMemo(
    () => topLineNames(byMonth, 'debts', 6, visibleMonthNums),
    [byMonth, visibleMonthNums]
  );

  const assetMixData = useMemo(
    () => monthPercentsForField(byMonth, 'assets', assetTopNames, visibleMonthNums, PIE_COLORS),
    [byMonth, assetTopNames, visibleMonthNums]
  );
  const debtMixData = useMemo(
    () => monthPercentsForField(byMonth, 'debts', debtTopNames, visibleMonthNums, DEBT_MIX_COLORS),
    [byMonth, debtTopNames, visibleMonthNums]
  );

  const barGroupedData = useMemo(
    () => ({
      labels: chartMonths,
      datasets: [
        { label: 'Assets', data: assetsArr, backgroundColor: '#22c55e', maxBarThickness: 22 },
        { label: 'Debts', data: debtsArr, backgroundColor: '#ef4444', maxBarThickness: 22 },
        { label: 'Net worth', data: netArr, backgroundColor: '#6366f1', maxBarThickness: 22 },
      ],
    }),
    [chartMonths, assetsArr, debtsArr, netArr]
  );

  /** Visible on chart (not only tooltip): compact ₹ above each bar. */
  const datalabelsGroupedBar = {
    display: (ctx) => {
      const v = ctx.parsed?.y;
      return v != null && Math.abs(Number(v)) >= 1;
    },
    anchor: 'end',
    align: 'top',
    offset: 4,
    color: '#e2e8f0',
    font: { size: 9, weight: '600' },
    formatter: (v) => compactInrAxis(v),
  };

  /** Line points: ₹ labels; assets above, debts below to reduce overlap. */
  const datalabelsLine = {
    display: (ctx) => {
      const v = ctx.parsed?.y;
      return v != null && Math.abs(Number(v)) >= 1;
    },
    anchor: (ctx) => (ctx.datasetIndex === 0 ? 'end' : 'start'),
    align: (ctx) => (ctx.datasetIndex === 0 ? 'top' : 'bottom'),
    offset: 6,
    color: '#cbd5e1',
    font: { size: 9, weight: '600' },
    formatter: (v) => compactInrAxis(v),
  };

  /** Stacked 100%: show % inside segment when large enough to read. */
  const datalabelsStackPercent = {
    display: (ctx) => {
      const v = ctx.dataset.data[ctx.dataIndex];
      return typeof v === 'number' && v >= 2;
    },
    anchor: 'center',
    align: 'center',
    color: '#f8fafc',
    font: { size: 9, weight: '700' },
    formatter: (v) => `${Math.round(Number(v))}%`,
  };

  const axisTooltipCurrency = {
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw;
            if (ctx.dataset.label && ctx.dataset.stack === undefined && typeof v === 'number') {
              return `${ctx.dataset.label}: ₹${Number(v).toLocaleString('en-IN')}`;
            }
            return undefined;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 24,
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 6,
          callback: (value) => compactInrAxis(value),
        },
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
      },
    },
  };

  const chartOptionsGrouped = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 22 } },
    ...axisTooltipCurrency,
    plugins: {
      ...axisTooltipCurrency.plugins,
      datalabels: datalabelsGroupedBar,
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 18, bottom: 18 } },
    plugins: {
      datalabels: datalabelsLine,
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw || 0;
            return `${ctx.dataset.label}: ₹${Number(v).toLocaleString('en-IN')}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 24,
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 6,
          callback: (value) => compactInrAxis(value),
        },
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
      },
    },
  };

  const stackPctOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: datalabelsStackPercent,
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, padding: 8, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw || 0;
            return `${ctx.dataset.label}: ${v.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: '#9ca3af',
          maxRotation: 0,
          autoSkip: true,
        },
        grid: { display: false },
      },
      y: {
        stacked: true,
        max: 100,
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 6,
          callback: (v) => `${v}%`,
        },
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
      },
    },
  };

  if (loading || !data) {
    return (
      <div className="card balance-sheet-year-card">
        <h2>Balance sheet · {year}</h2>
        <p className="muted small">{loading ? 'Loading…' : 'No data.'}</p>
      </div>
    );
  }

  const lastVisibleMonth = visibleMonthNums.length
    ? visibleMonthNums[visibleMonthNums.length - 1]
    : null;
  const lastRow = lastVisibleMonth ? byMonth[lastVisibleMonth] : null;

  return (
    <div className="card balance-sheet-year-card">
      <h2>Balance sheet · {year}</h2>
      <p className="muted small">
        Showing months up to today with a saved sheet or non-zero totals. Future months appear when you reach
        them (defaults carry from the last saved month in Month view).
      </p>
      {isFutureYear && (
        <p className="muted small">This calendar year has not started yet — switch to the current year to see data.</p>
      )}
      {hasAny ? (
        <>
          {growthSummary && (
            <div className="balance-sheet-growth">
              <p className="muted small">
                Net worth change (shown months):{' '}
                <strong>
                  {growthSummary.totalChange >= 0 ? '+' : '-'}₹
                  {Math.abs(growthSummary.totalChange).toLocaleString()}
                </strong>
                {growthSummary.totalPct != null && (
                  <>
                    {' '}
                    (
                    {growthSummary.totalPct >= 0 ? '+' : '-'}
                    {Math.abs(growthSummary.totalPct).toFixed(1)}%)
                  </>
                )}
              </p>
              {growthSummary.monthChange && (
                <p className="muted small">
                  Last vs previous in view ({growthSummary.monthChange.fromLabel} →{' '}
                  {growthSummary.monthChange.toLabel}):{' '}
                  <strong>
                    {growthSummary.monthChange.diff >= 0 ? '+' : '-'}₹
                    {Math.abs(growthSummary.monthChange.diff).toLocaleString()}
                  </strong>
                  {growthSummary.monthChange.pct != null && (
                    <>
                      {' '}
                      (
                      {growthSummary.monthChange.pct >= 0 ? '+' : '-'}
                      {Math.abs(growthSummary.monthChange.pct).toFixed(1)}%)
                    </>
                  )}
                </p>
              )}
            </div>
          )}
          <h3 className="balance-sheet-year-subtitle">Assets &amp; debts over months (line)</h3>
          <div className="balance-sheet-chart balance-sheet-line-chart">
            <Line data={lineData} options={lineOptions} />
          </div>
          <h3 className="balance-sheet-year-subtitle">Assets, debts &amp; net worth (bars)</h3>
          <div className="balance-sheet-chart">
            <Bar data={barGroupedData} options={chartOptionsGrouped} />
          </div>
          <h3 className="balance-sheet-year-subtitle">Asset mix (% of total assets, each month)</h3>
          <div className="balance-sheet-chart balance-sheet-stack-chart">
            <Bar data={assetMixData} options={stackPctOptions} />
          </div>
          <h3 className="balance-sheet-year-subtitle">Debt mix (% of total debt, each month)</h3>
          <div className="balance-sheet-chart balance-sheet-stack-chart">
            <Bar data={debtMixData} options={stackPctOptions} />
          </div>
          {lastRow && (
            <p className="chart-total balance-sheet-year-total">
              Latest in view · {MONTH_NAMES[lastVisibleMonth]}: Assets ₹
              {lastRow.totalAssets.toLocaleString('en-IN')} · Debts ₹{lastRow.totalDebts.toLocaleString('en-IN')}{' '}
              · Net worth ₹{lastRow.netWorth.toLocaleString('en-IN')}
            </p>
          )}
          <p className="muted small balance-sheet-mom-hint">
            <strong>MoM</strong> = vs previous calendar month. First line is ₹ change; <strong>% below</strong>. Green/red:
            higher assets / lower debt is good. Under Assets &amp; Debts: % of that month&apos;s assets+debts total. Under Net
            worth: MoM % vs prior month.
          </p>
          <div className="balance-sheet-year-table-wrap">
            <table className="balance-sheet-year-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Saved?</th>
                  <th>Assets</th>
                  <th className="balance-sheet-debt-col">Debts</th>
                  <th>Assets MoM</th>
                  <th className="balance-sheet-debt-col">Debts MoM</th>
                  <th>Net worth</th>
                </tr>
              </thead>
              <tbody>
                {visibleMonthNums.map((m) => {
                  const row = byMonth[m] || { totalAssets: 0, totalDebts: 0, netWorth: 0, saved: false };
                  const label = MONTH_NAMES[m];
                  const prev = getPrevMonthRow(byMonth, m);
                  const prevA = prev != null ? prev.totalAssets : null;
                  const prevD = prev != null ? prev.totalDebts : null;
                  const ta = Number(row.totalAssets) || 0;
                  const td = Number(row.totalDebts) || 0;
                  const gross = ta + td;
                  const assetSharePct = gross > 0 ? (ta / gross) * 100 : null;
                  const debtSharePct = gross > 0 ? (td / gross) * 100 : null;
                  const nw = Number(row.netWorth) || 0;
                  let nwSub = null;
                  if (prev != null) {
                    const pnw = Number(prev.netWorth) || 0;
                    const diffNw = nw - pnw;
                    let cls = 'balance-sheet-mom-neutral';
                    if (diffNw > 0) cls = 'balance-sheet-mom-good';
                    else if (diffNw < 0) cls = 'balance-sheet-mom-bad';
                    if (pnw !== 0) {
                      const p = (diffNw / pnw) * 100;
                      nwSub = { text: `${p >= 0 ? '+' : ''}${p.toFixed(1)}% MoM`, cls };
                    } else if (pnw === 0 && nw === 0) {
                      nwSub = { text: '0.0% MoM', cls: 'balance-sheet-mom-neutral' };
                    } else {
                      nwSub = { text: '— MoM', cls: 'balance-sheet-mom-neutral' };
                    }
                  }
                  return (
                    <tr key={m}>
                      <td>{label}</td>
                      <td>{row.saved ? 'Yes' : 'Carried'}</td>
                      <td className="balance-sheet-has-sub">
                        <div className="balance-sheet-main-amt">₹{row.totalAssets.toLocaleString()}</div>
                        {assetSharePct != null && (
                          <div className="balance-sheet-pct-sub">{assetSharePct.toFixed(1)}% of total</div>
                        )}
                      </td>
                      <td className="balance-sheet-debt-cell balance-sheet-has-sub">
                        <div className="balance-sheet-main-amt">₹{row.totalDebts.toLocaleString()}</div>
                        {debtSharePct != null && (
                          <div className="balance-sheet-pct-sub balance-sheet-pct-sub-debt">
                            {debtSharePct.toFixed(1)}% of total
                          </div>
                        )}
                      </td>
                      <MomDeltaCell prevAssetsOrDebts={prevA} currVal={row.totalAssets} kind="assets" />
                      <MomDeltaCell prevAssetsOrDebts={prevD} currVal={row.totalDebts} kind="debts" />
                      <td
                        className={`balance-sheet-has-sub ${row.netWorth >= 0 ? 'positive' : 'negative'}`}
                      >
                        <div className="balance-sheet-main-amt">₹{row.netWorth.toLocaleString()}</div>
                        {nwSub && (
                          <div className={`balance-sheet-pct-sub ${nwSub.cls}`}>{nwSub.text}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="muted small">
          {isFutureYear
            ? 'Nothing to show for a future year.'
            : 'Save a balance sheet in Month view for this year to see rows and charts. Months with no data yet are hidden.'}
        </p>
      )}
    </div>
  );
}

export default BalanceSheetYearSection;
