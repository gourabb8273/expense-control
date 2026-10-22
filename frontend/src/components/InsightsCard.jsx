import { useFormatMoney } from '../utils/formatMoney';
import CollapsibleSection from './CollapsibleSection';
import {
  MONTH_SHORT,
  categoryChanges,
  projectMonthExpense,
  savingsRate,
  sumByType,
} from '../utils/insights';

export default function InsightsCard({ year, month, transactions, inflow, expense, previous, loading }) {
  const { inr, signed } = useFormatMoney();
  const prevLabel = previous ? MONTH_SHORT[previous.month - 1] : '';
  const prevTransactions = previous?.transactions || [];
  const prevExpense = sumByType(prevTransactions, 'expense');

  const rate = savingsRate(inflow, expense);
  const projection = projectMonthExpense(transactions, year, month);
  const changes = loading ? [] : categoryChanges(transactions, prevTransactions);

  const summaryParts = [
    rate != null && `Savings rate ${rate}%`,
    projection && `on pace for ${inr(projection.projected)}`,
    changes.length > 0 && `${changes.length} big change${changes.length === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <CollapsibleSection
      id="insights"
      title="Insights"
      className="insights-card"
      summary={summaryParts.join(' · ')}
      aria-label="Insights"
    >
      <div className="insights-grid">
        <div className="insight-tile">
          <span className="insight-label">Savings rate</span>
          {rate == null ? (
            <span className="insight-value muted">—</span>
          ) : (
            <span className={`insight-value ${rate >= 0 ? 'positive' : 'negative'}`}>{rate}%</span>
          )}
          <span className="insight-sub muted">
            {rate == null
              ? 'Add cash inflow to see it'
              : 'of inflow not spent (invested or left over)'}
          </span>
        </div>

        {projection ? (
          <div className="insight-tile">
            <span className="insight-label">Projected spend this month</span>
            <span className="insight-value expense">{inr(projection.projected)}</span>
            <span className="insight-sub muted">
              {inr(projection.spentSoFar)} so far · day {projection.daysElapsed} of {projection.daysInMonth}
              {!loading && prevExpense > 0 && (
                <>
                  {' · '}
                  <span className={projection.projected > prevExpense ? 'negative' : 'positive'}>
                    {signed(projection.projected - prevExpense)} vs {prevLabel}
                  </span>
                </>
              )}
            </span>
          </div>
        ) : (
          <div className="insight-tile">
            <span className="insight-label">Spend vs {prevLabel || 'last month'}</span>
            <span className="insight-value expense">{inr(expense)}</span>
            <span className="insight-sub muted">
              {loading || prevExpense <= 0 ? (
                'No previous month to compare'
              ) : (
                <span className={expense > prevExpense ? 'negative' : 'positive'}>
                  {signed(expense - prevExpense)} vs {inr(prevExpense)} in {prevLabel}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {changes.length > 0 && (
        <ul className="insight-changes">
          {changes.map((c) => {
            const up = c.delta > 0;
            let text;
            if (c.before === 0) text = `new this month (${inr(c.now)})`;
            else if (c.now === 0) text = `nothing this month (was ${inr(c.before)})`;
            else text = `${up ? 'up' : 'down'} ${Math.abs(c.pct)}% vs ${prevLabel} (${signed(c.delta)})`;
            return (
              <li key={c.category} className={`insight-change ${up ? 'negative' : 'positive'}`}>
                <span className="insight-change-arrow" aria-hidden="true">{up ? '▲' : '▼'}</span>
                <strong>{c.category}</strong> {text}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && changes.length === 0 && prevTransactions.length > 0 && (
        <p className="muted small insight-empty">No big category changes vs {prevLabel}.</p>
      )}
    </CollapsibleSection>
  );
}
