import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function BalanceSheetYearSection({ year }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!year) return;
    setLoading(true);
    api
      .get(`/balance-sheet/year/${year}`)
      .then((res) => setData(res.data))
      .catch(() => setData({ year, byMonth: {} }))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading || !data) {
    return (
      <div className="card balance-sheet-year-card">
        <h2>Balance sheet · {year}</h2>
        <p className="muted small">{loading ? 'Loading…' : 'No data.'}</p>
      </div>
    );
  }

  const { byMonth = {} } = data;
  const months = [];
  const assetsArr = [];
  const debtsArr = [];
  const netArr = [];
  for (let m = 1; m <= 12; m++) {
    months.push(MONTH_NAMES[m]);
    const row = byMonth[m] || { totalAssets: 0, totalDebts: 0, netWorth: 0 };
    assetsArr.push(row.totalAssets);
    debtsArr.push(row.totalDebts);
    netArr.push(row.netWorth);
  }

  const hasAny = assetsArr.some((a) => a > 0) || debtsArr.some((d) => d > 0);

  const chartData = {
    labels: months,
    datasets: [
      { label: 'Assets', data: assetsArr, backgroundColor: '#22c55e', maxBarThickness: 20 },
      { label: 'Debts', data: debtsArr, backgroundColor: '#f97316', maxBarThickness: 20 },
      { label: 'Net worth', data: netArr, backgroundColor: '#6366f1', maxBarThickness: 20 },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      datalabels: { display: false },
    },
    scales: {
      x: { ticks: { color: '#9ca3af' } },
      y: { ticks: { color: '#9ca3af' } },
    },
  };

  let growthSummary = null;
  if (hasAny) {
    const firstIdx = netArr.findIndex((_, i) => assetsArr[i] !== 0 || debtsArr[i] !== 0);
    const lastIdx = (() => {
      let idx = -1;
      for (let i = 0; i < 12; i++) {
        if (assetsArr[i] !== 0 || debtsArr[i] !== 0) {
          idx = i;
        }
      }
      return idx;
    })();
    if (firstIdx !== -1 && lastIdx !== -1 && lastIdx >= firstIdx) {
      const startNet = netArr[firstIdx] || 0;
      const lastNet = netArr[lastIdx] || 0;
      const totalChange = lastNet - startNet;
      const totalPct =
        startNet !== 0 ? (totalChange / Math.abs(startNet)) * 100 : null;

      const prevIdx = lastIdx > 0 ? lastIdx - 1 : -1;
      let monthChange = null;
      if (prevIdx >= 0) {
        const prevNet = netArr[prevIdx] || 0;
        const diff = lastNet - prevNet;
        const pct = prevNet !== 0 ? (diff / Math.abs(prevNet)) * 100 : null;
        monthChange = {
          diff,
          pct,
          fromLabel: MONTH_NAMES[prevIdx + 1],
          toLabel: MONTH_NAMES[lastIdx + 1],
        };
      }

      growthSummary = {
        totalChange,
        totalPct,
        monthChange,
        lastLabel: MONTH_NAMES[lastIdx + 1],
      };
    }
  }

  return (
    <div className="card balance-sheet-year-card">
      <h2>Balance sheet · {year}</h2>
      <p className="muted small">Month-wise assets, debts and net worth (from saved balance sheets).</p>
      {hasAny ? (
        <>
          {growthSummary && (
            <div className="balance-sheet-growth">
              <p className="muted small">
                Net worth change this year:{' '}
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
                  Last month vs previous ({growthSummary.monthChange.fromLabel} →{' '}
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
          <div className="balance-sheet-chart">
            <Bar data={chartData} options={chartOptions} />
          </div>
          {(() => {
            let lastIdx = -1;
            for (let i = 0; i < 12; i++) {
              if (assetsArr[i] !== 0 || debtsArr[i] !== 0) lastIdx = i;
            }
            const lastM = lastIdx >= 0 ? lastIdx + 1 : 12;
            const row = byMonth[lastM] || { totalAssets: 0, totalDebts: 0, netWorth: 0 };
            return (
              <p className="chart-total balance-sheet-year-total">
                Total (last month with data · {MONTH_NAMES[lastM]}): Assets ₹{row.totalAssets.toLocaleString('en-IN')} · Debts ₹{row.totalDebts.toLocaleString('en-IN')} · Net worth ₹{row.netWorth.toLocaleString('en-IN')}
              </p>
            );
          })()}
          <div className="balance-sheet-year-table-wrap">
            <table className="balance-sheet-year-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Assets</th>
                  <th>Debts</th>
                  <th>Net worth</th>
                </tr>
              </thead>
              <tbody>
                {months.map((label, i) => {
                  const m = i + 1;
                  const row = byMonth[m] || { totalAssets: 0, totalDebts: 0, netWorth: 0 };
                  return (
                    <tr key={m}>
                      <td>{label}</td>
                      <td>₹{row.totalAssets.toLocaleString()}</td>
                      <td>₹{row.totalDebts.toLocaleString()}</td>
                      <td className={row.netWorth >= 0 ? 'positive' : 'negative'}>
                        ₹{row.netWorth.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="muted small">Save balance sheets in Month view to see year summary here.</p>
      )}
    </div>
  );
}

export default BalanceSheetYearSection;
