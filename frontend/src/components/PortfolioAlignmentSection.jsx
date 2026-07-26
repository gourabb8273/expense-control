import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useFormatMoney } from '../utils/formatMoney';
import { computePortfolioAlignment } from '../utils/portfolioAlignment';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildDiffRows(alignment) {
  const rows = [];

  if (
    alignment.hasPlan &&
    alignment.overallStatus !== 'on-track' &&
    alignment.overallStatus !== 'neutral'
  ) {
    rows.push({
      key: 'total',
      label: 'Total',
      diff: alignment.totalDiff,
      status: alignment.overallStatus,
      isTotal: true,
    });
  }

  alignment.byAllocation.forEach((row) => {
    if (row.status === 'on-track' || row.status === 'neutral') return;
    rows.push({
      key: row.name,
      label: row.name,
      diff: row.diff,
      status: row.status,
    });
  });

  alignment.unmappedActual.forEach((row) => {
    rows.push({
      key: `extra-${row.name}`,
      label: row.name,
      diff: row.actual,
      status: 'over',
      extra: true,
    });
  });

  return rows;
}

function diffLabel(diff, status, inr, hideAmounts) {
  if (hideAmounts) return '**';
  const d = Number(diff) || 0;
  if (status === 'on-track' || d === 0) return 'On plan';
  const amt = inr(Math.abs(d));
  if (status === 'under') return `${amt} less`;
  return `${amt} more`;
}

export default function PortfolioAlignmentSection({
  year,
  month,
  monthSummary,
  transactions = [],
  loadingSummary = false,
  refreshKey = 0,
}) {
  const { inr, hideAmounts } = useFormatMoney();
  const [expanded, setExpanded] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [planItems, setPlanItems] = useState([]);
  const [planSource, setPlanSource] = useState(null);

  const monthLabel = MONTH_NAMES[month] || month;
  const now = new Date();
  const currentPlanYear = now.getFullYear();
  const currentPlanMonth = now.getMonth() + 1;
  const isViewingCurrentMonth = year === currentPlanYear && month === currentPlanMonth;

  const loadPlan = useCallback(async () => {
    setPlanLoading(true);
    try {
      const res = await api.get('/investment-plan', {
        params: { year: currentPlanYear, month: currentPlanMonth },
      });
      setPlanItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setPlanSource({
        year: currentPlanYear,
        month: currentPlanMonth,
        carriedFrom: res.data?.carriedFrom || null,
        saved: !!res.data?.saved,
      });
    } catch (err) {
      console.error('Failed to load portfolio plan for alignment', err);
      setPlanItems([]);
      setPlanSource(null);
    } finally {
      setPlanLoading(false);
    }
  }, [currentPlanYear, currentPlanMonth]);

  useEffect(() => {
    setExpanded(false);
  }, [year, month]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan, refreshKey]);

  const alignment = useMemo(
    () => computePortfolioAlignment(planItems, monthSummary, transactions),
    [planItems, monthSummary, transactions]
  );

  const diffRows = useMemo(() => buildDiffRows(alignment), [alignment]);
  const loading = planLoading || loadingSummary;

  const currentPlanLabel = `${MONTH_NAMES[currentPlanMonth] || currentPlanMonth} ${currentPlanYear}`;
  const planCarriedLabel = planSource?.carriedFrom
    ? `${MONTH_NAMES[planSource.carriedFrom.month] || planSource.carriedFrom.month} ${planSource.carriedFrom.year}`
    : null;

  const collapsedHint = !loading && alignment.hasPlan && (
    diffRows.length === 0 ? (
      <span className="alignment-inline-ok">All on plan</span>
    ) : (
      <span className="alignment-inline-diffs">
        {diffRows.slice(0, 3).map((row) => (
          <span key={row.key} className={`alignment-inline-chip ${row.isTotal ? 'alignment-status-total' : `alignment-status-${row.status}`}`}>
            {row.label !== 'Total' && `${row.label} · `}
            {diffLabel(row.diff, row.status, inr, hideAmounts)}
          </span>
        ))}
        {diffRows.length > 3 && (
          <span className="alignment-inline-more muted">+{diffRows.length - 3} more</span>
        )}
      </span>
    )
  );

  return (
    <div className="card portfolio-alignment-card">
      <button
        type="button"
        className="section-header-toggle portfolio-alignment-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="section-header-chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        <h2 className="portfolio-alignment-title">
          vs portfolio · {monthLabel} {year}
        </h2>
        {!expanded && !loading && collapsedHint}
      </button>

      {expanded && (
        <div className="portfolio-alignment-body">
          {loading && <p className="muted small">Loading…</p>}

          {!loading && !alignment.hasPlan && (
            <p className="muted small">No current portfolio plan set up yet.</p>
          )}

          {!loading && alignment.hasPlan && !isViewingCurrentMonth && (
            <p className="muted small portfolio-alignment-from">
              {monthLabel} {year} investments vs current portfolio ({currentPlanLabel})
            </p>
          )}

          {!loading && alignment.hasPlan && isViewingCurrentMonth && planCarriedLabel && !planSource?.saved && (
            <p className="muted small portfolio-alignment-from">
              Current portfolio carried from {planCarriedLabel}
            </p>
          )}

          {!loading && alignment.hasPlan && diffRows.length === 0 && (
            <p className="alignment-all-ok">All investments match the plan.</p>
          )}

          {!loading && diffRows.length > 0 && (
            <ul className="alignment-diff-list">
              {diffRows.map((row) => (
                <li
                  key={row.key}
                  className={`alignment-diff-item ${row.isTotal ? 'alignment-status-total' : `alignment-status-${row.status}`}`}
                >
                  <span className="alignment-diff-name">
                    {row.label}
                    {row.extra && <span className="muted small"> · not in plan</span>}
                  </span>
                  <span className="alignment-diff-val">
                    {diffLabel(row.diff, row.status, inr, hideAmounts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
