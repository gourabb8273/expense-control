import { useState } from 'react';

function readOpen(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

/**
 * Card wrapper for the new charts: title, one-line takeaway, optional right-side control.
 * With `collapseId` the card folds to its title + takeaway and remembers open/closed on this device.
 */
export function VxCard({ title, subtitle, right, children, className = '', wide = false, id, collapseId, defaultOpen = false }) {
  const key = collapseId ? `vx-open:${collapseId}` : null;
  const [open, setOpen] = useState(() => (key ? readOpen(key, defaultOpen) : true));
  const toggle = () =>
    setOpen((v) => {
      try {
        if (key) localStorage.setItem(key, v ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !v;
    });
  return (
    <div className={`card vx-card${wide ? ' vx-wide' : ''}${key && !open ? ' is-collapsed' : ''} ${className}`} id={id}>
      <div className="vx-card-head">
        {key ? (
          <button type="button" className="vx-card-titles vx-card-toggle" onClick={toggle} aria-expanded={open}>
            <h3>
              <span className="section-header-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span> {title}
            </h3>
            {subtitle && <p className="vx-subtitle">{subtitle}</p>}
          </button>
        ) : (
          <div className="vx-card-titles">
            <h3>{title}</h3>
            {subtitle && <p className="vx-subtitle">{subtitle}</p>}
          </div>
        )}
        {right && open && <div className="vx-card-right">{right}</div>}
      </div>
      {open && children}
    </div>
  );
}

/** Small spinner used instead of showing ₹0 while data is still loading. */
export function Loading({ text = 'Loading…', inline = false }) {
  return (
    <div className={`vx-loading${inline ? ' inline' : ''}`} role="status" aria-live="polite">
      <span className="vx-spinner" aria-hidden="true" />
      <span>{text}</span>
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

