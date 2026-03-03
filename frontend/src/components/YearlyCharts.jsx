import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

function YearlyCharts({ yearly }) {
  if (!yearly) {
    return null;
  }

  const { monthly, categories } = yearly;

  const monthLabels = monthly.map((m) =>
    new Date(2000, m.month - 1, 1).toLocaleString('default', { month: 'short' })
  );

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

  const categoryData = {
    labels: categories.map((c) => c.category),
    datasets: [
      {
        data: categories.map((c) => c.total),
        backgroundColor: [
          '#3b82f6',
          '#22c55e',
          '#f97316',
          '#a855f7',
          '#ec4899',
          '#eab308',
          '#0ea5e9',
        ],
        borderWidth: 0,
      },
    ],
  };

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

  return (
    <div className="charts-grid">
      <div className="card chart-card">
        <h3>Per month · investment vs expense</h3>
        <Bar data={barData} />
      </div>
      <div className="card chart-card">
        <h3>Year by category</h3>
        {categories.length > 0 ? (
          <Pie data={categoryData} />
        ) : (
          <p className="muted small">No category data yet for this year.</p>
        )}
      </div>
    </div>
  );
}

export default YearlyCharts;

