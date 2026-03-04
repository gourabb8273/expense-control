import { Bar, Pie, Line } from 'react-chartjs-2';
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
  Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels
);

function formatAmount(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6'];

function YearlyCharts({ yearly }) {
  if (!yearly) {
    return null;
  }

  const { monthly = [], categories = [], investmentCategories = [], expenseCategories = [], investmentByTag = [], expenseByTag = [] } = yearly;

  const monthLabels = monthly.map((m) =>
    new Date(2000, m.month - 1, 1).toLocaleString('default', { month: 'short' })
  );

  const hasYearData =
    monthly.some((m) => m.totalInvestment > 0 || m.totalExpense > 0) ||
    categories.length > 0;

  if (!hasYearData) {
    return (
      <div className="card chart-card">
        <h3>Year charts</h3>
        <p className="muted small">Add entries in this year to see charts.</p>
      </div>
    );
  }

  const barData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'Investment',
        data: monthly.map((m) => m.totalInvestment),
        backgroundColor: '#22c55e',
        maxBarThickness: 22,
      },
      {
        label: 'Expense',
        data: monthly.map((m) => m.totalExpense),
        backgroundColor: '#f97316',
        maxBarThickness: 22,
      },
    ],
  };

  const lineData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'Investment',
        data: monthly.map((m) => m.totalInvestment),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Expense',
        data: monthly.map((m) => m.totalExpense),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const investmentPieData = {
    labels: investmentCategories.map((c) => c.category),
    datasets: [
      {
        data: investmentCategories.map((c) => c.total),
        backgroundColor: PIE_COLORS,
        borderWidth: 0,
      },
    ],
  };

  const expensePieData = {
    labels: expenseCategories.map((c) => c.category),
    datasets: [
      {
        data: expenseCategories.map((c) => c.total),
        backgroundColor: PIE_COLORS,
        borderWidth: 0,
      },
    ],
  };

  const categoryBarLabels = categories.slice(0, 10).map((c) => c.category);
  const categoryBarData = {
    labels: categoryBarLabels,
    datasets: [
      {
        label: 'Amount (₹)',
        data: categories.slice(0, 10).map((c) => c.total),
        backgroundColor: '#6366f1',
        maxBarThickness: 28,
      },
    ],
  };

  const allCategoriesPieData = {
    labels: categories.map((c) => c.category),
    datasets: [{ data: categories.map((c) => c.total), backgroundColor: PIE_COLORS, borderWidth: 0 }],
  };

  const investmentByTagPieData = {
    labels: investmentByTag.map((c) => c.tag),
    datasets: [{ data: investmentByTag.map((c) => c.total), backgroundColor: PIE_COLORS, borderWidth: 0 }],
  };

  const expenseByTagPieData = {
    labels: expenseByTag.map((c) => c.tag),
    datasets: [{ data: expenseByTag.map((c) => c.total), backgroundColor: PIE_COLORS, borderWidth: 0 }],
  };

  const datalabelsBar = {
    color: '#fff',
    font: { weight: 'bold', size: 9 },
    formatter: (value) => formatAmount(value),
    anchor: 'end',
    align: 'end',
    offset: 2,
  };

  const optionsPie = {
    plugins: { datalabels: { display: false } },
  };

  const optionsHorizontalBar = {
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      datalabels: datalabelsBar,
    },
    scales: {
      x: { ticks: { color: '#9ca3af' } },
      y: { ticks: { color: '#9ca3af' } },
    },
  };

  const optionsBarGrouped = {
    plugins: {
      datalabels: datalabelsBar,
    },
  };

  const optionsLine = {
    plugins: {
      datalabels: {
        color: '#0f172a',
        font: { size: 9 },
        formatter: (value) => formatAmount(value),
        anchor: 'end',
        align: 'top',
      },
    },
    scales: {
      x: { ticks: { color: '#9ca3af' } },
      y: { ticks: { color: '#9ca3af' } },
    },
  };

  return (
    <div className="charts-section yearly-charts">
      <div className="charts-grid">
        <div className="card chart-card" data-chart-title="Per month · Investment vs Expense">
          <h3>Per month · Investment vs Expense</h3>
          <Bar data={barData} options={optionsBarGrouped} />
        </div>
        <div className="card chart-card" data-chart-title="Trend (line)">
          <h3>Trend (line)</h3>
          <Line data={lineData} options={optionsLine} />
        </div>
        <div className="card chart-card" data-chart-title="Investment by category (year)">
          <h3>Investment by category (year)</h3>
          {investmentCategories.length > 0 ? (
            <Pie data={investmentPieData} options={optionsPie} />
          ) : (
            <p className="muted small">No investment data this year.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Expense by category (year)">
          <h3>Expense by category (year)</h3>
          {expenseCategories.length > 0 ? (
            <Pie data={expensePieData} options={optionsPie} />
          ) : (
            <p className="muted small">No expense data this year.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="By category (all, year)">
          <h3>By category (all, year)</h3>
          {categories.length > 0 ? (
            <Pie data={allCategoriesPieData} options={optionsPie} />
          ) : (
            <p className="muted small">No category data this year.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Investment by tag (year)">
          <h3>Investment by tag (year)</h3>
          {investmentByTag.length > 0 ? (
            <Pie data={investmentByTagPieData} options={optionsPie} />
          ) : (
            <p className="muted small">Tag investment entries for this chart.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Expense by tag (year)">
          <h3>Expense by tag (year)</h3>
          {expenseByTag.length > 0 ? (
            <Pie data={expenseByTagPieData} options={optionsPie} />
          ) : (
            <p className="muted small">Tag expense entries for this chart.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Top categories (year)">
          <h3>Top categories (year)</h3>
          {categoryBarLabels.length > 0 ? (
            <Bar data={categoryBarData} options={optionsHorizontalBar} />
          ) : (
            <p className="muted small">No category data this year.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default YearlyCharts;
