import { useEffect, useRef, useState } from 'react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (name) {
    case 'month':
      return (<svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 3v3M16 3v3" /></svg>);
    case 'year':
      return (<svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>);
    case 'portfolio':
      return (<svg {...common}><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></svg>);
    case 'balance':
      return (<svg {...common}><path d="M12 3v18M5 21h14M4 7h16M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z" /></svg>);
    case 'notes':
      return (<svg {...common}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h5" /></svg>);
    case 'review':
      return (<svg {...common}><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" /></svg>);
    case 'plus':
      return (<svg {...common} width={26} height={26} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>);
    default:
      return null;
  }
}

/** Phone-style bottom tab bar. Only switches views / scrolls; never touches data. */
export function BottomNav({ viewMode, onChange, onAdd }) {
  const tabs = [
    { id: 'monthly', label: 'Month', icon: 'month' },
    { id: 'yearly', label: 'Year', icon: 'year' },
    { id: 'balance', label: 'Balance', icon: 'balance' },
    { id: 'add' },
    { id: 'notes', label: 'Plan', icon: 'notes' },
    { id: 'portfolio', label: 'Portfolio', icon: 'portfolio' },
    { id: 'review', label: 'Review', icon: 'review' },
  ];
  return (
    <nav className="bottom-nav" aria-label="Main">
      {tabs.map((t) =>
        t.id === 'add' ? (
          <button key="add" type="button" className="bottom-nav-fab" onClick={onAdd} aria-label="Add entry">
            <Icon name="plus" />
          </button>
        ) : (
          <button
            key={t.id}
            type="button"
            className={`bottom-nav-tab${viewMode === t.id ? ' is-active' : ''}`}
            onClick={() => onChange(t.id)}
            aria-current={viewMode === t.id ? 'page' : undefined}
          >
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        )
      )}
    </nav>
  );
}

/** ‹ Nov 2026 › stepper with "Today" shortcut, ←/→ keys, and left/right swipe on the given element. */
export function MonthStepper({ year, month, onChange, mode = 'month', swipeTargetRef }) {
  const now = new Date();
  const isNow = mode === 'year' ? year === now.getFullYear() : year === now.getFullYear() && month === now.getMonth() + 1;
  const step = (delta) => {
    if (mode === 'year') {
      onChange(year + delta, month);
      return;
    }
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };
  const [picking, setPicking] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.target?.isContentEditable) return;
      if (e.key === 'ArrowLeft') stepRef.current(-1);
      if (e.key === 'ArrowRight') stepRef.current(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const el = swipeTargetRef?.current;
    if (!el) return undefined;
    let sx = 0;
    let sy = 0;
    let st = 0;
    let ok = false;
    const start = (e) => {
      const t = e.touches[0];
      // ignore swipes that begin on charts, inputs or horizontally scrollable areas
      ok = !e.target.closest('svg, input, select, textarea, .vx-heat, .no-swipe');
      sx = t.clientX;
      sy = t.clientY;
      st = Date.now();
    };
    const end = (e) => {
      if (!ok) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - st < 600) {
        stepRef.current(dx < 0 ? 1 : -1);
      }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
    };
  }, [swipeTargetRef]);

  return (
    <div className="month-stepper" role="group" aria-label={mode === 'year' ? 'Change year' : 'Change month'}>
      <button type="button" className="stepper-btn" onClick={() => step(-1)} aria-label="Previous">
        ‹
      </button>
      <button
        type="button"
        className="stepper-label stepper-label-btn"
        onClick={() => setPicking(true)}
        aria-haspopup="dialog"
        title={mode === 'year' ? 'Pick a year' : 'Pick a month'}
      >
        {mode === 'year' ? year : `${MONTHS[month - 1]} ${year}`}
        <span className="stepper-caret" aria-hidden="true">▾</span>
      </button>
      {picking && (
        <PeriodPicker
          mode={mode}
          year={year}
          month={month}
          onClose={() => setPicking(false)}
          onPick={(y, m) => {
            setPicking(false);
            onChange(y, m);
          }}
        />
      )}
      <button type="button" className="stepper-btn" onClick={() => step(1)} aria-label="Next">
        ›
      </button>
      {!isNow && (
        <button type="button" className="stepper-today" onClick={() => onChange(now.getFullYear(), now.getMonth() + 1)}>
          Today
        </button>
      )}
    </div>
  );
}

/** Jump straight to any month/year (bottom sheet): pick a year, then a month. */
function PeriodPicker({ mode, year, month, onPick, onClose }) {
  const now = new Date();
  const [y, setY] = useState(year);
  const years = [];
  for (let v = now.getFullYear() + 1; v >= Math.min(year, now.getFullYear()) - 10; v -= 1) years.push(v);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
    };
  }, [onClose]);
  const yearRef = useRef(null);
  useEffect(() => {
    yearRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet period-sheet" role="dialog" aria-label="Pick period" onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grabber" aria-hidden="true" />
        <div className="period-head">{mode === 'year' ? 'Go to year' : 'Go to month'}</div>
        <div className="period-years no-swipe">
          {years.map((v) => (
            <button
              key={v}
              ref={v === y ? yearRef : undefined}
              type="button"
              className={`period-year${v === y ? ' is-active' : ''}`}
              onClick={() => (mode === 'year' ? onPick(v, month) : setY(v))}
            >
              {v}
            </button>
          ))}
        </div>
        {mode !== 'year' && (
          <div className="period-months">
            {MONTHS.map((label, i) => {
              const isSel = y === year && i + 1 === month;
              const isNow = y === now.getFullYear() && i === now.getMonth();
              return (
                <button
                  key={label}
                  type="button"
                  className={`period-month${isSel ? ' is-active' : ''}${isNow ? ' is-now' : ''}`}
                  onClick={() => onPick(y, i + 1)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className="sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
