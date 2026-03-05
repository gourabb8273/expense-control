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

function CategoryList({ items, labelKey, valueKey }) {
  if (!items || items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);

  return (
    <div className="chart-list-wrapper">
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

function MonthlyCharts({ monthSummary, comparison }) {
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

  const currentInvestment = totalInvestment;
  const currentExpense = totalExpense;
  const prevInvestment = comparison?.prevInvestment || 0;
  const prevExpense = comparison?.prevExpense || 0;
  const avgInvestment = comparison?.avgInvestment || 0;
  const avgExpense = comparison?.avgExpense || 0;
  const hasComparison =
    !!comparison && (prevInvestment > 0 || prevExpense > 0 || avgInvestment > 0 || avgExpense > 0);

  const investVsExpenseItems = [
    { label: 'Investment', value: totalInvestment },
    { label: 'Expense', value: totalExpense },
  ];

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

  const optionsBar = {
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

  const optionsVerticalBar = {
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
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

  const maxInvestmentTag = Math.max(...(investmentTagBarData.datasets[0].data || [0]));
  const maxExpenseTag = Math.max(...(expenseTagBarData.datasets[0].data || [0]));
  const makeTagAxisMax = (maxValue) => {
    const v = Number(maxValue || 0);
    const withBuffer = v + 10000;
    const rounded = Math.ceil(withBuffer / 10000) * 10000;
    return Math.max(20000, rounded || 20000);
  };

  const makeTagBarOptions = (maxValue) => ({
    ...optionsBar,
    scales: {
      ...optionsBar.scales,
      x: {
        ...optionsBar.scales.x,
        suggestedMax: makeTagAxisMax(maxValue),
      },
    },
    plugins: {
      ...optionsBar.plugins,
      datalabels: {
        color: '#e5e7eb',
        anchor: 'end',
        align: 'end',
        font: { size: 9, weight: 'bold' },
        formatter: (value) => formatAmount(value),
      },
    },
  });

  const comparisonBarData = {
    labels: ['Investment', 'Expense'],
    datasets: [
      {
        label: 'Last month',
        data: [prevInvestment, prevExpense],
        backgroundColor: '#6b7280',
        maxBarThickness: 28,
      },
      {
        label: 'This month',
        data: [currentInvestment, currentExpense],
        backgroundColor: '#22c55e',
        maxBarThickness: 28,
      },
      {
        label: 'Year avg',
        data: [avgInvestment, avgExpense],
        backgroundColor: '#f97316',
        maxBarThickness: 28,
      },
    ],
  };

  const comparisonBarOptions = {
    ...optionsVerticalBar,
    plugins: {
      ...optionsVerticalBar.plugins,
      legend: { display: true, position: 'bottom' },
    },
  };

  return (
    <div className="charts-section monthly-charts">
      <div className="charts-grid">
        {hasComparison && (
          <div
            className="card chart-card chart-card-wide"
            data-chart-title="This month vs last & avg"
          >
            <h3>This month vs last & avg</h3>
            <Bar data={comparisonBarData} options={comparisonBarOptions} />
          </div>
        )}
        <div className="card chart-card" data-chart-title="Investment vs Expense">
          <h3>Investment vs Expense</h3>
          {hasData ? (
            <>
              <Doughnut data={investVsExpenseData} options={optionsPie} />
              <CategoryList items={investVsExpenseItems} labelKey="label" valueKey="value" />
            </>
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
            <>
              <Pie data={investmentPieData} options={optionsPie} />
              <CategoryList
                items={investmentCategories}
                labelKey="category"
                valueKey="total"
              />
            </>
          ) : (
            <p className="muted small">No investment entries this month.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Expense by category">
          <h3>Expense by category</h3>
          {expenseCategories.length > 0 ? (
            <>
              <Pie data={expensePieData} options={optionsPie} />
              <CategoryList
                items={expenseCategories}
                labelKey="category"
                valueKey="total"
              />
            </>
          ) : (
            <p className="muted small">No expense entries this month.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="By category (all)">
          <h3>By category (all)</h3>
          {categories.length > 0 ? (
            <>
              <Pie data={allCategoriesPieData} options={optionsPie} />
              <CategoryList
                items={categories}
                labelKey="category"
                valueKey="total"
              />
            </>
          ) : (
            <p className="muted small">No category data this month.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Investment by tag">
          <h3>Investment by tag</h3>
          {investmentByTag.length > 0 ? (
            <>
              <Pie data={investmentByTagPieData} options={optionsPie} />
              <CategoryList
                items={investmentByTag}
                labelKey="tag"
                valueKey="total"
              />
            </>
          ) : (
            <p className="muted small">Tag investment entries for this chart.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Expense by tag">
          <h3>Expense by tag</h3>
          {expenseByTag.length > 0 ? (
            <>
              <Pie data={expenseByTagPieData} options={optionsPie} />
              <CategoryList
                items={expenseByTag}
                labelKey="tag"
                valueKey="total"
              />
            </>
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
        <div className="card chart-card chart-card-wide" data-chart-title="Investment categories (bar)">
          <h3>Investment categories (bar)</h3>
          {investmentCategoryBarLabels.length > 0 ? (
            <Bar data={investmentCategoryBarData} options={optionsBar} />
          ) : (
            <p className="muted small">No investment category data this month.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Expense categories (bar)">
          <h3>Expense categories (bar)</h3>
          {expenseCategoryBarLabels.length > 0 ? (
            <Bar data={expenseCategoryBarData} options={optionsBar} />
          ) : (
            <p className="muted small">No expense category data this month.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Investment by tag (bar)">
          <h3>Investment by tag (bar)</h3>
          {investmentTagBarLabels.length > 0 ? (
            <Bar data={investmentTagBarData} options={makeTagBarOptions(maxInvestmentTag)} />
          ) : (
            <p className="muted small">No investment tag data this month.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Expense by tag (bar)">
          <h3>Expense by tag (bar)</h3>
          {expenseTagBarLabels.length > 0 ? (
            <Bar data={expenseTagBarData} options={makeTagBarOptions(maxExpenseTag)} />
          ) : (
            <p className="muted small">No expense tag data this month.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MonthlyCharts;
