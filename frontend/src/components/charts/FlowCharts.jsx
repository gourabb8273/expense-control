import { useMemo, useState } from 'react';
import { useElementWidth, useTooltip } from './chartUtils';

/**
 * 3-column Sankey: sources → buckets → categories.
 * sources: [{ name, value, color }]
 * buckets: [{ name, value, color, children: [{ name, value, color }] }]
 */
export function Sankey({ sources, buckets, format, hideAmounts, height: hProp }) {
  const [ref, width] = useElementWidth();
  const { wrapRef, show, hide, node } = useTooltip();
  const [focus, setFocus] = useState(null);
  const leaves = buckets.flatMap((b) => (b.children?.length ? b.children.map((c) => ({ ...c, parent: b.name })) : []));
  const rows = Math.max(sources.length, buckets.length, leaves.length);
  const height = hProp || Math.max(260, rows * 30 + 20);
  const total = Math.max(
    sources.reduce((s, x) => s + x.value, 0),
    buckets.reduce((s, x) => s + x.value, 0)
  );
  const nodeW = 8;
  const gap = 8;
  const mobile = width < 520;
  const colX = [0, Math.round(width * (mobile ? 0.36 : 0.4)), width - nodeW];

  const layout = (items, x) => {
    const g = gap * Math.max(0, items.length - 1);
    const scale = (height - g - 4) / (total || 1);
    let y = 2;
    return items.map((it) => {
      const h = Math.max(2, it.value * scale);
      const out = { ...it, x, y, h };
      y += h + gap;
      return out;
    });
  };
  const L = layout(sources, colX[0]);
  const M = layout(buckets, colX[1]);
  const R = layout(leaves, colX[2]);

  const link = (x0, y0, x1, y1, h) => {
    const cx = (x0 + x1) / 2;
    return `M${x0},${y0}C${cx},${y0} ${cx},${y1} ${x1},${y1}L${x1},${y1 + h}C${cx},${y1 + h} ${cx},${y0 + h} ${x0},${y0 + h}Z`;
  };

  // sources → buckets: split each source proportionally across buckets
  const links1 = [];
  const mOffIn = M.map(() => 0);
  L.forEach((s) => {
    let sOff = 0;
    M.forEach((m, j) => {
      const share = total ? (s.value / total) * m.value : 0;
      const hS = s.h * (total ? m.value / total : 0);
      const hM = m.h * (s.value / (sources.reduce((a, b) => a + b.value, 0) || 1));
      links1.push({ d: link(s.x + nodeW, s.y + sOff, m.x, m.y + mOffIn[j], Math.min(hS, hM)), color: m.color, from: s.name, to: m.name, value: share });
      sOff += hS;
      mOffIn[j] += hM;
    });
  });
  const links2 = [];
  M.forEach((m) => {
    let off = 0;
    R.filter((r) => r.parent === m.name).forEach((r) => {
      links2.push({ d: link(m.x + nodeW, m.y + off, r.x, r.y, r.h), color: r.color, from: m.name, to: r.name, value: r.value });
      off += r.h;
    });
  });

  const tip = (e, l) => show(e, <><strong>{l.from} → {l.to}</strong><span>{format(l.value)}</span></>);
  const dim = (l) => focus && l.from !== focus && l.to !== focus;
  const pct = (v) => (total ? `${Math.round((v / total) * 100)}%` : '');

  return (
    <div ref={(el) => { ref.current = el; wrapRef.current = el; }} className="vx-chart-wrap">
      <svg width={width} height={height} onMouseLeave={() => { hide(); setFocus(null); }}>
        {[...links1, ...links2].map((l, i) => (
          <path
            key={i}
            d={l.d}
            fill={l.color}
            opacity={dim(l) ? 0.06 : 0.28}
            onMouseMove={(e) => tip(e, l)}
            onTouchStart={(e) => tip(e, l)}
          />
        ))}
        {[...L, ...M, ...R].map((n) => (
          <rect
            key={`${n.x}-${n.name}`}
            x={n.x}
            y={n.y}
            width={nodeW}
            height={n.h}
            rx={2}
            fill={n.color}
            onClick={() => setFocus((f) => (f === n.name ? null : n.name))}
            style={{ cursor: 'pointer' }}
          />
        ))}
        {L.map((n) => (
          <text key={`l-${n.name}`} x={n.x + nodeW + 5} y={n.y + n.h / 2 + 4} className="vx-sankey-label">
            {n.name}
            {!hideAmounts && <tspan className="vx-sankey-sub"> {format(n.value)}</tspan>}
          </text>
        ))}
        {M.map((n) => (
          <text key={`m-${n.name}`} x={n.x + nodeW + 5} y={n.y + n.h / 2 + 4} className="vx-sankey-label strong">
            {n.name}
            <tspan className="vx-sankey-sub"> {pct(n.value)}</tspan>
          </text>
        ))}
        {R.map((n) => (
          <text key={`r-${n.parent}-${n.name}`} x={n.x - 5} y={n.y + n.h / 2 + 4} textAnchor="end" className="vx-sankey-label" opacity={n.h < 9 ? 0 : 1}>
            {n.name.length > 16 ? `${n.name.slice(0, 15)}…` : n.name}
            {!mobile && !hideAmounts && <tspan className="vx-sankey-sub"> {format(n.value)}</tspan>}
          </text>
        ))}
      </svg>
      {node}
    </div>
  );
}

