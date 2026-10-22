import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useFormatMoney } from '../utils/formatMoney';
import { buildYearReview } from '../utils/yearReview';

function firstSavedNetWorth(byMonth) {
  for (let m = 1; m <= 12; m += 1) {
    if (byMonth?.[m]?.saved) return byMonth[m].netWorth;
  }
  return null;
}

/** Read-only: everything the review needs for one year. */
function useYearReviewData(year) {
  const [state, setState] = useState({ year: null, review: null });

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const lastMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;
    const safe = (p, fallback) => p.then((r) => r.data).catch(() => fallback);

    Promise.all([
      Promise.all(
        Array.from({ length: 12 }).map((_, i) =>
          safe(api.get('/transactions', { params: { month: i + 1, year } }), { transactions: [] })
        )
      ),
      safe(api.get('/cashflow/year', { params: { year } }), { months: [] }),
      safe(api.get('/reports/yearly', { params: { year: year - 1 } }), { monthly: [] }),
      safe(api.get(`/balance-sheet/year/${year}`), { byMonth: {} }),
      safe(api.get(`/balance-sheet/year/${year - 1}`), { byMonth: {} }),
    ]).then(([monthsTx, cashflow, prevReport, bsYear, bsPrev]) => {
      if (cancelled) return;
      const transactions = monthsTx.flatMap((m) => m.transactions || []);
      // Compare the same stretch of months (Jan–now for the current year)
      const prevMonthly = (prevReport.monthly || []).filter((m) => m.month <= lastMonth);
      const prevYear = {
        totalExpense: prevMonthly.reduce((s, m) => s + (m.totalExpense || 0), 0),
        totalInvestment: prevMonthly.reduce((s, m) => s + (m.totalInvestment || 0), 0),
      };
      const prevHasSaved = Object.values(bsPrev.byMonth || {}).some((m) => m.saved);
      const netWorthStart = prevHasSaved
        ? bsPrev.byMonth[12]?.netWorth ?? null
        : firstSavedNetWorth(bsYear.byMonth);
      const yearHasSaved = Object.values(bsYear.byMonth || {}).some((m) => m.saved);
      const netWorthEnd = yearHasSaved ? bsYear.byMonth?.[lastMonth]?.netWorth ?? null : null;

      setState({
        year,
        review: buildYearReview({
          year,
          transactions,
          inflowByMonth: cashflow.months || [],
          prevYear,
          netWorthStart,
          netWorthEnd,
        }),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const loading = state.year !== year;
  return { loading, review: loading ? null : state.review };
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

/** 1080×1350 share image, drawn as SVG then rasterised to PNG. */
function buildPosterSvg(r, fmt) {
  const lines = [
    ['Spent', fmt.inr(r.totalExpense), '#f87171'],
    ['Invested', fmt.inr(r.totalInvestment), '#4ade80'],
    ['Savings rate', r.savingsRate == null ? '—' : `${r.savingsRate}%`, '#a5b4fc'],
    ['Top category', r.topExpenseCategories[0]?.category || '—', '#fde68a'],
    ['Biggest month', r.biggestMonth?.label || '—', '#fda4af'],
    ['No-spend days', String(r.noSpendDays), '#67e8f9'],
  ];
  const rows = lines
    .map(
      ([label, value, color], i) => `
      <text x="90" y="${470 + i * 130}" font-size="34" fill="#94a3b8">${escapeXml(label)}</text>
      <text x="90" y="${525 + i * 130}" font-size="56" font-weight="700" fill="${color}">${escapeXml(value)}</text>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1e1b4b"/><stop offset="0.55" stop-color="#0f172a"/><stop offset="1" stop-color="#020617"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#bg)"/>
    <circle cx="930" cy="170" r="220" fill="#6366f1" opacity="0.18"/>
    <circle cx="140" cy="1260" r="260" fill="#22c55e" opacity="0.10"/>
    <text x="90" y="170" font-size="40" fill="#a5b4fc" letter-spacing="6">EXPENSE CONTROL</text>
    <text x="90" y="290" font-size="120" font-weight="800" fill="#f8fafc">My ${r.year}</text>
    <text x="90" y="360" font-size="44" fill="#cbd5e1">${r.isCurrentYear ? 'so far' : 'in money'} · ${r.entries} entries</text>
    ${rows}
  </svg>`;
}

async function posterPng(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className={`review-stat${tone ? ` review-${tone}` : ''}`}>
      <span className="review-stat-label">{label}</span>
      <span className="review-stat-value">{value}</span>
      {sub && <span className="review-stat-sub">{sub}</span>}
    </div>
  );
}

export default function YearInReview({ year }) {
  const fmt = useFormatMoney();
  const { inr, signed, hideAmounts } = fmt;
  const toast = useToast();
  const { loading, review: r } = useYearReviewData(year);
  const [sharing, setSharing] = useState(false);

  const changeText = useMemo(() => {
    if (!r) return {};
    const period = r.isCurrentYear ? 'vs same months last year' : `vs ${year - 1}`;
    const fmtPct = (p) => (p == null ? null : `${p > 0 ? '+' : ''}${p}% ${period}`);
    return { expense: fmtPct(r.expenseChangePct), investment: fmtPct(r.investmentChangePct) };
  }, [r, year]);

  const handleShare = async () => {
    if (!r) return;
    setSharing(true);
    try {
      const blob = await posterPng(buildPosterSvg(r, fmt));
      const file = new File([blob], `my-${year}-in-review.png`, { type: 'image/png' });
      const download = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast.success('Image downloaded');
      };
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `My ${year} in review` });
        } catch (err) {
          // Some browsers drop the tap's permission while the image renders
          if (err?.name === 'NotAllowedError') download();
          else throw err;
        }
      } else {
        download();
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Share failed', err);
        toast.error('Could not create share image');
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <section className="card year-review">
        <p className="muted">Putting your {year} together…</p>
      </section>
    );
  }

  if (!r || r.entries === 0) {
    return (
      <section className="card year-review">
        <h2>{year} in review</h2>
        <p className="muted">No entries for {year} yet.</p>
      </section>
    );
  }

  const top = r.topExpenseCategories[0];

  return (
    <section className="year-review">
      <div className="review-hero">
        <div>
          <p className="review-kicker">{r.isCurrentYear ? 'Your year so far' : 'Your year in money'}</p>
          <h2 className="review-title">{year} in review</h2>
          <p className="review-lede">
            {r.entries} entries across {r.daysElapsed} days.
            {r.savingsRate != null && ` You kept ${r.savingsRate}% of what came in.`}
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={handleShare} disabled={sharing}>
          {sharing ? 'Preparing…' : 'Share image'}
        </button>
      </div>
      {hideAmounts && (
        <p className="muted small">Amounts are hidden, so the share image will hide them too.</p>
      )}

      <div className="review-grid">
        <Stat label="Cash inflow" value={inr(r.totalInflow)} tone="inflow" />
        <Stat label="Spent" value={inr(r.totalExpense)} sub={changeText.expense} tone="expense" />
        <Stat label="Invested" value={inr(r.totalInvestment)} sub={changeText.investment} tone="invest" />
        <Stat
          label="Savings rate"
          value={r.savingsRate == null ? '—' : `${r.savingsRate}%`}
          sub={r.savingsRate == null ? 'Add cash inflow to see it' : 'of inflow not spent'}
          tone="inflow"
        />
      </div>

      <div className="review-cards">
        {top && (
          <div className="card review-card">
            <span className="review-card-kicker">Where most of it went</span>
            <strong className="review-card-big">{top.category}</strong>
            <span className="muted">
              {inr(top.total)}
              {r.topExpenseShare != null && ` · ${r.topExpenseShare}% of all spending`}
            </span>
            {r.topExpenseCategories.length > 1 && (
              <ol className="review-list">
                {r.topExpenseCategories.slice(1).map((c) => (
                  <li key={c.category}>
                    {c.category} <span className="muted">{inr(c.total)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {r.goTo && (
          <div className="card review-card">
            <span className="review-card-kicker">Your go-to</span>
            <strong className="review-card-big">{r.goTo.category}</strong>
            <span className="muted">{r.goTo.count} entries this year</span>
          </div>
        )}
        {r.biggestMonth && (
          <div className="card review-card">
            <span className="review-card-kicker">Biggest spending month</span>
            <strong className="review-card-big">{r.biggestMonth.label}</strong>
            <span className="muted">{inr(r.biggestMonth.total)}</span>
            {r.lightestMonth && (
              <span className="muted small">
                Lightest: {r.lightestMonth.label} ({inr(r.lightestMonth.total)})
              </span>
            )}
          </div>
        )}
        {r.biggestExpense && (
          <div className="card review-card">
            <span className="review-card-kicker">Biggest single expense</span>
            <strong className="review-card-big">{inr(r.biggestExpense.amount)}</strong>
            <span className="muted">
              {r.biggestExpense.category}
              {r.biggestExpense.description ? ` · ${r.biggestExpense.description}` : ''} ·{' '}
              {new Date(r.biggestExpense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}
        <div className="card review-card">
          <span className="review-card-kicker">No-spend days</span>
          <strong className="review-card-big">{r.noSpendDays}</strong>
          <span className="muted">
            Longest streak: {r.longestNoSpendStreak} day{r.longestNoSpendStreak === 1 ? '' : 's'}
          </span>
        </div>
        <div className="card review-card">
          <span className="review-card-kicker">Daily average</span>
          <strong className="review-card-big">{inr(r.avgDailySpend)}</strong>
          <span className="muted">
            {r.busiestWeekday ? `You spend most on ${r.busiestWeekday}s` : 'spent per day'}
          </span>
        </div>
        {r.topInvestmentCategory && (
          <div className="card review-card">
            <span className="review-card-kicker">Top investment</span>
            <strong className="review-card-big">{r.topInvestmentCategory.category}</strong>
            <span className="muted">{inr(r.topInvestmentCategory.total)}</span>
          </div>
        )}
        {r.netWorthChange != null && (
          <div className="card review-card">
            <span className="review-card-kicker">Net worth</span>
            <strong className={`review-card-big ${r.netWorthChange >= 0 ? 'positive' : 'negative'}`}>
              {signed(r.netWorthChange)}
            </strong>
            <span className="muted">
              {inr(r.netWorthStart)} → {inr(r.netWorthEnd)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
