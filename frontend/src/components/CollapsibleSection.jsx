import { useState } from 'react';

function readOpen(storageKey, fallback) {
  try {
    const v = localStorage.getItem(storageKey);
    return v == null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

/** Card with a clickable header; remembers open/closed per id. Shows `summary` while collapsed. */
export default function CollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = false,
  className = '',
  headerExtra,
  children,
  ...rest
}) {
  const storageKey = `section-open:${id}`;
  const [open, setOpen] = useState(() => readOpen(storageKey, defaultOpen));

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        // storage unavailable; keep in-memory state only
      }
      return next;
    });
  };

  return (
    <section className={`card collapsible-section${open ? ' is-open' : ''} ${className}`} {...rest}>
      <div className="collapsible-section-header">
        <button type="button" className="section-header-toggle" onClick={toggle} aria-expanded={open}>
          <span className="section-header-chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <h2>{title}</h2>
        </button>
        {!open && summary && <span className="collapsible-section-summary muted small">{summary}</span>}
        {open && headerExtra}
      </div>
      {open && <div className="collapsible-section-body">{children}</div>}
    </section>
  );
}
