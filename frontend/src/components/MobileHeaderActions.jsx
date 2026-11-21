import { useEffect, useState } from 'react';
import { usePrivacy } from '../context/PrivacyContext';

function Svg({ children }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * Phone header: theme + hide-amounts icons and a "⋯" menu (bottom sheet) holding the
 * same actions as the desktop header. Every item calls the existing handler — nothing new.
 * items: [{ label, hint?, onClick, disabled?, danger? } | 'divider']
 */
export default function MobileHeaderActions({ theme, onToggleTheme, items }) {
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
    };
  }, [open]);

  return (
    <div className="mobile-header-actions">
      <button
        type="button"
        className={`icon-btn${hideAmounts ? ' is-active' : ''}`}
        onClick={toggleHideAmounts}
        aria-pressed={hideAmounts}
        aria-label={hideAmounts ? 'Show amounts' : 'Hide amounts'}
        title={hideAmounts ? 'Show amounts' : 'Hide amounts'}
      >
        {hideAmounts ? (
          <Svg>
            <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.2A9.9 9.9 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.6 3.7M6.3 6.3C4.4 7.6 3.1 9.5 2.5 12c1 2.5 4.5 7 9.5 7 1.7 0 3.2-.5 4.5-1.3" />
          </Svg>
        ) : (
          <Svg>
            <path d="M2.5 12C3.5 9.5 7 5 12 5s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7z" />
            <circle cx="12" cy="12" r="2.6" />
          </Svg>
        )}
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? (
          <Svg>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </Svg>
        ) : (
          <Svg>
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          </Svg>
        )}
      </button>
      <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="More actions" aria-haspopup="dialog">
        <Svg>
          <circle cx="5" cy="12" r="1.3" fill="currentColor" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" />
          <circle cx="19" cy="12" r="1.3" fill="currentColor" />
        </Svg>
      </button>

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div className="sheet" role="dialog" aria-label="More actions" onClick={(e) => e.stopPropagation()}>
            <span className="sheet-grabber" aria-hidden="true" />
            <ul className="sheet-list">
              {items.map((it, i) =>
                it === 'divider' ? (
                  <li key={`d${i}`} className="sheet-divider" aria-hidden="true" />
                ) : (
                  <li key={it.label}>
                    <button
                      type="button"
                      className={`sheet-item${it.danger ? ' danger' : ''}`}
                      disabled={it.disabled}
                      onClick={() => {
                        setOpen(false);
                        it.onClick();
                      }}
                    >
                      <span>{it.label}</span>
                      {it.hint && <small>{it.hint}</small>}
                    </button>
                  </li>
                )
              )}
            </ul>
            <button type="button" className="sheet-cancel" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
