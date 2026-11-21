import { useMemo, useState } from 'react';
import { useElementWidth, useTooltip, niceMax } from './chartUtils';

/**
 * Multi-series line chart with optional area fill, horizontal reference line and "today" marker.
 * series: [{ key, label, color, values: number[], dashed?, area?, stopAt? }]
 */
export default function LineAreaChart({
  series,
  labels,
  height = 220,
  refLine,
  marker,
  format,
  compact,
  hideAmounts,
  yMin,
}) {
  const [ref, width] = useElementWidth();
  const { wrapRef, show, hide, node } = useTooltip();
  const [hoverIdx, setHoverIdx] = useState(null);
  const pad = { l: hideAmounts ? 12 : 52, r: 14, t: 12, b: 26 };
  const n = labels.length;
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const { max, min, tickVals } = useMemo(() => {
    const all = series.flatMap((s) => s.values.slice(0, s.stopAt ?? s.values.length));
    if (refLine?.value) all.push(refLine.value);
    const hiVal = Math.max(0, ...all) * 1.04;
    const loVal = yMin != null ? yMin : Math.min(0, ...all);
    // Round-number ticks: pick a step, then snap both ends to it
    const step = niceMax((hiVal - loVal) / 4 || 1);
    const lo = Math.floor(loVal / step) * step;
    const count = Math.max(1, Math.ceil((hiVal - lo) / step));
    return { min: lo, max: lo + step * count, tickVals: Array.from({ length: count + 1 }, (_, i) => lo + step * i) };
  }, [series, refLine, yMin]);

  const x = (i) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;

  const path = (vals, stopAt) => {
    const pts = vals.slice(0, stopAt ?? vals.length);
    return pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  };

  const onMove = (evt) => {
    const box = evt.currentTarget.getBoundingClientRect();
    const px = (evt.touches?.[0] || evt).clientX - box.left;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / (iw || 1)) * (n - 1))));
    setHoverIdx(i);
    show(
      evt,
      <>
        <strong>{labels[i]}</strong>
        {series.map((s) =>
          i < (s.stopAt ?? s.values.length) ? (
            <span key={s.key} className="vx-tip-row">
              <i style={{ background: s.color }} />
              {s.label}: <b>{format(s.values[i])}</b>
            </span>
          ) : null
        )}
        {refLine && (
          <span className="vx-tip-row">
            <i style={{ background: refLine.color }} />
            {refLine.label}: <b>{format(refLine.value)}</b>
          </span>
        )}
      </>
    );
  };

  const labelEvery = Math.ceil(n / Math.max(2, Math.floor(iw / 46)));

  return (
    <div ref={(el) => { ref.current = el; wrapRef.current = el; }} className="vx-chart-wrap">
      <svg width={width} height={height} role="img" onMouseMove={onMove} onMouseLeave={() => { setHoverIdx(null); hide(); }} onTouchStart={onMove} onTouchMove={onMove}>
        {tickVals.map((v) => {
          return (
            <g key={v}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} className="vx-gridline" />
              {!hideAmounts && (
                <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="vx-axis">
                  {compact(v)}
                </text>
              )}
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={l} x={x(i)} y={height - 6} textAnchor="middle" className="vx-axis">
              {l}
            </text>
          ) : null
        )}
        {series.map((s) =>
          s.area ? (
            <path
              key={`${s.key}-area`}
              d={`${path(s.values, s.stopAt)}L${x((s.stopAt ?? s.values.length) - 1)},${y(Math.max(min, 0))}L${x(0)},${y(Math.max(min, 0))}Z`}
              fill={s.color}
              opacity={0.14}
            />
          ) : null
        )}
        {refLine && (
          <g>
            <line x1={pad.l} x2={width - pad.r} y1={y(refLine.value)} y2={y(refLine.value)} stroke={refLine.color} strokeDasharray="5 4" strokeWidth={1.5} />
            <text x={width - pad.r} y={y(refLine.value) - 5} textAnchor="end" className="vx-axis" fill={refLine.color} style={{ fill: refLine.color }}>
              {refLine.label}
            </text>
          </g>
        )}
        {series.map((s) => (
          <path
            key={s.key}
            d={path(s.values, s.stopAt)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width || 2.25}
            strokeDasharray={s.dashed ? '4 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((s) => {
          const last = (s.stopAt ?? s.values.length) - 1;
          if (!s.endDot || last < 0) return null;
          return <circle key={`${s.key}-dot`} cx={x(last)} cy={y(s.values[last])} r={4} fill={s.color} stroke="var(--card-bg)" strokeWidth={2} />;
        })}
        {marker != null && (
          <g>
            <line x1={x(marker.index)} x2={x(marker.index)} y1={pad.t} y2={pad.t + ih} className="vx-marker" />
            <text x={x(marker.index)} y={pad.t + 10} textAnchor="middle" className="vx-axis vx-marker-label">
              {marker.label}
            </text>
          </g>
        )}
        {hoverIdx != null && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={pad.t} y2={pad.t + ih} className="vx-hover-line" />
        )}
      </svg>
      {node}
    </div>
  );
}
