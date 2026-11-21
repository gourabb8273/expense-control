/** Card wrapper for the new charts: title, one-line takeaway, optional right-side control. */
export function VxCard({ title, subtitle, right, children, className = '', wide = false, id }) {
  return (
    <div className={`card vx-card${wide ? ' vx-wide' : ''} ${className}`} id={id}>
      <div className="vx-card-head">
        <div className="vx-card-titles">
          <h3>{title}</h3>
          {subtitle && <p className="vx-subtitle">{subtitle}</p>}
        </div>
        {right && <div className="vx-card-right">{right}</div>}
      </div>
      {children}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="vx-legend">
      {items.map((it) => (
        <span key={it.label} className="vx-legend-item">
          <span
            className={`vx-swatch${it.dashed ? ' dashed' : ''}${it.line ? ' line' : ''}`}
            style={{ background: it.dashed || it.line ? 'transparent' : it.color, borderColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="vx-seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyChart({ text }) {
  return <p className="vx-empty">{text}</p>;
}

