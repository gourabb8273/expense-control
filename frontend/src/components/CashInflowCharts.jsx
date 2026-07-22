import { useEffect, useMemo, useState } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { api } from '../services/api';
import CollapsibleChartCard from './CollapsibleChartCard';
import ChartTotal from './ChartTotal';
import { useFormatMoney } from '../utils/formatMoney';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartDataLabels
);

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6'];

function inflowTotal(inflows) {
  return (inflows || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function InflowBreakdownList({ sources, total }) {
  const { inr } = useFormatMoney();
  if (!sources?.length || !total) return null;
  return (
    <div className="chart-list-wrapper">
      <ul className="chart-list">
        {sources.map((row) => {
          const value = Number(row.amount) || 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
          return (
            <li key={row.label} className="chart-list-row">
              <span className="chart-list-label">{row.label}</span>
              <span className="chart-list-value">
                {inr(value)} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function buildPieFromSources(sources) {
  const rows = (sources || []).filter((s) => (Number(s.amount) || 0) > 0);
  return {
    labels: rows.map((s) => s.label),
    datasets: [
      {
        data: rows.map((s) => Number(s.amount) || 0),
        backgroundColor: PIE_COLORS,
        borderWidth: 0,
      },
    ],
  };
}

function MonthlyCashInflowCharts({ inflows = [], year, month }) {
  const { inr, hideAmounts } = useFormatMoney();
  const sources = useMemo(() => {
    const rows = (inflows || []).filter((r) => (Number(r.amount) || 0) > 0);
    return rows.map((r) => ({
      label: r.label || (r.kind === 'salary' ? 'Salary' : 'Other'),
      amount: Number(r.amount) || 0,
    }));
  }, [inflows]);

  const total = inflowTotal(sources);

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw || 0;
              const sum = ctx.dataset.data.reduce((s, x) => s + x, 0);
              const pct = sum ? Math.round((v / sum) * 100) : 0;
              return `${inr(v)} (${pct}%)`;
            },
          },
        },
      },
    }),
    [inr, hideAmounts]
  );

  if (total <= 0) return null;

  const pieData = buildPieFromSources(sources);
  const monthLabel = MONTH_NAMES[month] || month;
  const title = `Cash inflow by source · ${monthLabel} ${year}`;

  return (
    <div className="charts-section cash-inflow-charts">
      <div className="charts-grid">
        <CollapsibleChartCard title={title} chartTitle={title}>
          <div className="chart-wrap chart-wrap-pie">
            <Pie data={pieData} options={pieOptions} />
          </div>
          <ChartTotal amount={total} label="Total inflow" />
          <InflowBreakdownList sources={sources} total={total} />
        </CollapsibleChartCard>
      </div>
    </div>
  );
}

function YearlyCashInflowCharts({ year, refreshKey = 0 }) {
  const { inr, compact, chartLabel, hideAmounts } = useFormatMoney();
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!year) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .get('/cashflow/year/breakdown', { params: { year } })
      .then((res) => {
        if (!cancelled) setBreakdown(res.data);
      })
      .catch(() => {
        if (!cancelled) setBreakdown(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, refreshKey]);

  const { bySource, barData, barOptions, yearTotal, hasData } = useMemo(() => {
    if (!breakdown) {
      return { bySource: [], barData: null, barOptions: null, yearTotal: 0, hasData: false };
    }

    const sources = breakdown.bySource || [];
    const yearSum = sources.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (yearSum <= 0) {
      return { bySource: sources, barData: null, barOptions: null, yearTotal: 0, hasData: false };
    }

    const monthsWithData = (breakdown.months || []).filter((m) => (Number(m.total) || 0) > 0);
    const sourceLabels = sources.map((s) => s.label);

    const datasets = sourceLabels.map((label, idx) => ({
      label,
      data: monthsWithData.map((m) => {
        const row = (m.inflows || []).find((inf) => (inf.label || 'Other') === label);
        return row ? Number(row.amount) || 0 : 0;
      }),
      backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
      maxBarThickness: 22,
      stack: 'inflow',
    }));

    const bar = {
      labels: monthsWithData.map((m) => MONTH_NAMES[m.month] || m.month),
      datasets,
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${chartLabel(ctx.raw || 0)}`,
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          ticks: {
            callback: (v) => compact(v),
          },
        },
      },
    };

    return {
      bySource: sources,
      barData: monthsWithData.length > 0 && sourceLabels.length > 1 ? bar : null,
      barOptions: options,
      yearTotal: yearSum,
      hasData: true,
    };
  }, [breakdown, compact, chartLabel, hideAmounts]);

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw || 0;
              const pct = yearTotal ? Math.round((v / yearTotal) * 100) : 0;
              return `${inr(v)} (${pct}%)`;
            },
          },
        },
      },
    }),
    [inr, yearTotal, hideAmounts]
  );

  if (loading) {
    return (
      <div className="charts-section cash-inflow-charts">
        <p className="muted small">Loading cash inflow charts…</p>
      </div>
    );
  }

  if (!hasData) return null;

  const pieData = buildPieFromSources(bySource);
  const pieTitle = `Year cash inflow by source · ${year}`;

  return (
    <div className="charts-section cash-inflow-charts yearly-cash-inflow-charts">
      <div className="charts-grid">
        <CollapsibleChartCard title={pieTitle} chartTitle={pieTitle}>
          <div className="chart-wrap chart-wrap-pie">
            <Pie data={pieData} options={pieOptions} />
          </div>
          <ChartTotal amount={yearTotal} label="Total inflow (year)" />
          <InflowBreakdownList sources={bySource} total={yearTotal} />
          {barData && (
            <>
              <h4 className="cash-inflow-subchart-title">By source per month</h4>
              <div className="chart-wrap chart-wrap-bar">
                <Bar data={barData} options={barOptions} />
              </div>
            </>
          )}
        </CollapsibleChartCard>
      </div>
    </div>
  );
}

export { MonthlyCashInflowCharts, YearlyCashInflowCharts };
