import { useFormatMoney } from '../utils/formatMoney';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pctOf(part, whole) {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function changeClass(diff, kind) {
  if (diff == null || diff === 0) return 'neutral';
  if (kind === 'debts' || kind === 'expense') return diff < 0 ? 'positive' : 'negative';
  return diff >= 0 ? 'positive' : 'negative';
}

function ChangeDelta({ change, kind, prevValue }) {
  const { hideAmounts, mask, inr } = useFormatMoney();
  if (change == null || change === 0) return null;
  const cls = changeClass(change, kind);
  const prev = Number(prevValue) || 0;
  const pct = prev !== 0 ? Math.round((change / prev) * 1000) / 10 : null;
  const arrow = change >= 0 ? '↑' : '↓';
  const amtPart = hideAmounts ? mask : inr(Math.abs(change));

  return (
    <em className={cls} title="Vs previous month">
      {arrow} {amtPart}
      {pct != null && (
        <span className="sticky-change-pct">
          {' '}({pct >= 0 ? '+' : ''}{pct}%)
        </span>
      )}
    </em>
  );
}

function StickyStat({
  label,
  value,
  className = '',
  title,
  pctOfInflow = null,
  change = null,
  changeKind,
  changePrev = null,
}) {
  const { inr } = useFormatMoney();
  return (
    <span className={`sticky-stat ${className}`.trim()} title={title}>
      {label}{' '}
      <strong>{inr(value || 0)}</strong>
      {pctOfInflow != null && <em className="sticky-pct-of-inflow">{pctOfInflow}%</em>}
      <ChangeDelta change={change} kind={changeKind} prevValue={changePrev} />
    </span>
  );
}

export default function StickyMonthSummary({
  year,
  month,
  inflow,
  inflowPrev = null,
  remaining = 0,
  expense,
  expensePrev = null,
  investment,
  investmentPrev = null,
  netWorth = 0,
  netWorthChange = null,
  netWorthPrev = null,
  totalAssets = 0,
  totalAssetsChange = null,
  totalAssetsPrev = null,
  totalDebts = 0,
  totalDebtsChange = null,
  totalDebtsPrev = null,
  loading,
}) {
  const monthLabel = MONTH_NAMES[month] || month;

  const inflowChange =
    inflowPrev != null ? Number(inflow || 0) - Number(inflowPrev || 0) : null;
  const investmentChange =
    investmentPrev != null ? Number(investment || 0) - Number(investmentPrev || 0) : null;
  const expenseChange =
    expensePrev != null ? Number(expense || 0) - Number(expensePrev || 0) : null;

  return (
    <div className="sticky-month-summary">
      <div className="sticky-month-rows">
        <div className="sticky-month-row sticky-month-row-label">
          <span className="sticky-month-label">
            <strong>{monthLabel} {year}</strong>
          </span>
          {loading ? (
            <span className="muted small">Loading…</span>
          ) : (
            <div className="sticky-month-cash-line">
              <StickyStat
                label="Inflow"
                value={inflow}
                className="sticky-stat-in sticky-stat-inline"
                title="Cash inflow"
                change={inflowChange}
                changeKind="inflow"
                changePrev={inflowPrev}
              />
              <span className="sticky-cash-sep" aria-hidden="true">·</span>
              <StickyStat
                label="Remain"
                value={remaining}
                className={`sticky-stat-rem sticky-stat-inline ${remaining >= 0 ? 'positive' : 'negative'}`}
                title="Remaining after investment + expense"
                pctOfInflow={remaining >= 0 ? pctOf(remaining, inflow) : null}
              />
            </div>
          )}
        </div>

        {!loading && (
          <>
            <div className="sticky-month-row sticky-month-row-pair">
              <StickyStat
                label="Inv"
                value={investment}
                className="sticky-stat-inv"
                title="Investments"
                pctOfInflow={pctOf(investment, inflow)}
                change={investmentChange}
                changeKind="investment"
                changePrev={investmentPrev}
              />
              <StickyStat
                label="Exp"
                value={expense}
                className="sticky-stat-exp"
                title="Expenses"
                pctOfInflow={pctOf(expense, inflow)}
                change={expenseChange}
                changeKind="expense"
                changePrev={expensePrev}
              />
            </div>

            <div className="sticky-month-row sticky-month-row-pair">
              <StickyStat
                label="Assets"
                value={totalAssets}
                className="sticky-stat-assets"
                title="Total assets"
                change={totalAssetsChange}
                changeKind="assets"
                changePrev={totalAssetsPrev}
              />
              <StickyStat
                label="Debts"
                value={totalDebts}
                className="sticky-stat-debts"
                title="Total debts"
                change={totalDebtsChange}
                changeKind="debts"
                changePrev={totalDebtsPrev}
              />
            </div>

            <div className="sticky-month-row sticky-month-row-single">
              <StickyStat
                label="Net worth"
                value={netWorth}
                className="sticky-stat-nw"
                title="Net worth (assets − debts)"
                change={netWorthChange}
                changeKind="netWorth"
                changePrev={netWorthPrev}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
