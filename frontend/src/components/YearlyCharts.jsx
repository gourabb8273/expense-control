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

function ChartTotal({ amount, label = 'Total' }) {
  if (amount == null || Number(amount) === 0) return null;
  return (
    <p className="chart-total">
      {label}: {formatAmount(Number(amount))}
    </p>
  );
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6'];

function CategoryList({ title, items, labelKey, valueKey }) {
  if (!items || items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);

  return (
    <div className="chart-list-wrapper">
      {title && <p className="chart-list-title">{title}</p>}
      <ul className="chart-list">
        {items.map((item) => {
          const value = Number(item[valueKey]) || 0;
          const percent = total ? Math.round((value / total) * 100) : 0;
          return (
            <li key={item[labelKey]} className="chart-list-row">
              <span className="chart-list-label">{item[labelKey]}</span>
              <span className="chart-list-value">
                {formatAmount(value)} {percent ? `(${percent}%)` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function YearlyCharts({ yearly, yearlyCashflow }) {
  if (!yearly) {
    return null;
  }

  const { monthly = [], categories = [], investmentCategories = [], expenseCategories = [], investmentByTag = [], expenseByTag = [] } = yearly;

  const monthLabels = monthly.map((m) =>
    new Date(2000, m.month - 1, 1).toLocaleString('default', { month: 'short' })
  );

  const allMonthLabels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) =>
    new Date(2000, m - 1, 1).toLocaleString('default', { month: 'short' })
  );
  const cashflowValues = (yearlyCashflow && yearlyCashflow.length >= 12)
    ? yearlyCashflow.slice(0, 12)
    : [...(yearlyCashflow || []), ...Array(12).fill(0)].slice(0, 12);
  const invByMonth = (m) => (monthly.find((x) => x.month === m) || {}).totalInvestment || 0;
  const expByMonth = (m) => (monthly.find((x) => x.month === m) || {}).totalExpense || 0;
  const yearCashflowBarData = {
    labels: allMonthLabels,
    datasets: [
      {
        label: 'Cashflow (entered)',
        data: cashflowValues,
        backgroundColor: '#3b82f6',
        maxBarThickness: 20,
      },
      {
        label: 'Investment',
        data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(invByMonth),
        backgroundColor: '#22c55e',
        maxBarThickness: 20,
      },
      {
        label: 'Expense',
        data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(expByMonth),
        backgroundColor: '#f97316',
        maxBarThickness: 20,
      },
    ],
  };

  const hasYearData =
    monthly.some((m) => m.totalInvestment > 0 || m.totalExpense > 0) ||
    categories.length > 0 ||
    cashflowValues.some((v) => v > 0);

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

  const investmentCategoryBarLabels = investmentCategories.slice(0, 10).map((c) => c.category);
  const investmentCategoryBarData = {
    labels: investmentCategoryBarLabels,
    datasets: [
      {
        label: 'Investment (₹)',
        data: investmentCategories.slice(0, 10).map((c) => c.total),
        backgroundColor: '#22c55e',
        maxBarThickness: 28,
      },
    ],
  };

  const expenseCategoryBarLabels = expenseCategories.slice(0, 10).map((c) => c.category);
  const expenseCategoryBarData = {
    labels: expenseCategoryBarLabels,
    datasets: [
      {
        label: 'Expense (₹)',
        data: expenseCategories.slice(0, 10).map((c) => c.total),
        backgroundColor: '#f97316',
        maxBarThickness: 28,
      },
    ],
  };

  const investmentTagBarLabels = investmentByTag.slice(0, 10).map((c) => c.tag);
  const investmentTagBarData = {
    labels: investmentTagBarLabels,
    datasets: [
      {
        label: 'Investment (₹)',
        data: investmentByTag.slice(0, 10).map((c) => c.total),
        backgroundColor: '#22c55e',
        maxBarThickness: 28,
      },
    ],
  };

  const expenseTagBarLabels = expenseByTag.slice(0, 10).map((c) => c.tag);
  const expenseTagBarData = {
    labels: expenseTagBarLabels,
    datasets: [
      {
        label: 'Expense (₹)',
        data: expenseByTag.slice(0, 10).map((c) => c.total),
        backgroundColor: '#f97316',
        maxBarThickness: 28,
      },
    ],
  };

  const totalInvestmentYear = monthly.reduce((s, m) => s + m.totalInvestment, 0);
  const totalExpenseYear = monthly.reduce((s, m) => s + m.totalExpense, 0);

  const maxInvestmentTag = Math.max(...(investmentTagBarData.datasets[0].data || [0]));
  const maxExpenseTag = Math.max(...(expenseTagBarData.datasets[0].data || [0]));
  const makeTagAxisMax = (maxValue) => {
    const v = Number(maxValue || 0);
    const withBuffer = v + 10000;
    const rounded = Math.ceil(withBuffer / 10000) * 10000;
    return Math.max(20000, rounded || 20000);
  };

  const optionsPie = {
    plugins: { datalabels: { display: false } },
  };

  const optionsHorizontalBar = {
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
    },
    scales: {
      x: { ticks: { color: '#9ca3af' } },
      y: { ticks: { color: '#9ca3af', autoSkip: false } },
    },
  };

  const makeTagBarHorizontalOptions = (maxValue) => ({
    ...optionsHorizontalBar,
    scales: {
      ...optionsHorizontalBar.scales,
      x: {
        ...optionsHorizontalBar.scales.x,
        suggestedMax: makeTagAxisMax(maxValue),
      },
    },
    plugins: {
      ...optionsHorizontalBar.plugins,
      datalabels: {
        color: '#e5e7eb',
        anchor: 'end',
        align: 'end',
        font: { size: 9, weight: 'bold' },
        formatter: (value) => formatAmount(value),
      },
    },
  });

  const optionsBarGrouped = {
    plugins: {
      datalabels: { display: false },
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af',
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        ticks: {
          color: '#9ca3af',
        },
      },
    },
  };

  const optionsLine = {
    plugins: {
      datalabels: {
        display: false,
      },
    },
    scales: {
      x: { ticks: { color: '#9ca3af' } },
      y: { ticks: { color: '#9ca3af' } },
    },
  };

  const yearCashflowTotal = cashflowValues.reduce((s, v) => s + v, 0);

  return (
    <div className="charts-section yearly-charts">
      <div className="charts-grid">
        <div className="card chart-card chart-card-wide" data-chart-title="Year cashflow">
          <h3>Year cashflow (Cashflow entered · Investment · Expense)</h3>
          <Bar data={yearCashflowBarData} options={{ ...optionsBarGrouped, plugins: { ...optionsBarGrouped.plugins, legend: { display: true, position: 'bottom' } } }} />
          <ChartTotal amount={yearCashflowTotal} label="Cashflow total (entered)" />
        </div>
        <div className="card chart-card" data-chart-title="Per month · Investment vs Expense">
          <h3>Per month · Investment vs Expense</h3>
          <Bar data={barData} options={optionsBarGrouped} />
          <ChartTotal amount={totalInvestmentYear + totalExpenseYear} label="Year total" />
        </div>
        <div className="card chart-card" data-chart-title="Trend (line)">
          <h3>Trend (line)</h3>
          <Line data={lineData} options={optionsLine} />
          <ChartTotal amount={totalInvestmentYear + totalExpenseYear} label="Year total" />
        </div>
        <div className="card chart-card" data-chart-title="Investment by category (year)">
          <h3>Investment by category (year)</h3>
          {investmentCategories.length > 0 ? (
            <>
              <Pie data={investmentPieData} options={optionsPie} />
              <CategoryList
                items={investmentCategories}
                labelKey="category"
                valueKey="total"
              />
              <ChartTotal amount={investmentCategories.reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No investment data this year.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Expense by category (year)">
          <h3>Expense by category (year)</h3>
          {expenseCategories.length > 0 ? (
            <>
              <Pie data={expensePieData} options={optionsPie} />
              <CategoryList
                items={expenseCategories}
                labelKey="category"
                valueKey="total"
              />
              <ChartTotal amount={expenseCategories.reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No expense data this year.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="By category (all, year)">
          <h3>By category (all, year)</h3>
          {categories.length > 0 ? (
            <>
              <Pie data={allCategoriesPieData} options={optionsPie} />
              <CategoryList
                items={categories}
                labelKey="category"
                valueKey="total"
              />
              <ChartTotal amount={categories.reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No category data this year.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Investment by tag (year)">
          <h3>Investment by tag (year)</h3>
          {investmentByTag.length > 0 ? (
            <>
              <Pie data={investmentByTagPieData} options={optionsPie} />
              <CategoryList
                items={investmentByTag}
                labelKey="tag"
                valueKey="total"
              />
              <ChartTotal amount={investmentByTag.reduce((s, t) => s + (t.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">Tag investment entries for this chart.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Expense by tag (year)">
          <h3>Expense by tag (year)</h3>
          {expenseByTag.length > 0 ? (
            <>
              <Pie data={expenseByTagPieData} options={optionsPie} />
              <CategoryList
                items={expenseByTag}
                labelKey="tag"
                valueKey="total"
              />
              <ChartTotal amount={expenseByTag.reduce((s, t) => s + (t.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">Tag expense entries for this chart.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Top categories (year)">
          <h3>Top categories (year)</h3>
          {categoryBarLabels.length > 0 ? (
            <>
              <Bar data={categoryBarData} options={optionsHorizontalBar} />
              <ChartTotal amount={categories.slice(0, 10).reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No category data this year.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Investment categories (bar, year)">
          <h3>Investment categories (bar, year)</h3>
          {investmentCategoryBarLabels.length > 0 ? (
            <>
              <Bar data={investmentCategoryBarData} options={optionsHorizontalBar} />
              <ChartTotal amount={investmentCategories.reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No investment category data this year.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Expense categories (bar, year)">
          <h3>Expense categories (bar, year)</h3>
          {expenseCategoryBarLabels.length > 0 ? (
            <>
              <Bar data={expenseCategoryBarData} options={optionsHorizontalBar} />
              <ChartTotal amount={expenseCategories.reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No expense category data this year.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Investment by tag (bar, year)">
          <h3>Investment by tag (bar, year)</h3>
          {investmentTagBarLabels.length > 0 ? (
            <>
              <Bar data={investmentTagBarData} options={makeTagBarHorizontalOptions(maxInvestmentTag)} />
              <ChartTotal amount={investmentByTag.reduce((s, t) => s + (t.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No investment tag data this year.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Expense by tag (bar, year)">
          <h3>Expense by tag (bar, year)</h3>
          {expenseTagBarLabels.length > 0 ? (
            <>
              <Bar data={expenseTagBarData} options={makeTagBarHorizontalOptions(maxExpenseTag)} />
              <ChartTotal amount={expenseByTag.reduce((s, t) => s + (t.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No expense tag data this year.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default YearlyCharts;
