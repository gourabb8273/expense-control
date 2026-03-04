import { Doughnut, Pie, Bar } from 'react-chartjs-2';
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

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartDataLabels);

function formatAmount(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6'];

function MonthlyCharts({ monthSummary }) {
  const {
    totalExpense = 0,
    totalInvestment = 0,
    categories = [],
    investmentCategories = [],
    expenseCategories = [],
    investmentByTag = [],
    expenseByTag = [],
  } = monthSummary || {};

  const hasData = totalExpense + totalInvestment > 0;

  const investVsExpenseData = {
    labels: ['Investment', 'Expense'],
    datasets: [
      {
        data: [totalInvestment, totalExpense],
        backgroundColor: ['#22c55e', '#f97316'],
        borderWidth: 0,
      },
    ],
  };

  const totalsBarData = {
    labels: ['Investment', 'Expense'],
    datasets: [
      {
        label: '₹',
        data: [totalInvestment, totalExpense],
        backgroundColor: ['#22c55e', '#f97316'],
        maxBarThickness: 48,
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
    datasets: [
      {
        data: categories.map((c) => c.total),
        backgroundColor: PIE_COLORS,
        borderWidth: 0,
      },
    ],
  };

  const investmentByTagPieData = {
    labels: investmentByTag.map((c) => c.tag),
    datasets: [
      {
        data: investmentByTag.map((c) => c.total),
        backgroundColor: PIE_COLORS,
        borderWidth: 0,
      },
    ],
  };

  const expenseByTagPieData = {
    labels: expenseByTag.map((c) => c.tag),
    datasets: [
      {
        data: expenseByTag.map((c) => c.total),
        backgroundColor: PIE_COLORS,
        borderWidth: 0,
      },
    ],
  };

  const datalabelsBar = {
    color: '#fff',
    font: { weight: 'bold', size: 10 },
    formatter: (value) => formatAmount(value),
    anchor: 'end',
    align: 'end',
    offset: 2,
  };

  const optionsBar = {
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

  const optionsVerticalBar = {
    plugins: {
      legend: { display: false },
      datalabels: datalabelsBar,
    },
    scales: {
      x: { ticks: { color: '#9ca3af' } },
      y: { ticks: { color: '#9ca3af' } },
    },
  };

  const optionsPie = {
    plugins: {
      datalabels: { display: false },
    },
  };

  return (
    <div className="charts-section monthly-charts">
      <div className="charts-grid">
        <div className="card chart-card" data-chart-title="Investment vs Expense">
          <h3>Investment vs Expense</h3>
          {hasData ? (
            <Doughnut data={investVsExpenseData} options={optionsPie} />
          ) : (
            <p className="muted small">Add entries to see the ratio.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Totals (bar)">
          <h3>Totals (bar)</h3>
          {hasData ? (
            <Bar data={totalsBarData} options={optionsVerticalBar} />
          ) : (
            <p className="muted small">No data this month.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Investment by category">
          <h3>Investment by category</h3>
          {investmentCategories.length > 0 ? (
            <Pie data={investmentPieData} options={optionsPie} />
          ) : (
            <p className="muted small">No investment entries this month.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Expense by category">
          <h3>Expense by category</h3>
          {expenseCategories.length > 0 ? (
            <Pie data={expensePieData} options={optionsPie} />
          ) : (
            <p className="muted small">No expense entries this month.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="By category (all)">
          <h3>By category (all)</h3>
          {categories.length > 0 ? (
            <Pie data={allCategoriesPieData} options={optionsPie} />
          ) : (
            <p className="muted small">No category data this month.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Investment by tag">
          <h3>Investment by tag</h3>
          {investmentByTag.length > 0 ? (
            <Pie data={investmentByTagPieData} options={optionsPie} />
          ) : (
            <p className="muted small">Tag investment entries for this chart.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Expense by tag">
          <h3>Expense by tag</h3>
          {expenseByTag.length > 0 ? (
            <Pie data={expenseByTagPieData} options={optionsPie} />
          ) : (
            <p className="muted small">Tag expense entries for this chart.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Top categories (all)">
          <h3>Top categories (all)</h3>
          {categoryBarLabels.length > 0 ? (
            <Bar data={categoryBarData} options={optionsBar} />
          ) : (
            <p className="muted small">No category data this month.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MonthlyCharts;
