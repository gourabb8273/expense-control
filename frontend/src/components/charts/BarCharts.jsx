import { useElementWidth, useTooltip, niceMax } from './chartUtils';

/**
 * Sorted horizontal bars with direct labels and a ghost marker for last month.
 * rows: [{ name, value, prev?, color }]
 */
export function CompareBars({ rows, format, total, hideAmounts, onSelect, selected, upIsGood = false, deltaLabel = 'vs last month', newLabel = 'New this month' }) {
  const max = niceMax(Math.max(1, ...rows.map((r) => Math.max(r.value, r.prev || 0))));
  return (
    <ul className="vx-hbars">
      {rows.map((r) => {
        const pct = total ? Math.round((r.value / total) * 100) : 0;
        const delta = r.prev != null ? r.value - r.prev : null;
        const deltaPct = r.prev ? Math.round((delta / r.prev) * 100) : null;
        return (
          <li key={r.name}>
            <button
              type="button"
              className={`vx-hbar-row${selected === r.name ? ' is-selected' : ''}`}
              onClick={onSelect && !r.isOther ? () => onSelect(selected === r.name ? null : r.name) : undefined}
              disabled={!onSelect || r.isOther}
            >
              <span className="vx-hbar-top">
                <span className="vx-hbar-name">
                  <i style={{ background: r.color }} />
                  {r.name}
                </span>
                <span className="vx-hbar-val">
                  {format(r.value)}
                  <small> {pct}%</small>
                </span>
              </span>
              <span className="vx-hbar-track">
                <span className="vx-hbar-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
                {r.prev > 0 && (
                  <span className="vx-hbar-prev" style={{ left: `${(r.prev / max) * 100}%` }} title="Last month" />
                )}
              </span>
              {delta != null && r.prev > 0 && Math.abs(delta) >= 1 && (
                <span className={`vx-hbar-delta ${(delta > 0) !== upIsGood ? 'up' : 'down'}`}>
                  {delta > 0 ? '▲' : '▼'} {hideAmounts ? '' : format(Math.abs(delta))}
                  {deltaPct != null && Math.abs(deltaPct) < 1000 ? ` (${delta > 0 ? '+' : ''}${deltaPct}%)` : ''} {deltaLabel}
                </span>
              )}
              {r.prev === 0 && r.value > 0 && <span className="vx-hbar-delta new">{newLabel}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Waterfall: start bar → +/- steps → end bar.
 * steps: [{ name, delta }]
 */
export function Waterfall({ start, end, steps, startLabel, endLabel, format, compact, hideAmounts, height = 240 }) {
  const [ref, width] = useElementWidth();
  const { wrapRef, show, hide, node } = useTooltip();
  const bars = [];
  let run = start;
  bars.push({ name: startLabel, from: 0, to: start, kind: 'total' });
  steps.forEach((s) => {
    bars.push({ name: s.name, from: run, to: run + s.delta, kind: s.delta >= 0 ? 'up' : 'down', delta: s.delta });
    run += s.delta;
  });
  bars.push({ name: endLabel, from: 0, to: end, kind: 'total' });
  const max = Math.max(1, ...bars.map((b) => Math.max(b.from, b.to))) * 1.08;
  const pad = { l: 8, r: 8, t: 22, b: 54 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const bw = iw / bars.length;
  const y = (v) => pad.t + ih - (v / max) * ih;
  return (
    <div ref={(el) => { ref.current = el; wrapRef.current = el; }} className="vx-chart-wrap">
      <svg width={width} height={height} onMouseLeave={hide}>
        {bars.map((b, i) => {
          const top = y(Math.max(b.from, b.to));
          const h = Math.max(2, Math.abs(y(b.from) - y(b.to)));
          const cls = b.kind === 'total' ? 'vx-wf-total' : b.kind === 'up' ? 'vx-wf-up' : 'vx-wf-down';
          const cx = pad.l + bw * i + bw / 2;
          const label = b.kind === 'total' ? compact(b.to) : `${b.delta > 0 ? '+' : '−'}${compact(Math.abs(b.delta))}`;
          return (
            <g
              key={`${b.name}-${i}`}
              onMouseMove={(e) => show(e, <><strong>{b.name}</strong><span>{b.kind === 'total' ? format(b.to) : `${b.delta > 0 ? '+' : '−'}${format(Math.abs(b.delta))}`}</span></>)}
              onTouchStart={(e) => show(e, <><strong>{b.name}</strong><span>{b.kind === 'total' ? format(b.to) : `${b.delta > 0 ? '+' : '−'}${format(Math.abs(b.delta))}`}</span></>)}
            >
              {i > 0 && i < bars.length && (
                <line
                  x1={pad.l + bw * (i - 1) + bw * 0.82}
                  x2={pad.l + bw * i + bw * 0.18}
                  y1={y(bars[i - 1].to)}
                  y2={y(bars[i - 1].to)}
                  className="vx-wf-link"
                />
              )}
              <rect x={pad.l + bw * i + bw * 0.18} y={top} width={bw * 0.64} height={h} rx={3} className={cls} />
              {!hideAmounts && (
                <text x={cx} y={top - 5} textAnchor="middle" className="vx-axis vx-wf-val">
                  {label}
                </text>
              )}
              <text
                x={cx}
                y={height - pad.b + 14}
                textAnchor="end"
                transform={`rotate(-35 ${cx} ${height - pad.b + 14})`}
                className="vx-axis"
              >
                {b.name.length > 12 ? `${b.name.slice(0, 11)}…` : b.name}
              </text>
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}

/** Tiny inline trend line for KPI tiles. */
export function Sparkline({ values, color = 'currentColor', width = 72, height = 22 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`);
  return (
    <svg width={width} height={height} className="vx-spark" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={2.4} fill={color} />
    </svg>
  );
}

/** Vertical monthly bars (one series) with optional line overlay — used for savings rate. */
export function MonthBars({ labels, values, color, format, compact, hideAmounts, height = 200, highlight, suffix = '' }) {
  const [ref, width] = useElementWidth();
  const { wrapRef, show, hide, node } = useTooltip();
  const pad = { l: 6, r: 6, t: 20, b: 22 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...values.map((v) => Math.abs(v))));
  const hasNeg = values.some((v) => v < 0);
  const zero = hasNeg ? pad.t + ih / 2 : pad.t + ih;
  const scale = hasNeg ? ih / 2 / max : ih / max;
  const bw = iw / values.length;
  return (
    <div ref={(el) => { ref.current = el; wrapRef.current = el; }} className="vx-chart-wrap">
      <svg width={width} height={height} onMouseLeave={hide}>
        <line x1={pad.l} x2={width - pad.r} y1={zero} y2={zero} className="vx-gridline" />
        {values.map((v, i) => {
          const h = Math.abs(v) * scale;
          const yTop = v >= 0 ? zero - h : zero;
          const cx = pad.l + bw * i + bw / 2;
          const c = typeof color === 'function' ? color(v, i) : color;
          return (
            <g
              key={labels[i]}
              onMouseMove={(e) => show(e, <><strong>{labels[i]}</strong><span>{format(v)}{suffix}</span></>)}
              onTouchStart={(e) => show(e, <><strong>{labels[i]}</strong><span>{format(v)}{suffix}</span></>)}
            >
              <rect x={pad.l + bw * i} y={pad.t} width={bw} height={ih} fill="transparent" />
              <rect x={pad.l + bw * i + bw * 0.2} y={yTop} width={bw * 0.6} height={Math.max(v ? 2 : 0, h)} rx={3} fill={c} opacity={highlight == null || highlight === i ? 1 : 0.45} />
              {!hideAmounts && v !== 0 && (compact(v).length * 6.2 <= bw + 4 || i === highlight) && (
                <text x={cx} y={v >= 0 ? yTop - 4 : yTop + h + 11} textAnchor="middle" className="vx-axis vx-bar-val">
                  {compact(v)}
                </text>
              )}
              <text x={cx} y={height - 6} textAnchor="middle" className={`vx-axis${highlight === i ? ' vx-axis-strong' : ''}`}>
                {labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}
