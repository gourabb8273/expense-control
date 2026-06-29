const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pct(part, whole) {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export default function StickyMonthSummary({
  year,
  month,
  inflow,
  expense,
  investment,
  remaining,
  netWorth = 0,
  netWorthChange = null,
  loading,
}) {
  const monthLabel = MONTH_NAMES[month] || month;
  const outflow = expense + investment;
  const investPct = pct(investment, inflow);
  const expensePct = pct(expense, inflow);

  return (
    <div className="sticky-month-summary">
      <div className="sticky-month-inner">
        <span className="sticky-month-label">
          <strong>{monthLabel} {year}</strong>
        </span>
        {loading ? (
          <span className="muted small">Loading…</span>
        ) : (
          <>
            <span className="sticky-stat" title="Cash inflow">
              In <strong>₹{Number(inflow || 0).toLocaleString('en-IN')}</strong>
            </span>
            <span className="sticky-stat sticky-stat-exp" title="Expenses">
              Exp <strong>₹{Number(expense || 0).toLocaleString('en-IN')}</strong>
              {expensePct != null && <em>{expensePct}%</em>}
            </span>
            <span className="sticky-stat sticky-stat-inv" title="Investments">
              Inv <strong>₹{Number(investment || 0).toLocaleString('en-IN')}</strong>
              {investPct != null && <em>{investPct}%</em>}
            </span>
            <span className="sticky-stat sticky-stat-out" title="Total outflow">
              Out <strong>₹{Number(outflow || 0).toLocaleString('en-IN')}</strong>
            </span>
            <span
              className={`sticky-stat sticky-stat-rem ${remaining >= 0 ? 'positive' : 'negative'}`}
              title="Remaining after invest + expense"
            >
              Left <strong>₹{Number(remaining || 0).toLocaleString('en-IN')}</strong>
            </span>
            <span className="sticky-stat sticky-stat-nw" title="Net worth (assets − debts)">
              NW <strong>₹{Number(netWorth || 0).toLocaleString('en-IN')}</strong>
              {netWorthChange != null && (
                <em className={netWorthChange >= 0 ? 'positive' : 'negative'}>
                  {netWorthChange >= 0 ? '+' : '-'}₹{Math.abs(netWorthChange).toLocaleString('en-IN')}
                </em>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
