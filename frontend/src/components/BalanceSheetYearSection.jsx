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

  return (
    <div className="card balance-sheet-year-card">
      <h2>Balance sheet · {year}</h2>
      <p className="muted small">Month-wise assets, debts and net worth (from saved balance sheets).</p>
      {hasAny ? (
        <>
          <div className="balance-sheet-chart">
            <Bar data={chartData} options={chartOptions} />
          </div>
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
