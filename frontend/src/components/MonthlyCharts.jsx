import { useMemo, useState } from 'react';
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

function ChartTotal({ amount, label = 'Total' }) {
  if (amount == null || Number(amount) === 0) return null;
  return (
    <p className="chart-total">
      {label}: {formatAmount(Number(amount))}
    </p>
  );
}

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

function parseDescriptionBreakdown(description) {
  if (!description || typeof description !== 'string') return null;
  const parts = description.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const items = [];
  parts.forEach((part) => {
    const idx = part.lastIndexOf('-');
    if (idx === -1) return;
    const label = part.slice(0, idx).trim();
    const valueStr = part.slice(idx + 1).trim();
    const value = Number(valueStr);
    if (!label || Number.isNaN(value)) return;
    items.push({ label, value });
  });

  if (items.length === 0) return null;
  const total = items.reduce((sum, x) => sum + (x.value || 0), 0);
  if (total <= 0) return null;
  return { items, total };
}

function TitleTagBreakdownCard({ title, breakdown, emptyText, transactions = [], txType }) {
  const tags = useMemo(
    () => (Array.isArray(breakdown) ? breakdown.map((b) => b.tag).filter(Boolean) : []),
    [breakdown]
  );
  const [selectedTag, setSelectedTag] = useState(() => tags[0] || '');

  const effectiveSelectedTag = useMemo(() => {
    if (selectedTag && tags.includes(selectedTag)) return selectedTag;
    return tags[0] || '';
  }, [selectedTag, tags]);

  const selected = useMemo(() => {
    if (!effectiveSelectedTag) return null;
    return (breakdown || []).find((b) => b.tag === effectiveSelectedTag) || null;
  }, [breakdown, effectiveSelectedTag]);

  const items = useMemo(() => {
    const types = selected?.types || [];
    return types.map((t) => ({ type: t.label, total: t.total }));
  }, [selected]);

  const pieData = useMemo(
    () => ({
      labels: items.map((x) => x.type),
      datasets: [
        {
          data: items.map((x) => x.total),
          backgroundColor: PIE_COLORS,
          borderWidth: 0,
        },
      ],
    }),
    [items]
  );

  const [selectedType, setSelectedType] = useState('');

  const descriptionBreakdown = useMemo(() => {
    if (!effectiveSelectedTag || !selectedType || !Array.isArray(transactions) || !txType) {
      return null;
    }
    const titleRegex = /^\s*([^-\n]+?)\s*-\s*([^-\n]+?)\s*$/;
    const matchingTx = transactions.filter((tx) => {
      if (!tx || tx.type !== txType || !tx.category) return false;
      const m = String(tx.category).match(titleRegex);
      if (!m) return false;
      const tag = m[1].trim();
      const kind = m[2].trim();
      return tag === effectiveSelectedTag && kind === selectedType;
    });
    if (matchingTx.length === 0) return null;

    const map = new Map();
    let totalFromDescriptions = 0;

    matchingTx.forEach((tx) => {
      const parsed = parseDescriptionBreakdown(tx.description || '');
      if (!parsed) return;
      totalFromDescriptions += parsed.total || 0;
      parsed.items.forEach((item) => {
        const prev = map.get(item.label) || 0;
        map.set(item.label, prev + (item.value || 0));
      });
    });

    if (map.size === 0) return null;

    const rows = Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    rows.sort((a, b) => (b.value || 0) - (a.value || 0));

    const chartTotalForType = items.find((x) => x.type === selectedType)?.total || 0;
    const diff = chartTotalForType - totalFromDescriptions;
    const matches = Math.round(chartTotalForType) === Math.round(totalFromDescriptions);

    return {
      rows,
      totalFromDescriptions,
      chartTotalForType,
      diff,
      matches,
    };
  }, [effectiveSelectedTag, selectedType, transactions, txType, items]);

  const handleRowClick = (typeLabel) => {
    setSelectedType((prev) => (prev === typeLabel ? '' : typeLabel));
  };

  const handleCardClick = (event) => {
    const row = event.target.closest('.chart-list-row');
    if (!row) {
      setSelectedType('');
    }
  };

  return (
    <div className="card chart-card" data-chart-title={title} onClick={handleCardClick}>
      <div className="chart-header-row">
        <h3 style={{ marginBottom: 0 }}>{title}</h3>
        {tags.length > 0 && (
          <select
            value={effectiveSelectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="chart-select"
            title="Select destination"
          >
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>
      {tags.length > 0 && items.length > 0 ? (
        <>
          <Pie data={pieData} options={{ plugins: { datalabels: { display: false } } }} />
          <div className="chart-list-wrapper">
            <ul className="chart-list">
              {items.map((item) => {
                const value = Number(item.total) || 0;
                const totalAll = items.reduce((sum, x) => sum + (Number(x.total) || 0), 0);
                const percent = totalAll ? Math.round((value / totalAll) * 100) : 0;
                const isSelected = selectedType === item.type;
                return (
                  <li
                    key={item.type}
                    className={`chart-list-row${isSelected ? ' chart-list-row-selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(item.type)}
                  >
                    <span className="chart-list-label">
                      {item.type} {isSelected ? '· details' : ''}
                    </span>
                    <span className="chart-list-value">
                      {formatAmount(value)} {percent ? `(${percent}%)` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <ChartTotal amount={items.reduce((s, x) => s + (x.total || 0), 0)} />
          {descriptionBreakdown && (
            <div className="desc-breakdown" style={{ marginTop: '0.4rem' }}>
              <p className="desc-breakdown-title">
                Breakdown for:&nbsp;
                <strong>{effectiveSelectedTag || '-'}</strong>
                {selectedType ? ` \u2013 ${selectedType}` : ''}
                {txType ? ` (${txType})` : ''}
              </p>
              <ul className="desc-breakdown-list">
                {descriptionBreakdown.rows.map((row) => (
                  <li key={row.label} className="desc-breakdown-row">
                    <span className="desc-breakdown-label">{row.label}</span>
                    <span className="desc-breakdown-value">
                      {formatAmount(row.value)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="desc-breakdown-summary">
                Breakdown from descriptions: {formatAmount(descriptionBreakdown.totalFromDescriptions)}{' '}
                {descriptionBreakdown.matches ? (
                  <span className="desc-breakdown-ok">(matches chart total)</span>
                ) : (
                  <span className="desc-breakdown-mismatch">
                    (diff vs chart: {formatAmount(descriptionBreakdown.diff)})
                  </span>
                )}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="muted small">{emptyText}</p>
      )}
    </div>
  );
}

function MonthlyCharts({ monthSummary, comparison, transactions = [] }) {
  const {
    totalExpense = 0,
    totalInvestment = 0,
    categories = [],
    investmentCategories = [],
    expenseCategories = [],
    investmentByTag = [],
    expenseByTag = [],
    investmentTitleTagBreakdown = [],
    expenseTitleTagBreakdown = [],
  } = monthSummary || {};

  const hasData = totalExpense + totalInvestment > 0;

  const currentInvestment = totalInvestment;
  const currentExpense = totalExpense;
  const prevInvestment = comparison?.prevInvestment || 0;
  const prevExpense = comparison?.prevExpense || 0;
  const avgInvestment = comparison?.avgInvestment || 0;
  const avgExpense = comparison?.avgExpense || 0;
  const cashflowCurrent = comparison?.cashflowCurrent ?? 0;
  const cashflowPrev = comparison?.cashflowPrev ?? 0;
  const cashflowAvg = comparison?.cashflowAvg ?? 0;
  const hasComparison =
    !!comparison &&
    (prevInvestment > 0 || prevExpense > 0 || avgInvestment > 0 || avgExpense > 0 ||
     cashflowCurrent > 0 || cashflowPrev > 0 || cashflowAvg > 0);

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
    labels: ['Cashflow (entered)', 'Investment', 'Expense'],
    datasets: [
      {
        label: 'Last month',
        data: [cashflowPrev, prevInvestment, prevExpense],
        backgroundColor: '#6b7280',
        maxBarThickness: 28,
      },
      {
        label: 'This month',
        data: [cashflowCurrent, currentInvestment, currentExpense],
        backgroundColor: '#22c55e',
        maxBarThickness: 28,
      },
      {
        label: 'Year avg',
        data: [cashflowAvg, avgInvestment, avgExpense],
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
            <ChartTotal amount={currentInvestment + currentExpense} label="This month total" />
          </div>
        )}
        <div className="card chart-card" data-chart-title="Investment vs Expense">
          <h3>Investment vs Expense</h3>
          {hasData ? (
            <>
              <Doughnut data={investVsExpenseData} options={optionsPie} />
              <CategoryList items={investVsExpenseItems} labelKey="label" valueKey="value" />
              <ChartTotal amount={totalInvestment + totalExpense} />
            </>
          ) : (
            <p className="muted small">Add entries to see the ratio.</p>
          )}
        </div>
        <div className="card chart-card" data-chart-title="Totals (bar)">
          <h3>Totals (bar)</h3>
          {hasData ? (
            <>
              <Bar data={totalsBarData} options={optionsVerticalBar} />
              <ChartTotal amount={totalInvestment + totalExpense} />
            </>
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
              <ChartTotal amount={investmentCategories.reduce((s, c) => s + (c.total || 0), 0)} />
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
              <ChartTotal amount={expenseCategories.reduce((s, c) => s + (c.total || 0), 0)} />
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
              <ChartTotal amount={categories.reduce((s, c) => s + (c.total || 0), 0)} />
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
              <ChartTotal amount={investmentByTag.reduce((s, t) => s + (t.total || 0), 0)} />
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
              <ChartTotal amount={expenseByTag.reduce((s, t) => s + (t.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">Tag expense entries for this chart.</p>
          )}
        </div>
        <TitleTagBreakdownCard
          title="Expense by destination (title)"
          breakdown={expenseTitleTagBreakdown}
          txType="expense"
          transactions={transactions}
          emptyText="Use title like “puri - hotel” to see destination breakdown."
        />
        <TitleTagBreakdownCard
          title="Investment by destination (title)"
          breakdown={investmentTitleTagBreakdown}
          txType="investment"
          transactions={transactions}
          emptyText="Use title like “gold - sip” to see destination breakdown."
        />
        <div className="card chart-card chart-card-wide" data-chart-title="Top categories (all)">
          <h3>Top categories (all)</h3>
          {categoryBarLabels.length > 0 ? (
            <>
              <Bar data={categoryBarData} options={optionsBar} />
              <ChartTotal amount={categories.slice(0, 10).reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No category data this month.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Investment categories (bar)">
          <h3>Investment categories (bar)</h3>
          {investmentCategoryBarLabels.length > 0 ? (
            <>
              <Bar data={investmentCategoryBarData} options={optionsBar} />
              <ChartTotal amount={investmentCategories.reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No investment category data this month.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Expense categories (bar)">
          <h3>Expense categories (bar)</h3>
          {expenseCategoryBarLabels.length > 0 ? (
            <>
              <Bar data={expenseCategoryBarData} options={optionsBar} />
              <ChartTotal amount={expenseCategories.reduce((s, c) => s + (c.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No expense category data this month.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Investment by tag (bar)">
          <h3>Investment by tag (bar)</h3>
          {investmentTagBarLabels.length > 0 ? (
            <>
              <Bar data={investmentTagBarData} options={makeTagBarOptions(maxInvestmentTag)} />
              <ChartTotal amount={investmentByTag.reduce((s, t) => s + (t.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No investment tag data this month.</p>
          )}
        </div>
        <div className="card chart-card chart-card-wide" data-chart-title="Expense by tag (bar)">
          <h3>Expense by tag (bar)</h3>
          {expenseTagBarLabels.length > 0 ? (
            <>
              <Bar data={expenseTagBarData} options={makeTagBarOptions(maxExpenseTag)} />
              <ChartTotal amount={expenseByTag.reduce((s, t) => s + (t.total || 0), 0)} />
            </>
          ) : (
            <p className="muted small">No expense tag data this month.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MonthlyCharts;
