import { useFormatMoney } from '../utils/formatMoney';

function pct(part, whole) {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function AllocationBar({ inflow = 0, investment = 0, expense = 0, className = '' }) {
  const remaining = inflow - investment - expense;
  const overBudget = remaining < 0;

  if (!inflow || inflow <= 0) {
    return (
      <div className={`allocation-bar-wrap allocation-bar-empty ${className}`.trim()}>
        <p className="muted small">Add cash inflow to see how it splits</p>
      </div>
    );
  }

  const investShare = (investment / inflow) * 100;
  const expenseShare = (expense / inflow) * 100;
  const remainShare = Math.max(0, (remaining / inflow) * 100);

  let wInvest = investShare;
  let wExpense = expenseShare;
  let wRemain = remainShare;

  if (overBudget) {
    const total = investShare + expenseShare;
    wInvest = total > 0 ? (investShare / total) * 100 : 50;
    wExpense = total > 0 ? (expenseShare / total) * 100 : 50;
    wRemain = 0;
  }

  return (
    <div className={`allocation-bar-wrap${overBudget ? ' is-over' : ''} ${className}`.trim()}>
      <div
        className="allocation-bar"
        role="img"
        aria-label={`Investment ${pct(investment, inflow) ?? 0}%, expense ${pct(expense, inflow) ?? 0}%`}
      >
        {wInvest > 0 && (
          <div className="allocation-bar-seg allocation-bar-invest" style={{ width: `${wInvest}%` }} />
        )}
        {wExpense > 0 && (
          <div className="allocation-bar-seg allocation-bar-expense" style={{ width: `${wExpense}%` }} />
        )}
        {wRemain > 0 && (
          <div className="allocation-bar-seg allocation-bar-remain" style={{ width: `${wRemain}%` }} />
        )}
      </div>
      <div className="allocation-bar-legend">
        <span>
          <i className="legend-swatch legend-invest" aria-hidden="true" />
          Invest {pct(investment, inflow) ?? 0}%
        </span>
        <span>
          <i className="legend-swatch legend-expense" aria-hidden="true" />
          Expense {pct(expense, inflow) ?? 0}%
        </span>
        <span>
          <i className={`legend-swatch ${overBudget ? 'legend-over' : 'legend-remain'}`} aria-hidden="true" />
          {overBudget ? 'Over budget' : `Left ${pct(Math.max(0, remaining), inflow) ?? 0}%`}
        </span>
      </div>
    </div>
  );
}

export function KpiWithPct({ label, amount, pctOfInflow, className = '' }) {
  const { inr } = useFormatMoney();
  return (
    <div className={`kpi kpi-with-pct ${className}`.trim()}>
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value ${className}`.trim()}>{inr(amount || 0)}</span>
      {pctOfInflow != null && (
        <span className="kpi-pct muted small">{pctOfInflow}% of inflow</span>
      )}
    </div>
  );
}

export default AllocationBar;
