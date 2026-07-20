import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { aggregateByTag } from '../utils/aggregateByTag';
import { formatSharePct } from '../utils/formatSharePct';
import CollapsibleChartCard from './CollapsibleChartCard';
import LineChartFrame from './LineChartFrame';
import TrendLineWidthToggle from './TrendLineWidthToggle';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  ChartDataLabels
);

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6', '#64748b'];

function useIsMobile(maxWidth = 640) {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}

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

function getPrevMonthLabel(monthNum) {
  if (monthNum <= 1) return null;
  return MONTH_NAMES[monthNum - 1];
}

function ChangeVsPrevSub({ prevVal, currVal, kind, prevLabel }) {
  if (!prevLabel) {
    return <span className="bs-vs-prev bs-vs-neutral">First month (Jan)</span>;
  }
  const prev = Number(prevVal) || 0;
  const curr = Number(currVal) || 0;
  const diff = curr - prev;

  if (prev === 0 && curr !== 0) {
    return (
      <span className="bs-vs-prev bs-vs-neutral">
        New this month ({prevLabel} was ₹0)
      </span>
    );
  }

  if (diff === 0) {
    return <span className="bs-vs-prev bs-vs-neutral">Same as {prevLabel}</span>;
  }

  const pct = prev !== 0 ? (diff / prev) * 100 : null;
  let cls = 'bs-vs-neutral';
  if (kind === 'assets' || kind === 'netWorth') {
    if (diff > 0) cls = 'bs-vs-good';
    else if (diff < 0) cls = 'bs-vs-bad';
  } else if (kind === 'debts') {
    if (diff < 0) cls = 'bs-vs-good';
    else if (diff > 0) cls = 'bs-vs-bad';
  }

  const arrow = diff > 0 ? '↑' : '↓';
  const absAmt = `₹${Math.abs(diff).toLocaleString('en-IN')}`;
  const pctPart = pct != null ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : '';

  return (
    <span
      className={`bs-vs-prev ${cls}`}
      title={`${prevLabel}: ₹${prev.toLocaleString('en-IN')} → ₹${curr.toLocaleString('en-IN')}`}
    >
      {arrow} {absAmt}
      {pctPart} vs {prevLabel}
    </span>
  );
}

function LatestSnapshot({ monthLabel, year, row, prevRow, prevMonthLabel }) {
  const ta = Number(row.totalAssets) || 0;
  const td = Number(row.totalDebts) || 0;
  const nw = Number(row.netWorth) || 0;

  return (
    <div className="bs-latest-snapshot">
      <p className="bs-latest-title">
        Latest · <strong>{monthLabel} {year}</strong>
      </p>
      <div className="bs-latest-grid">
        <div className="bs-latest-stat bs-latest-stat-assets">
          <span className="bs-latest-stat-label">Assets</span>
          <span className="bs-latest-stat-amt">₹{ta.toLocaleString('en-IN')}</span>
          {prevRow && (
            <ChangeVsPrevSub
              prevVal={prevRow.totalAssets}
              currVal={ta}
              kind="assets"
              prevLabel={prevMonthLabel}
            />
          )}
        </div>
        <div className="bs-latest-stat bs-latest-stat-debts">
          <span className="bs-latest-stat-label">Debts</span>
          <span className="bs-latest-stat-amt">₹{td.toLocaleString('en-IN')}</span>
          {prevRow && (
            <ChangeVsPrevSub
              prevVal={prevRow.totalDebts}
              currVal={td}
              kind="debts"
              prevLabel={prevMonthLabel}
            />
          )}
        </div>
        <div className={`bs-latest-stat bs-latest-stat-nw ${nw >= 0 ? 'positive' : 'negative'}`}>
          <span className="bs-latest-stat-label">Net worth</span>
          <span className="bs-latest-stat-amt">₹{nw.toLocaleString('en-IN')}</span>
          {prevRow && (
            <ChangeVsPrevSub
              prevVal={prevRow.netWorth}
              currVal={nw}
              kind="netWorth"
              prevLabel={prevMonthLabel}
            />
          )}
        </div>
      </div>
      <p className="bs-latest-formula muted small">Net worth = Assets − Debts</p>
    </div>
  );
}

