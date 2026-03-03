import { Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

function MonthlyCharts({ monthSummary }) {
  const { totalExpense, totalInvestment, categories } = monthSummary || {
    totalExpense: 0,
    totalInvestment: 0,
    categories: [],
  };

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

  const hasData = totalExpense + totalInvestment > 0;

  return (
    <div className="charts-grid">
      <div className="card chart-card">
        <h3>Investment vs Expense</h3>
        {hasData ? (
          <Doughnut data={investVsExpenseData} />
        ) : (
          <p className="muted small">Add some entries to see the ratio.</p>
        )}
      </div>
      <div className="card chart-card">
        <h3>By category</h3>
        {categories.length > 0 ? (
          <Pie data={categoryData} />
        ) : (
          <p className="muted small">No category data yet for this month.</p>
        )}
      </div>
    </div>
  );
}

export default MonthlyCharts;

