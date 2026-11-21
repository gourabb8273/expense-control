import { useTooltip } from './chartUtils';
import { MONTH_LABELS } from '../../utils/analytics';

function heatColor(v, max, base = '249, 115, 22') {
  if (!v) return 'var(--vx-heat-empty)';
  const t = Math.min(1, v / (max || 1));
  return `rgba(${base}, ${0.15 + t * 0.85})`;
}

/** Categories × months grid. rows: [{ name, values: number[12] }] */
export function CategoryMonthHeatmap({ rows, format, highlightMonth, rgb }) {
  const { wrapRef, show, hide, node } = useTooltip();
  return (
    <div ref={wrapRef} className="vx-chart-wrap vx-heat" onMouseLeave={hide}>
      <div className="vx-heat-grid" style={{ gridTemplateColumns: `minmax(78px, 1.4fr) repeat(12, minmax(18px, 1fr))` }}>
        <span />
        {MONTH_LABELS.map((m, i) => (
          <span key={m} className={`vx-heat-col${highlightMonth === i + 1 ? ' is-current' : ''}`}>{m[0]}</span>
        ))}
        {rows.map((r) => (
          // Shade each row against its own peak month, so seasonal patterns show even for small categories
          <Row key={r.name} r={r} max={Math.max(1, ...r.values)} show={show} format={format} rgb={rgb} />
        ))}
      </div>
      {node}
    </div>
  );
}

function Row({ r, max, show, format, rgb }) {
  return (
    <>
      <span className="vx-heat-row" title={r.name}>{r.name}</span>
      {r.values.map((v, i) => {
        const content = (
          <>
            <strong>{r.name} · {MONTH_LABELS[i]}</strong>
            <span>{v ? format(v) : 'No spend'}</span>
          </>
        );
        return (
          <span
            key={i}
            className="vx-heat-cell"
            style={{ background: heatColor(v, max, rgb) }}
            onMouseMove={(e) => show(e, content)}
            onTouchStart={(e) => show(e, content)}
          />
        );
      })}
    </>
  );
}

/** Twelve mini month calendars (Mon-first) shaded by daily spend. dailyByMonth: number[12][days] */
export function YearCalendarHeatmap({ year, dailyByMonth, format, todayKey }) {
  const { wrapRef, show, hide, node } = useTooltip();
  // Cap at the 92nd percentile so one big rent day doesn't wash out every other day
  const nonZero = dailyByMonth.flat().filter(Boolean).sort((a, b) => a - b);
  const max = nonZero.length ? nonZero[Math.floor(nonZero.length * 0.92)] || nonZero[nonZero.length - 1] : 1;
  return (
    <div ref={wrapRef} className="vx-chart-wrap" onMouseLeave={hide}>
      <div className="vx-cal-year">
        {dailyByMonth.map((days, mi) => {
          const first = new Date(year, mi, 1).getDay();
          const lead = (first + 6) % 7;
          const total = days.reduce((s, v) => s + v, 0);
          return (
            <div key={mi} className="vx-cal-month">
              <div className="vx-cal-month-head">
                <span>{MONTH_LABELS[mi]}</span>
              </div>
              <div className="vx-cal-days">
                {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
                {days.map((v, di) => {
                  const key = `${year}-${mi + 1}-${di + 1}`;
                  const date = new Date(year, mi, di + 1);
                  const content = (
                    <>
                      <strong>{date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                      <span>{v ? format(v) : 'No spend'}</span>
                    </>
                  );
                  return (
                    <span
                      key={di}
                      className={`vx-cal-day${key === todayKey ? ' is-today' : ''}`}
                      style={{ background: heatColor(v, max) }}
                      onMouseMove={(e) => show(e, content)}
                      onTouchStart={(e) => show(e, content)}
                    />
                  );
                })}
              </div>
              <span className="vx-cal-month-total">{total ? format(total) : '—'}</span>
            </div>
          );
        })}
      </div>
      <div className="vx-heat-scale">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <i key={t} style={{ background: t ? heatColor(t, 1) : 'var(--vx-heat-empty)' }} />
        ))}
        <span>More</span>
      </div>
      {node}
    </div>
  );
}
