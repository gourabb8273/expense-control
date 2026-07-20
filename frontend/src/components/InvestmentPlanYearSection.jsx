import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import InvestmentPlanVisualization from './InvestmentPlanVisualization';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getCapMonth(year) {
  const now = new Date();
  if (year < now.getFullYear()) return 12;
  if (year > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}

/** Latest month up to today that has portfolio plan data (saved or carried). */
function getLatestPlanMonth(year, byMonth) {
  const capMonth = getCapMonth(year);
  for (let m = capMonth; m >= 1; m -= 1) {
    const row = byMonth[m];
    if ((Number(row?.total) || 0) > 0) return m;
  }
  return null;
}

function getMonthsWithPlans(year, byMonth) {
  const capMonth = getCapMonth(year);
  const months = [];
  for (let m = 1; m <= capMonth; m += 1) {
    const row = byMonth[m];
    if ((Number(row?.total) || 0) > 0) months.push(m);
  }
  return months;
}

export default function InvestmentPlanYearSection({ year, refreshKey = 0, embedded = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/investment-plan/year/${year}`)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, refreshKey]);

  const byMonth = data?.byMonth || {};
  const latestPlanMonth = useMemo(
    () => getLatestPlanMonth(year, byMonth),
    [year, byMonth]
  );
  const latestRow = latestPlanMonth ? byMonth[latestPlanMonth] : null;
  const monthsWithPlans = useMemo(
    () => getMonthsWithPlans(year, byMonth),
    [year, byMonth]
  );

  const monthlyTotals = monthsWithPlans.map((m) => ({
    month: m,
    label: MONTH_NAMES[m],
    total: Number(byMonth[m]?.total) || 0,
    saved: !!byMonth[m]?.saved,
  }));

  const latestItemsWithAmount = (latestRow?.items || []).filter(
    (i) => (i.name || '').trim() && (Number(i.amount) || 0) > 0
  );

  if (loading) {
    return (
      <div className="card investment-plan-year-card">
        <div className="balance-sheet-header">
          <button
            type="button"
            className="section-header-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span className="section-header-chevron" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            <h2>Portfolio plan · {year}</h2>
          </button>
        </div>
        {expanded && <p className="muted small">Loading…</p>}
      </div>
    );
  }

  return (
    <div className={`card investment-plan-year-card${embedded ? ' investment-plan-year-embedded' : ''}`}>
      {!embedded && (
      <div className="balance-sheet-header">
        <button
          type="button"
          className="section-header-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="section-header-chevron" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          <h2>Portfolio plan · {year}</h2>
          {!expanded && latestRow && (
            <span className="pill section-header-summary">
              {MONTH_NAMES[latestPlanMonth]} · ₹{Number(latestRow.total || 0).toLocaleString('en-IN')}
            </span>
          )}
        </button>
      </div>
      )}

      {embedded && (
        <h2 className="investment-plan-year-embedded-title">Year overview · {year}</h2>
      )}

      {(embedded || expanded) && (
        <>
          <p className="muted small">
            Latest portfolio plan as of the most recent month (carries forward from last save). Edit in Month view.
          </p>

          {!latestRow ? (
            <p className="muted small">
              No portfolio plan for {year} yet. Set it up in Month view and save once — it will carry to later months.
            </p>
          ) : (
            <>
              <p className="investment-plan-year-from muted small">
                Latest · <strong>{MONTH_NAMES[latestPlanMonth]} {year}</strong>
                {latestRow.saved ? (
                  <span> · saved this month</span>
                ) : (
                  <span> · carried from last saved month</span>
                )}
              </p>
              <InvestmentPlanVisualization
                itemsWithAmount={latestItemsWithAmount}
                notes={latestRow.notes}
                totalPlanned={Number(latestRow.total) || 0}
              />

              {monthlyTotals.length > 1 && (
                <div className="investment-plan-monthly-totals">
                  <h3>Plan total by month</h3>
                  <ul className="investment-plan-monthly-list">
                    {monthlyTotals.map(({ month, label, total, saved }) => (
                      <li
                        key={month}
                        className={month === latestPlanMonth ? 'investment-plan-month-current' : ''}
                      >
                        <span>
                          {label}
                          {!saved && <em className="investment-plan-month-carried"> carried</em>}
                        </span>
                        <strong>₹{total.toLocaleString('en-IN')}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
