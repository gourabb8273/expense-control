import { useState } from 'react';
import { useElementWidth, useTooltip, niceMax } from './chartUtils';

/**
 * One chart, one scale: assets as bars above zero, debts as bars below zero, net worth as a line.
 * Months with no balance sheet (null) are left empty.
 * labels: month names; rows: [{ label, assets, debts, net } | null] (same length)
 */
export default function BalanceBars({ rows, labels, format, compact, hideAmounts, height = 260, highlight }) {
  const [ref, width] = useElementWidth();
  const { wrapRef, show, hide, node } = useTooltip();
  const [hover, setHover] = useState(null);
  const data = rows.filter(Boolean);
  const maxUp = niceMax(Math.max(1, ...data.map((r) => Math.max(r.assets, r.net))));
  const maxDown = Math.max(0, ...data.map((r) => r.debts));
  // Give debts at least ~22% of the height so small debts are still visible
  const downShare = maxDown > 0 ? Math.max(0.22, Math.min(0.45, maxDown / (maxUp + maxDown))) : 0;
  const pad = { l: hideAmounts ? 8 : 46, r: 8, t: 14, b: 22 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const zero = pad.t + ih * (1 - downShare);
  const upScale = (zero - pad.t) / maxUp;
  const downScale = maxDown > 0 ? (pad.t + ih - zero - 14) / maxDown : 0;
  const n = rows.length;
  const bw = iw / n;
  const cx = (i) => pad.l + bw * i + bw / 2;
  const yUp = (v) => zero - Math.max(0, v) * upScale;

  const tip = (e, r, i) => {
    setHover(i);
    show(
      e,
      <>
        <strong>{r.label}</strong>
        <span className="vx-tip-row"><i style={{ background: '#06b6d4' }} />Assets: <b>{format(r.assets)}</b></span>
        <span className="vx-tip-row"><i style={{ background: '#f43f5e' }} />Debts: <b>{format(r.debts)}</b></span>
        <span className="vx-tip-row"><i style={{ background: '#22c55e' }} />Net worth: <b>{format(r.net)}</b></span>
      </>
    );
  };

  // net worth line through months that have data (breaks on gaps)
  let pen = false;
  const netPath = rows
    .map((r, i) => {
      if (!r) {
        pen = false;
        return '';
      }
      const c = `${pen ? 'L' : 'M'}${cx(i).toFixed(1)},${yUp(r.net).toFixed(1)}`;
      pen = true;
      return c;
    })
    .join('');
  const lastI = rows.reduce((acc, r, i) => (r ? i : acc), -1);
  // One debt label at a time (latest month, or the one you're touching) so labels never collide
  const labelDebt = (i) => i === (hover ?? lastI);

  return (
    <div ref={(el) => { ref.current = el; wrapRef.current = el; }} className="vx-chart-wrap">
      <svg width={width} height={height} onMouseLeave={() => { hide(); setHover(null); }}>
        {!hideAmounts &&
          [0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={yUp(maxUp * t)} y2={yUp(maxUp * t)} className="vx-gridline" />
              <text x={pad.l - 6} y={yUp(maxUp * t) + 4} textAnchor="end" className="vx-axis">{compact(maxUp * t)}</text>
            </g>
          ))}
        {maxDown > 0 && !hideAmounts && (
          <text x={pad.l - 6} y={zero + maxDown * downScale + 4} textAnchor="end" className="vx-axis" style={{ fill: '#fb7185' }}>
            −{compact(maxDown)}
          </text>
        )}
        <line x1={pad.l} x2={width - pad.r} y1={zero} y2={zero} stroke="var(--vx-axis)" strokeWidth={1} />
        {rows.map((r, i) => {
          const x0 = pad.l + bw * i;
          if (!r) return null;
          const hUp = Math.max(0, r.assets) * upScale;
          const hDown = r.debts * downScale;
          const dim = hover != null && hover !== i;
          return (
            <g key={i} onMouseMove={(e) => tip(e, r, i)} onTouchStart={(e) => tip(e, r, i)} opacity={dim ? 0.55 : 1}>
              <rect x={x0} y={pad.t} width={bw} height={ih} fill="transparent" />
              <rect x={x0 + bw * 0.2} y={zero - hUp} width={bw * 0.6} height={hUp} rx={3} fill="#06b6d4" opacity={0.35} />
              {hDown > 0 && <rect x={x0 + bw * 0.2} y={zero + 1} width={bw * 0.6} height={hDown} rx={3} fill="#f43f5e" opacity={0.85} />}
              {hDown > 0 && !hideAmounts && labelDebt(i) && (
                <text x={cx(i)} y={zero + hDown + 11} textAnchor="middle" className="vx-axis" style={{ fill: '#fb7185', fontWeight: 700 }}>
                  {compact(r.debts)}
                </text>
              )}
            </g>
          );
        })}
        <path d={netPath} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
        {rows.map((r, i) =>
          r ? <circle key={`d${i}`} cx={cx(i)} cy={yUp(r.net)} r={i === lastI ? 4 : 2.5} fill="#22c55e" stroke="var(--card-bg)" strokeWidth={i === lastI ? 2 : 1} pointerEvents="none" /> : null
        )}
        {rows.map((r, i) => (
          <text key={`l${i}`} x={cx(i)} y={height - 6} textAnchor="middle" className={`vx-axis${highlight === i ? ' vx-axis-strong' : ''}`}>
            {labels[i][0]}
          </text>
        ))}
      </svg>
      {node}
    </div>
  );
}
