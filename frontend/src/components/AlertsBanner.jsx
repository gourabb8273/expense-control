import { formatInr } from '../utils/formatMoney';

export default function AlertsBanner({ alerts = [] }) {
  if (!alerts.length) return null;

  return (
    <div className="alerts-banner" role="region" aria-label="Alerts">
      {alerts.map((a) => (
        <div key={a.id} className={`alert-item alert-${a.severity || 'info'}`}>
          <span className="alert-icon" aria-hidden="true">
            {a.severity === 'warning' ? '⚠' : a.severity === 'success' ? '✓' : 'ℹ'}
          </span>
          <span className="alert-text">{a.message}</span>
        </div>
      ))}
    </div>
  );
}

export function buildMonthAlerts({
  inflow,
  expense,
  investment,
  remaining,
  balanceSheetSaved,
  balanceSheetCarried,
  pendingRecurringCount,
  untaggedExpenseAmount,
  netWorthDown,
  hideAmounts = false,
}) {
  const alerts = [];

  if (inflow > 0 && remaining < 0) {
    alerts.push({
      id: 'over-spent',
      severity: 'warning',
      message: `Spending exceeds inflow by ${formatInr(Math.abs(remaining), hideAmounts)} this month.`,
    });
  } else if (inflow > 0 && expense > inflow) {
    alerts.push({
      id: 'expense-over-inflow',
      severity: 'warning',
      message: 'Expenses alone are higher than cash inflow this month.',
    });
  }

  if (balanceSheetCarried && !balanceSheetSaved) {
    alerts.push({
      id: 'bs-carried',
      severity: 'info',
      message: 'Balance sheet is carried forward — save this month in Month view when you update it.',
    });
  }

  if (netWorthDown) {
    alerts.push({
      id: 'nw-down',
      severity: 'warning',
      message: 'Net worth is lower than last month.',
    });
  }

  if (pendingRecurringCount > 0) {
    alerts.push({
      id: 'recurring-pending',
      severity: 'info',
      message: `${pendingRecurringCount} recurring item${pendingRecurringCount > 1 ? 's' : ''} not added yet this month.`,
    });
  }

  if (untaggedExpenseAmount > 0) {
    alerts.push({
      id: 'untagged',
      severity: 'info',
      message: `${formatInr(untaggedExpenseAmount, hideAmounts)} in expenses has no tag.`,
    });
  }

  if (inflow > 0 && remaining >= 0 && investment + expense > 0) {
    alerts.push({
      id: 'healthy',
      severity: 'success',
      message: `${formatInr(remaining, hideAmounts)} left after investments and expenses.`,
    });
  }

  return alerts.slice(0, 4);
}