/**
 * Months to show in table / bar charts: only months with saved sheet or non-zero totals.
 */
function getVisibleMonthNumbers(year, byMonth) {
  const allMonths = getAllChartMonthNumbers(year);
  return allMonths.filter((m) => monthHasBalanceData(byMonth[m]));
}

/** Jan through current month (current year) or full year (past years). */
function getAllChartMonthNumbers(year) {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  if (year > cy) return [];
  const endM = year < cy ? 12 : cm;
  return Array.from({ length: endM }, (_, i) => i + 1);
}

/** active = saved this month; carried = forward from prior month; empty = no data */
function getLineMonthStatus(row) {
  if (!row) return 'empty';
  if (row.saved) return 'active';
  const ta = Number(row.totalAssets) || 0;
  const td = Number(row.totalDebts) || 0;
  if (ta > 0 || td > 0) return 'carried';
  return 'empty';
}

function monthHasBalanceData(row) {
  return getLineMonthStatus(row) !== 'empty';
}

function lineChartValue(row, field) {
  const status = getLineMonthStatus(row);
  if (status === 'empty') return null;
  return Number(row?.[field]) || 0;
}

const LINE_COLOR_ASSETS = '#22c55e';
const LINE_COLOR_DEBTS = '#ef4444';
const LINE_COLOR_NET_WORTH = '#818cf8';
const LINE_COLOR_CARRIED = '#64748b';
const LINE_COLOR_CARRIED_FADED = 'rgba(100, 116, 139, 0.45)';

function lineAreaGradient(chart, topColor, bottomColor = 'rgba(0,0,0,0)') {
  const { ctx, chartArea } = chart;
  if (!chartArea) return topColor;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  return gradient;
}

function linePointRadius(status) {
  if (status === 'empty') return 0;
  if (status === 'active') return 5;
  return 3;
}

