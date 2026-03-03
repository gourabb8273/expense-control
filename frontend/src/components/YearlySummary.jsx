function YearlySummary({ yearly }) {
  if (!yearly) {
    return null;
  }

  const { year, monthly, categories } = yearly;

  const totalExpenseYear = monthly.reduce((sum, m) => sum + m.totalExpense, 0);
  const totalInvestmentYear = monthly.reduce((sum, m) => sum + m.totalInvestment, 0);

  return (
    <div className="card yearly-summary">
      <h2>Year overview · {year}</h2>
      <div className="year-grid">
        <div className="year-totals">
          <div className="kpi">
            <span className="kpi-label">Total investment</span>
            <span className="kpi-value">₹{totalInvestmentYear.toLocaleString()}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Total expenses</span>
            <span className="kpi-value">₹{totalExpenseYear.toLocaleString()}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Net (invest - expense)</span>
            <span className="kpi-value">
              ₹{(totalInvestmentYear - totalExpenseYear).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="year-categories">
          <h3>Top categories</h3>
          {categories.length === 0 && <p className="muted small">No yearly data yet.</p>}
          {categories.slice(0, 6).map((c) => (
            <div key={c.category} className="category-row">
              <span>{c.category}</span>
              <span>₹{c.total.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="month-strip">
        {monthly.map((m) => (
          <div key={m.month} className="month-pill">
            <span className="month-name">
              {new Date(2000, m.month - 1, 1).toLocaleString('default', { month: 'short' })}
            </span>
            <span className="month-values">
              ₹{m.totalInvestment.toLocaleString()} / ₹{m.totalExpense.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default YearlySummary;

