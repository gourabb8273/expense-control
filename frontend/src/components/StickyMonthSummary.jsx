const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pct(part, whole) {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function changeClass(diff, kind) {
  if (diff == null || diff === 0) return 'neutral';
  if (kind === 'debts') return diff < 0 ? 'positive' : 'negative';
  return diff >= 0 ? 'positive' : 'negative';
}

function ChangeDelta({ change, kind }) {
  if (change == null || change === 0) return null;
  const cls = changeClass(change, kind);
  return (
    <em className={cls}>
      {change >= 0 ? '+' : '-'}₹{Math.abs(change).toLocaleString('en-IN')}
    </em>
  );
}

export default function StickyMonthSummary({
  year,
  month,
  inflow,
  expense,
  investment,
  netWorth = 0,
  netWorthChange = null,
  totalAssets = 0,
  totalAssetsChange = null,
  totalDebts = 0,
  totalDebtsChange = null,
  loading,
}) {
  const monthLabel = MONTH_NAMES[month] || month;
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
            <span className="sticky-stat sticky-stat-in" title="Cash inflow">
              In <strong>₹{Number(inflow || 0).toLocaleString('en-IN')}</strong>
            </span>
            <span className="sticky-stat sticky-stat-inv" title="Investments">
              Inv <strong>₹{Number(investment || 0).toLocaleString('en-IN')}</strong>
              {investPct != null && <em>{investPct}%</em>}
            </span>
            <span className="sticky-stat sticky-stat-exp" title="Expenses">
              Exp <strong>₹{Number(expense || 0).toLocaleString('en-IN')}</strong>
              {expensePct != null && <em>{expensePct}%</em>}
            </span>
            <span className="sticky-stat sticky-stat-nw" title="Net worth (assets − debts)">
              NW <strong>₹{Number(netWorth || 0).toLocaleString('en-IN')}</strong>
              <ChangeDelta change={netWorthChange} kind="netWorth" />
            </span>
            <span className="sticky-stat sticky-stat-assets" title="Total assets">
              Assets <strong>₹{Number(totalAssets || 0).toLocaleString('en-IN')}</strong>
              <ChangeDelta change={totalAssetsChange} kind="assets" />
            </span>
            <span className="sticky-stat sticky-stat-debts" title="Total debts">
              Debts <strong>₹{Number(totalDebts || 0).toLocaleString('en-IN')}</strong>
              <ChangeDelta change={totalDebtsChange} kind="debts" />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