/** Squarified treemap. items: [{ name, value, color, group? }] */
export function Treemap({ items, format, hideAmounts, height = 260, total }) {
  const [ref, width] = useElementWidth();
  const { wrapRef, show, hide, node } = useTooltip();
  const rects = useMemo(() => squarify(items.filter((i) => i.value > 0), 0, 0, width, height), [items, width, height]);
  const sum = total || items.reduce((s, i) => s + i.value, 0);
  return (
    <div ref={(el) => { ref.current = el; wrapRef.current = el; }} className="vx-chart-wrap">
      <svg width={width} height={height} onMouseLeave={hide}>
        {rects.map((r) => {
          const big = r.w > 64 && r.h > 34;
          const tipContent = (
            <>
              <strong>{r.item.name}</strong>
              {r.item.group && <span className="muted">{r.item.group}</span>}
              <span>{format(r.item.value)} · {Math.round((r.item.value / (sum || 1)) * 100)}%</span>
            </>
          );
          return (
            <g key={`${r.item.group || ''}-${r.item.name}`} onMouseMove={(e) => show(e, tipContent)} onTouchStart={(e) => show(e, tipContent)}>
              <rect x={r.x + 1} y={r.y + 1} width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)} rx={6} fill={r.item.color} opacity={0.88} />
              {big && (
                <>
                  <text x={r.x + 8} y={r.y + 18} className="vx-tm-label">
                    {r.item.name.length > r.w / 7.5 ? `${r.item.name.slice(0, Math.max(3, Math.floor(r.w / 7.5) - 1))}…` : r.item.name}
                  </text>
                  <text x={r.x + 8} y={r.y + 33} className="vx-tm-sub">
                    {hideAmounts ? `${Math.round((r.item.value / (sum || 1)) * 100)}%` : format(r.item.value)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}

function squarify(items, x, y, w, h) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total || w <= 0 || h <= 0) return [];
  const sorted = items.slice().sort((a, b) => b.value - a.value);
  const area = w * h;
  const scaled = sorted.map((it) => ({ item: it, a: (it.value / total) * area }));
  const out = [];
  let rect = { x, y, w, h };
  let row = [];
  const worst = (r, side) => {
    const s = r.reduce((a, b) => a + b.a, 0);
    const mx = Math.max(...r.map((q) => q.a));
    const mn = Math.min(...r.map((q) => q.a));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const layoutRow = (r) => {
    const s = r.reduce((a, b) => a + b.a, 0);
    if (rect.w >= rect.h) {
      const cw = s / rect.h;
      let cy = rect.y;
      r.forEach((q) => {
        const ch = q.a / cw;
        out.push({ item: q.item, x: rect.x, y: cy, w: cw, h: ch });
        cy += ch;
      });
      rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h };
    } else {
      const ch = s / rect.w;
      let cx = rect.x;
      r.forEach((q) => {
        const cw = q.a / ch;
        out.push({ item: q.item, x: cx, y: rect.y, w: cw, h: ch });
        cx += cw;
      });
      rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch };
    }
  };
  scaled.forEach((q) => {
    const side = Math.min(rect.w, rect.h);
    if (!row.length || worst([...row, q], side) <= worst(row, side)) {
      row.push(q);
    } else {
      layoutRow(row);
      row = [q];
    }
  });
  if (row.length) layoutRow(row);
  return out;
}
