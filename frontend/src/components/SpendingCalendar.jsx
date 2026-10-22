import { useMemo } from 'react';
import { useFormatMoney } from '../utils/formatMoney';
import { dailyTotals } from '../utils/insights';
import CollapsibleSection from './CollapsibleSection';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEVELS = 4;

/** Daily expense heatmap for one month. Clicking a day filters the entries list. */
export default function SpendingCalendar({ year, month, transactions, selectedDay, onSelectDay }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const days = useMemo(() => dailyTotals(transactions), [transactions]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday-first
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  // Scale against the 90th percentile so one huge day (rent) doesn't wash out the rest
  const amounts = Array.from(days.values())
    .map((d) => d.expense)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const scaleMax = amounts.length ? amounts[Math.min(amounts.length - 1, Math.floor(amounts.length * 0.9))] : 0;

  const levelFor = (amount) => {
    if (!amount || amount <= 0 || scaleMax <= 0) return 0;
    return Math.min(LEVELS, Math.max(1, Math.ceil((amount / scaleMax) * LEVELS)));
  };

  const pastDays = isCurrentMonth ? today.getDate() : daysInMonth;
  let noSpendDays = 0;
  for (let d = 1; d <= pastDays; d += 1) {
    if (!(days.get(d)?.expense > 0)) noSpendDays += 1;
  }
  const isFuture = new Date(year, month - 1, 1) > today;

  const blanks = Array.from({ length: leadingBlanks }).map((_, i) => (
    <div key={`b${i}`} className="cal-cell cal-blank" />
  ));
  const dayCells = Array.from({ length: daysInMonth }).map((_, i) => {
    const d = i + 1;
    const info = days.get(d);
    const expense = info?.expense || 0;
    const investment = info?.investment || 0;
    const level = levelFor(expense);
    const selected = selectedDay === d;
    const label = new Date(year, month - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const title = hideAmounts
      ? label
      : `${label}: ${expense ? `${inr(expense)} spent` : 'no spend'}${investment ? `, ${inr(investment)} invested` : ''}`;
    return (
      <button
        key={d}
        type="button"
        className={`cal-cell cal-level-${level}${selected ? ' cal-selected' : ''}${
          isCurrentMonth && d === today.getDate() ? ' cal-today' : ''
        }`}
        title={title}
        aria-label={title}
        aria-pressed={selected}
        onClick={() => onSelectDay?.(selected ? null : d)}
      >
        <span className="cal-day">{d}</span>
        {expense > 0 && !hideAmounts && <span className="cal-amount">{compact(expense)}</span>}
        {investment > 0 && <span className="cal-invest-dot" aria-hidden="true" />}
      </button>
    );
  });

  const noSpendText = isFuture ? null : `${noSpendDays} no-spend day${noSpendDays === 1 ? '' : 's'}`;

  return (
    <CollapsibleSection
      id="spending-calendar"
      title="Spending calendar"
      className="spending-calendar"
      summary={selectedDay ? `Filtering entries by ${selectedDay}` : noSpendText}
      headerExtra={
        noSpendText && (
          <span className="pill pill-meta" title="Days with no expense entries so far">
            {noSpendText}
          </span>
        )
      }
      aria-label="Spending calendar"
    >
      <div className="cal-grid cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-weekday">{w}</span>
        ))}
      </div>
      <div className="cal-grid">
        {blanks}
        {dayCells}
      </div>
      <div className="cal-legend muted small">
        <span>Less</span>
        {Array.from({ length: LEVELS + 1 }).map((_, i) => (
          <span key={i} className={`cal-swatch cal-level-${i}`} />
        ))}
        <span>More</span>
        <span className="cal-legend-invest">
          <span className="cal-invest-dot" aria-hidden="true" /> investment
        </span>
        <span className="cal-legend-hint">Tap a day to filter entries</span>
      </div>
    </CollapsibleSection>
  );
}
