import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useFormatMoney } from '../utils/formatMoney';
import { colorFor } from '../utils/analytics';

/**
 * Read-only bills timeline built from your recurring rules (GET /recurring) and this month's entries.
 * It never creates entries — adding still happens through the existing "Recurring & quick fill" banner.
 */
export default function UpcomingBills({ year, month, transactions, refreshKey, onGoToRecurring }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const [rules, setRules] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/recurring')
      .then((res) => !cancelled && setRules((res.data?.rules || []).filter((r) => r.active !== false)))
      .catch(() => !cancelled && setRules([]));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const now = new Date();
  const todayDate = now.getDate();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

  const items = useMemo(() => {
    if (!rules) return [];
    const paidIds = new Set((transactions || []).filter((t) => t.recurringRuleId).map((t) => String(t.recurringRuleId)));
    return rules
      .map((r) => {
        const day = Math.min(Math.max(Number(r.dayOfMonth) || 1, 1), 28);
        const paid = paidIds.has(String(r._id));
        let status = 'upcoming';
        let daysAway = null;
        if (paid) status = 'paid';
        else if (isPast) status = 'missed';
        else if (isCurrent) {
          daysAway = day - todayDate;
          status = daysAway < 0 ? 'overdue' : daysAway === 0 ? 'today' : daysAway <= 7 ? 'soon' : 'upcoming';
        }
        return { ...r, day, paid, status, daysAway };
      })
      .sort((a, b) => Number(a.paid) - Number(b.paid) || a.day - b.day);
  }, [rules, transactions, isCurrent, isPast, todayDate]);

  if (!rules || rules.length === 0) return null;

  const due = items.filter((i) => !i.paid);
  const dueTotal = due.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const paidTotal = items.filter((i) => i.paid).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const visible = showAll ? items : items.slice(0, 5);

  const statusText = (i) => {
    if (i.status === 'paid') return 'Added';
    if (i.status === 'missed') return 'Not added';
    if (i.status === 'overdue') return `${Math.abs(i.daysAway)}d overdue`;
    if (i.status === 'today') return 'Due today';
    if (i.daysAway != null) return `In ${i.daysAway}d`;
    return `Day ${i.day}`;
  };

  return (
    <section className="card bills" aria-label="Bills and recurring">
      <div className="bills-head">
        <div>
          <h2>Bills & recurring</h2>
          <p className="muted small">
            {due.length ? `${due.length} still to add · ${hideAmounts ? inr(dueTotal) : compact(dueTotal)}` : 'All added for this month'}
            {paidTotal > 0 && ` · ${hideAmounts ? inr(paidTotal) : compact(paidTotal)} done`}
          </p>
        </div>
        {due.length > 0 && onGoToRecurring && (
          <button type="button" className="ghost-btn small" onClick={onGoToRecurring}>
            Review
          </button>
        )}
      </div>
      <div className="bills-progress" aria-hidden="true">
        <span style={{ width: `${items.length ? (items.filter((i) => i.paid).length / items.length) * 100 : 0}%` }} />
      </div>
      <ul className="bills-list">
        {visible.map((i) => (
          <li key={i._id} className={`bill bill-${i.status}`}>
            <span className="bill-date">
              <b>{i.day}</b>
              <small>{new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'short' })}</small>
            </span>
            <span className="bill-name">
              <i style={{ background: colorFor(i.tag || i.category) }} />
              {i.name}
              <small>{i.type === 'investment' ? 'Investment' : i.category}</small>
            </span>
            <span className="bill-right">
              <span className="bill-amt">{inr(i.amount)}</span>
              <span className="bill-status">{statusText(i)}</span>
            </span>
          </li>
        ))}
      </ul>
      {items.length > 5 && (
        <button type="button" className="link-btn small bills-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}