function ChartBreakdownList({ items, labelKey, total }) {
  if (!items?.length || !total) return null;
  return (
    <div className="chart-list-wrapper">
      <ul className="chart-list">
        {items.map((item) => {
          const value = Number(item.value) || 0;
          const pct = formatSharePct(value, total);
          return (
            <li key={item[labelKey]} className="chart-list-row">
              <span className="chart-list-label">{item[labelKey]}</span>
              <span className="chart-list-value">
                ₹{value.toLocaleString('en-IN')} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function buildTagPie(rows) {
  return {
    labels: rows.map((r) => r.tag),
    datasets: [{
      data: rows.map((r) => r.value),
      backgroundColor: PIE_COLORS,
      borderWidth: 0,
    }],
  };
}

const tagPieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    datalabels: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.raw || 0;
          const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
          const pct = formatSharePct(v, total);
          return `₹${Number(v).toLocaleString('en-IN')} (${pct}%)`;
        },
      },
    },
  },
};

function lineItemsForMonth(byMonth, field, monthNum) {
  const lines = byMonth[monthNum]?.[field] || [];
  const map = {};
  lines.forEach((i) => {
    const n = (i.name || '').trim();
    if (!n) return;
    map[n] = (map[n] || 0) + (Number(i.value) || 0);
  });
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildMixPiesByMonth(byMonth, field, monthNums, colorPalette) {
  const palette = colorPalette || PIE_COLORS;
  return monthNums
    .map((m) => {
      const items = lineItemsForMonth(byMonth, field, m);
      const total = items.reduce((s, i) => s + i.value, 0);
      if (total <= 0) return null;
      return {
        monthNum: m,
        monthLabel: MONTH_NAMES[m],
        items,
        total,
        pie: {
          labels: items.map((i) => i.name),
          datasets: [{
            data: items.map((i) => i.value),
            backgroundColor: items.map((_, idx) => palette[idx % palette.length]),
            borderWidth: 0,
          }],
        },
      };
    })
    .filter(Boolean);
}

function BalanceSheetYearSection({ year, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const isMobile = useIsMobile();

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
    lineChartMonthNums,
    chartMonths,
    lineChartMonths,
    lineMonthStatuses,
    assetsArr,
    debtsArr,
    lineAssetsArr,
    lineDebtsArr,
    lineNetWorthArr,
    netArr,
    hasAny,
    growthSummary,
    isFutureYear,
  } = useMemo(() => {
    if (!data) {
      return {
        byMonth: {},
        visibleMonthNums: [],
        lineChartMonthNums: [],
        chartMonths: [],
        lineChartMonths: [],
        lineMonthStatuses: [],
        assetsArr: [],
        debtsArr: [],
        lineAssetsArr: [],
        lineDebtsArr: [],
        lineNetWorthArr: [],
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
    const allMonthNums = getAllChartMonthNumbers(year);
    const months = monthNums.map((m) => MONTH_NAMES[m]);
    const lineMonths = allMonthNums.map((m) => MONTH_NAMES[m]);
    const aArr = monthNums.map((m) => {
      const row = bm[m] || {};
      return Number(row.totalAssets) || 0;
    });
    const dArr = monthNums.map((m) => {
      const row = bm[m] || {};
      return Number(row.totalDebts) || 0;
    });
    const lineStatuses = allMonthNums.map((m) => getLineMonthStatus(bm[m]));
    const lineAArr = allMonthNums.map((m) => lineChartValue(bm[m], 'totalAssets'));
    const lineDArr = allMonthNums.map((m) => lineChartValue(bm[m], 'totalDebts'));
    const lineNArr = allMonthNums.map((m) => lineChartValue(bm[m], 'netWorth'));
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
      lineChartMonthNums: allMonthNums,
      chartMonths: months,
      lineChartMonths: lineMonths,
      lineMonthStatuses: lineStatuses,
      assetsArr: aArr,
      debtsArr: dArr,
      lineAssetsArr: lineAArr,
      lineDebtsArr: lineDArr,
      lineNetWorthArr: lineNArr,
      netArr: nArr,
      hasAny: any,
      growthSummary: gSummary,
      isFutureYear: isFuture,
    };
  }, [data, year]);

  const lineData = useMemo(() => {
    const pointColor = (ctx, activeColor) => {
      const status = lineMonthStatuses[ctx.dataIndex];
      if (status === 'active') return activeColor;
      if (status === 'carried') return LINE_COLOR_CARRIED;
      return 'transparent';
    };
    const segmentStyle = (ctx, activeColor) => {
      const i = ctx.p1DataIndex;
      const status = lineMonthStatuses[i];
      if (status === 'active') return activeColor;
      if (status === 'carried') return LINE_COLOR_CARRIED_FADED;
      return 'transparent';
    };

    return {
      labels: lineChartMonths,
      datasets: [
        {
          label: 'Assets',
          data: lineAssetsArr,
          borderColor: LINE_COLOR_ASSETS,
          backgroundColor: (ctx) =>
            lineAreaGradient(ctx.chart, 'rgba(34, 197, 94, 0.32)', 'rgba(34, 197, 94, 0)'),
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: (ctx) => linePointRadius(lineMonthStatuses[ctx.dataIndex]),
          pointHoverRadius: 7,
          pointBorderWidth: 2,
          pointBackgroundColor: (ctx) => pointColor(ctx, LINE_COLOR_ASSETS),
          pointBorderColor: '#0f172a',
          segment: {
            borderColor: (ctx) => segmentStyle(ctx, LINE_COLOR_ASSETS),
            borderDash: (ctx) =>
              lineMonthStatuses[ctx.p1DataIndex] === 'carried' ? [6, 4] : undefined,
          },
          spanGaps: false,
        },
        {
          label: 'Debts',
          data: lineDebtsArr,
          borderColor: LINE_COLOR_DEBTS,
          backgroundColor: (ctx) =>
            lineAreaGradient(ctx.chart, 'rgba(239, 68, 68, 0.22)', 'rgba(239, 68, 68, 0)'),
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: (ctx) => linePointRadius(lineMonthStatuses[ctx.dataIndex]),
          pointHoverRadius: 7,
          pointBorderWidth: 2,
          pointBackgroundColor: (ctx) => pointColor(ctx, LINE_COLOR_DEBTS),
          pointBorderColor: '#0f172a',
          segment: {
            borderColor: (ctx) => segmentStyle(ctx, LINE_COLOR_DEBTS),
            borderDash: (ctx) =>
              lineMonthStatuses[ctx.p1DataIndex] === 'carried' ? [6, 4] : undefined,
          },
          spanGaps: false,
        },
        {
          label: 'Net worth',
          data: lineNetWorthArr,
          borderColor: LINE_COLOR_NET_WORTH,
          backgroundColor: (ctx) =>
            lineAreaGradient(ctx.chart, 'rgba(129, 140, 248, 0.18)', 'rgba(129, 140, 248, 0)'),
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: (ctx) => linePointRadius(lineMonthStatuses[ctx.dataIndex]),
          pointHoverRadius: 7,
          pointBorderWidth: 2,
          pointBackgroundColor: (ctx) => pointColor(ctx, LINE_COLOR_NET_WORTH),
          pointBorderColor: '#0f172a',
          segment: {
            borderColor: (ctx) => segmentStyle(ctx, LINE_COLOR_NET_WORTH),
            borderDash: (ctx) =>
              lineMonthStatuses[ctx.p1DataIndex] === 'carried' ? [6, 4] : undefined,
          },
          spanGaps: false,
        },
      ],
    };
  }, [lineChartMonths, lineAssetsArr, lineDebtsArr, lineNetWorthArr, lineMonthStatuses]);

  const assetMixPies = useMemo(
    () => buildMixPiesByMonth(byMonth, 'assets', visibleMonthNums, PIE_COLORS),
    [byMonth, visibleMonthNums]
  );
  const debtMixPies = useMemo(
    () => buildMixPiesByMonth(byMonth, 'debts', visibleMonthNums, PIE_COLORS.slice().reverse()),
    [byMonth, visibleMonthNums]
  );

  const tagChartData = useMemo(() => {
    const m = visibleMonthNums.length ? visibleMonthNums[visibleMonthNums.length - 1] : null;
    if (!m) return null;
    const row = byMonth[m];
    if (!row) return null;

    const assetsWithValue = (row.assets || []).filter(
      (a) => (a.name || '').trim() && (Number(a.value) || 0) > 0
    );
    const debtsWithValue = (row.debts || []).filter(
      (d) => (d.name || '').trim() && (Number(d.value) || 0) > 0
    );
    const assetsByTag = aggregateByTag(assetsWithValue);
    const debtsByTag = aggregateByTag(debtsWithValue);

    return {
      monthNum: m,
      monthLabel: MONTH_NAMES[m],
      totalAssets: Number(row.totalAssets) || 0,
      totalDebts: Number(row.totalDebts) || 0,
      assetsByTag,
      debtsByTag,
      hasAssetTags: assetsWithValue.some((a) => (a.tag || '').trim()),
      hasDebtTags: debtsWithValue.some((d) => (d.tag || '').trim()),
    };
  }, [byMonth, visibleMonthNums]);

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

  /** Line points: ₹ labels; skip empty months; gray for carried. */
  const datalabelsLine = {
    display: (ctx) => {
      const v = ctx.raw;
      const status = lineMonthStatuses[ctx.dataIndex];
      return v != null && status !== 'empty' && Math.abs(Number(v)) >= 1;
    },
    anchor: (ctx) => {
      if (ctx.datasetIndex === 0) return 'end';
      if (ctx.datasetIndex === 1) return 'start';
      return 'center';
    },
    align: (ctx) => {
      if (ctx.datasetIndex === 0) return 'top';
      if (ctx.datasetIndex === 1) return 'bottom';
      return 'right';
    },
    offset: (ctx) => (ctx.datasetIndex === 2 ? 6 : 4),
    color: (ctx) =>
      lineMonthStatuses[ctx.dataIndex] === 'carried' ? '#94a3b8' : '#cbd5e1',
    font: { size: 9, weight: '600' },
    formatter: (v) => compactInrAxis(v),
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

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      elements: {
        line: { borderCapStyle: 'round', borderJoinStyle: 'round' },
        point: { hoverBorderWidth: 3 },
      },
      layout: {
        padding: {
          top: isMobile ? 6 : 12,
          bottom: isMobile ? 4 : 8,
          left: isMobile ? 2 : 4,
          right: isMobile ? 6 : 10,
        },
      },
      plugins: {
        datalabels: isMobile ? { display: false } : datalabelsLine,
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 14,
            font: { size: 11, weight: '500' },
            color: '#cbd5e1',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.25)',
          borderWidth: 1,
          padding: 10,
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 11 },
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex;
              const label = items[0]?.label || '';
              const status = lineMonthStatuses[idx];
              if (status === 'carried') return `${label} (carried forward)`;
              if (status === 'empty') return label;
              return label;
            },
            label: (ctx) => {
              const v = ctx.raw;
              if (v == null) return undefined;
              return `${ctx.dataset.label}: ₹${Number(v).toLocaleString('en-IN')}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: (ctx) =>
              lineMonthStatuses[ctx.index] === 'active' ? '#e5e7eb' : '#64748b',
            maxRotation: 0,
            autoSkip: false,
            maxTicksLimit: 24,
            font: { size: isMobile ? 10 : 11 },
          },
          grid: { display: false },
          border: { color: 'rgba(148, 163, 184, 0.12)' },
        },
        y: {
          ticks: {
            color: '#9ca3af',
            maxTicksLimit: isMobile ? 5 : 6,
            font: { size: isMobile ? 10 : 11 },
            callback: (value) => compactInrAxis(value),
          },
          grid: { color: 'rgba(148, 163, 184, 0.1)' },
          border: { display: false },
        },
      },
    }),
    [lineMonthStatuses, datalabelsLine, isMobile]
  );

  if (loading || !data) {
    return (
      <div className="card balance-sheet-year-card">
        <div className="balance-sheet-header">
          <button
            type="button"
            className="section-header-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span className="section-header-chevron" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            <h2>Balance sheet · {year}</h2>
          </button>
        </div>
        {expanded && (
          <p className="muted small">{loading ? 'Loading…' : 'No data.'}</p>
        )}
      </div>
    );
  }

  const lastVisibleMonth = visibleMonthNums.length
    ? visibleMonthNums[visibleMonthNums.length - 1]
    : null;
  const lastRow = lastVisibleMonth ? byMonth[lastVisibleMonth] : null;

  return (
    <div className="card balance-sheet-year-card">
      <div className="balance-sheet-header">
        <button
          type="button"
          className="section-header-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="section-header-chevron" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          <h2>Balance sheet · {year}</h2>
          {!expanded && lastRow && (
            <span className="pill section-header-summary">
              Net ₹{Number(lastRow.netWorth || 0).toLocaleString('en-IN')}
            </span>
          )}
        </button>
      </div>
      {expanded && (
        <>
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
          <div className="balance-sheet-line-trend trend-line-card">
            <div className="trend-line-header">
              <div className="balance-sheet-line-trend-head">
                <h3 className="balance-sheet-year-subtitle balance-sheet-line-trend-title">
                  Assets, debts &amp; net worth over months
                </h3>
                <p className="muted small balance-sheet-line-legend">
                  Jan–{MONTH_NAMES[getAllChartMonthNumbers(year).slice(-1)[0] || 12]} shown.
                  <span className="legend-dot legend-dot-active" /> Saved month
                  <span className="legend-dot legend-dot-carried" /> Carried / no change
                  <span className="legend-dot legend-dot-empty" /> No data
                </p>
              </div>
              <TrendLineWidthToggle />
            </div>
            <LineChartFrame
              monthCount={lineChartMonthNums.length}
              className="balance-sheet-chart balance-sheet-line-chart"
            >
              <Line data={lineData} options={lineOptions} />
            </LineChartFrame>
          </div>
          {tagChartData && (tagChartData.hasAssetTags || tagChartData.hasDebtTags) && (
            <>
              <p className="muted small balance-sheet-tag-charts-note">
                Tag breakdown from latest month in view ({tagChartData.monthLabel} {year}).
              </p>
              <div className="balance-sheet-charts balance-sheet-tag-charts">
                {tagChartData.hasAssetTags && tagChartData.assetsByTag.length > 0 && (
                  <div className="balance-sheet-chart-card">
                    <h3>Assets by tag</h3>
                    <div className="balance-sheet-chart-wrap">
                      <Pie data={buildTagPie(tagChartData.assetsByTag)} options={tagPieOptions} />
                    </div>
                    <p className="chart-total">
                      Total: ₹{tagChartData.totalAssets.toLocaleString('en-IN')}
                    </p>
                    <ChartBreakdownList
                      items={tagChartData.assetsByTag}
                      labelKey="tag"
                      total={tagChartData.totalAssets}
                    />
                  </div>
                )}
                {tagChartData.hasDebtTags && tagChartData.debtsByTag.length > 0 && (
                  <div className="balance-sheet-chart-card">
                    <h3>Debts by tag</h3>
                    <div className="balance-sheet-chart-wrap">
                      <Pie
                        data={buildTagPie(tagChartData.debtsByTag)}
                        options={tagPieOptions}
                      />
                    </div>
                    <p className="chart-total">
                      Total: ₹{tagChartData.totalDebts.toLocaleString('en-IN')}
                    </p>
                    <ChartBreakdownList
                      items={tagChartData.debtsByTag}
                      labelKey="tag"
                      total={tagChartData.totalDebts}
                    />
                  </div>
                )}
              </div>
            </>
          )}
          <CollapsibleChartCard
            title="Assets, debts & net worth (bars)"
            chartTitle="Assets, debts & net worth (bars)"
            wide
          >
            <div className="balance-sheet-chart">
              <Bar data={barGroupedData} options={chartOptionsGrouped} />
            </div>
          </CollapsibleChartCard>
          <h3 className="balance-sheet-year-subtitle">Asset mix (% of total assets, each month)</h3>
          <p className="muted small">One pie per month — share of each asset line item.</p>
          {assetMixPies.length > 0 ? (
            <div className="balance-sheet-charts balance-sheet-mix-grid">
              {assetMixPies.map((m) => (
                <div key={m.monthNum} className="balance-sheet-chart-card">
                  <h3>{m.monthLabel} {year}</h3>
                  <div className="balance-sheet-chart-wrap">
                    <Pie data={m.pie} options={tagPieOptions} />
                  </div>
                  <p className="chart-total">Total: ₹{m.total.toLocaleString('en-IN')}</p>
                  <ChartBreakdownList items={m.items} labelKey="name" total={m.total} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No asset line items in view.</p>
          )}
          <CollapsibleChartCard
            title="Debt mix (% of total debt, each month)"
            chartTitle="Debt mix (% of total debt, each month)"
            wide
          >
            <p className="muted small">One pie per month — share of each debt line item.</p>
            {debtMixPies.length > 0 ? (
              <div className="balance-sheet-charts balance-sheet-mix-grid">
                {debtMixPies.map((m) => (
                  <div key={m.monthNum} className="balance-sheet-chart-card">
                    <h3>{m.monthLabel} {year}</h3>
                    <div className="balance-sheet-chart-wrap">
                      <Pie data={m.pie} options={tagPieOptions} />
                    </div>
                    <p className="chart-total">Total: ₹{m.total.toLocaleString('en-IN')}</p>
                    <ChartBreakdownList items={m.items} labelKey="name" total={m.total} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">No debt line items in view.</p>
            )}
          </CollapsibleChartCard>
          {lastRow && lastVisibleMonth && (
            <LatestSnapshot
              monthLabel={MONTH_NAMES[lastVisibleMonth]}
              year={year}
              row={lastRow}
              prevRow={getPrevMonthRow(byMonth, lastVisibleMonth)}
              prevMonthLabel={getPrevMonthLabel(lastVisibleMonth)}
            />
          )}
          <div className="bs-table-guide">
            <p className="bs-table-guide-title">How to read this table</p>
            <ul className="bs-table-guide-list muted small">
              <li>Each row is one month&apos;s balance sheet (saved or carried forward).</li>
              <li>
                <strong>Net worth</strong> = Assets minus Debts for that month.
              </li>
              <li>
                The <strong>vs previous month</strong> line shows what changed from the month before.
                Green is good (assets or net worth up, debts down).
              </li>
            </ul>
          </div>
          <div className="balance-sheet-year-table-wrap">
            <table className="balance-sheet-year-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Status</th>
                  <th>Assets</th>
                  <th className="balance-sheet-debt-col">Debts</th>
                  <th>Net worth</th>
                </tr>
              </thead>
              <tbody>
                {visibleMonthNums.map((m) => {
                  const row = byMonth[m] || { totalAssets: 0, totalDebts: 0, netWorth: 0, saved: false };
                  const label = MONTH_NAMES[m];
                  const prev = getPrevMonthRow(byMonth, m);
                  const prevLabel = getPrevMonthLabel(m);
                  const ta = Number(row.totalAssets) || 0;
                  const td = Number(row.totalDebts) || 0;
                  const nw = Number(row.netWorth) || 0;
                  return (
                    <tr key={m}>
                      <td className="bs-month-cell">{label}</td>
                      <td>
                        <span className={`bs-status-pill ${row.saved ? 'saved' : 'carried'}`}>
                          {row.saved ? 'Saved' : 'Carried'}
                        </span>
                      </td>
                      <td className="balance-sheet-has-sub">
                        <div className="balance-sheet-main-amt">₹{ta.toLocaleString('en-IN')}</div>
                        <ChangeVsPrevSub
                          prevVal={prev?.totalAssets}
                          currVal={ta}
                          kind="assets"
                          prevLabel={prev != null ? prevLabel : null}
                        />
                      </td>
                      <td className="balance-sheet-debt-cell balance-sheet-has-sub">
                        <div className="balance-sheet-main-amt">₹{td.toLocaleString('en-IN')}</div>
                        <ChangeVsPrevSub
                          prevVal={prev?.totalDebts}
                          currVal={td}
                          kind="debts"
                          prevLabel={prev != null ? prevLabel : null}
                        />
                      </td>
                      <td className={`balance-sheet-has-sub ${nw >= 0 ? 'positive' : 'negative'}`}>
                        <div className="balance-sheet-main-amt">₹{nw.toLocaleString('en-IN')}</div>
                        <ChangeVsPrevSub
                          prevVal={prev?.netWorth}
                          currVal={nw}
                          kind="netWorth"
                          prevLabel={prev != null ? prevLabel : null}
                        />
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
        </>
      )}
    </div>
  );
}

export default BalanceSheetYearSection;
