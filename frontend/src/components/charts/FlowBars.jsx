import { useState } from 'react';

/**
 * Mobile-friendly money flow: one stacked bar for the whole inflow (spent / invested / left),
 * then a tap-to-switch breakdown of the selected part.
 * parts: [{ key, label, value, color, children?: [{ name, value, color }] }]
 */
export function FlowBars({ inflow, parts, format, compact, hideAmounts }) {
  const [active, setActive] = useState(parts.find((p) => p.children?.length)?.key || null);
  const outflow = parts.filter((p) => p.key !== 'left').reduce((s, p) => s + p.value, 0);
  const base = Math.max(inflow, outflow, 1);
  const sel = parts.find((p) => p.key === active);
  const pct = (v) => `${Math.round((v / (inflow || base)) * 100)}%`;

  return (
    <div className="flow">
      <div className="flow-bar" role="img" aria-label="Inflow split">
        {parts.map((p) =>
          p.value > 0 ? (
            <button
              key={p.key}
              type="button"
              className={`flow-seg${active === p.key ? ' is-active' : ''}`}
              style={{ width: `${(p.value / base) * 100}%`, background: p.color }}
              onClick={() => p.children?.length && setActive(p.key)}
              aria-label={`${p.label} ${pct(p.value)}`}
            />
          ) : null
        )}
      </div>
      {outflow > inflow && inflow > 0 && (
        <p className="flow-warn">Spent + invested is {compact(outflow - inflow)} more than this month’s inflow.</p>
      )}
      <div className="flow-legend">
        {parts.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`flow-chip${active === p.key ? ' is-active' : ''}`}
            onClick={() => p.children?.length && setActive(p.key)}
            disabled={!p.children?.length}
          >
            <i style={{ background: p.color }} />
            <span className="flow-chip-label">{p.label}</span>
            <b>{hideAmounts ? pct(p.value) : compact(p.value)}</b>
            {!hideAmounts && inflow > 0 && <small>{pct(p.value)}</small>}
          </button>
        ))}
      </div>
      {sel?.children?.length > 0 && (
        <ul className="flow-list">
          {sel.children.map((c) => (
            <li key={c.name}>
              <span className="flow-list-top">
                <span className="flow-list-name">
                  <i style={{ background: c.color }} />
                  {c.name}
                </span>
                <span className="flow-list-val">
                  {format(c.value)}
                  <small> {Math.round((c.value / (sel.value || 1)) * 100)}%</small>
                </span>
              </span>
              <span className="flow-list-track">
                <span style={{ width: `${(c.value / (sel.children[0].value || 1)) * 100}%`, background: c.color }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * "What changed" as a plain list: categories that went up (red) and down (green), longest bar = biggest change.
 * rows: [{ name, value, prev, delta }]
 */
export function ChangeList({ rows, format, hideAmounts, limit = 4 }) {
  const ups = rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, limit);
  const downs = rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, limit);
  const max = Math.max(1, ...ups.map((r) => r.delta), ...downs.map((r) => -r.delta));
  const Row = ({ r }) => (
    <li className={`chg-row ${r.delta > 0 ? 'up' : 'down'}`}>
      <span className="chg-top">
        <span className="chg-name">{r.name}</span>
        <span className="chg-delta">
          {r.delta > 0 ? '+' : '−'}
          {hideAmounts ? '' : format(Math.abs(r.delta))}
        </span>
      </span>
      <span className="chg-track">
        <span style={{ width: `${(Math.abs(r.delta) / max) * 100}%` }} />
      </span>
      {!hideAmounts && (
        <span className="chg-detail">
          {r.prev ? format(r.prev) : 'nothing'} → {r.value ? format(r.value) : 'nothing'}
        </span>
      )}
    </li>
  );
  return (
    <div className="chg">
      {ups.length > 0 && (
        <div>
          <h4 className="chg-head up">Spent more on</h4>
          <ul>{ups.map((r) => <Row key={r.name} r={r} />)}</ul>
        </div>
      )}
      {downs.length > 0 && (
        <div>
          <h4 className="chg-head down">Spent less on</h4>
          <ul>{downs.map((r) => <Row key={r.name} r={r} />)}</ul>
        </div>
      )}
    </div>
  );
}
