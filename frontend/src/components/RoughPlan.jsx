import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS, sumBy } from '../utils/analytics';

/*
 * Rough plan: a notepad for the month (like a phone notes app), with tap-to-cross-out lines,
 * headings and automatic totals. It is stored ONLY in this browser (localStorage) — it never
 * touches the app's database or your entries.
 */

const keyFor = (y, m) => `rough-plan:${y}-${String(m).padStart(2, '0')}`;

function load(y, m) {
  try {
    const raw = localStorage.getItem(keyFor(y, m));
    const data = raw ? JSON.parse(raw) : null;
    return Array.isArray(data?.lines) ? data.lines : [];
  } catch {
    return [];
  }
}

function save(y, m, lines) {
  try {
    if (lines.length) localStorage.setItem(keyFor(y, m), JSON.stringify({ lines, updatedAt: Date.now() }));
    else localStorage.removeItem(keyFor(y, m));
  } catch {
    /* storage full or blocked: keep in memory */
  }
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}${(seq += 1)}`;

/** "Rent 32000", "SIP - 15k", "trip 1.5L", "groceries 8,500" → number (last amount on the line). */
function amountIn(text) {
  const m = String(text).replace(/₹/g, '').match(/(\d[\d,]*(?:\.\d+)?)\s*(k|l|lac|lakh|lakhs|cr)?\s*$/i) ||
    String(text).replace(/₹/g, '').match(/(\d[\d,]*(?:\.\d+)?)\s*(k|l|lac|lakh|lakhs|cr)?\b/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').toLowerCase();
  const mult = unit === 'k' ? 1e3 : unit === 'cr' ? 1e7 : unit ? 1e5 : 1;
  return Number.isFinite(n) ? n * mult : 0;
}

const isHeading = (t) => /^#\s*/.test(t) || /:\s*$/.test(t);
const headingText = (t) => t.replace(/^#\s*/, '').replace(/:\s*$/, '');

export default function RoughPlan({ year, month, transactions }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const [lines, setLines] = useState(() => load(year, month));
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const loadedFor = useRef(`${year}-${month}`);
  const inputRef = useRef(null);

  // Switch months: load that month's page
  useEffect(() => {
    loadedFor.current = `${year}-${month}`;
    setLines(load(year, month));
    setEditing(null);
  }, [year, month]);

  useEffect(() => {
    if (loadedFor.current === `${year}-${month}`) save(year, month, lines);
  }, [lines, year, month]);

  const addLines = (text) => {
    const parts = String(text)
      .split(/\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setLines((prev) => [...prev, ...parts.map((t) => ({ id: newId(), text: t, done: false }))]);
  };

  const sections = useMemo(() => {
    const out = [];
    let cur = { id: 'root', title: null, items: [] };
    out.push(cur);
    lines.forEach((l) => {
      if (isHeading(l.text)) {
        cur = { id: l.id, title: headingText(l.text), line: l, items: [] };
        out.push(cur);
      } else cur.items.push(l);
    });
    return out
      .map((s) => ({
        ...s,
        planned: s.items.filter((i) => !i.done).reduce((a, i) => a + amountIn(i.text), 0),
        crossed: s.items.filter((i) => i.done).reduce((a, i) => a + amountIn(i.text), 0),
      }))
      .filter((s) => s.title || s.items.length);
  }, [lines]);

  const totalPlanned = sections.reduce((a, s) => a + s.planned, 0);
  const totalCrossed = sections.reduce((a, s) => a + s.crossed, 0);
  const actualSpent = sumBy(transactions, 'expense');
  const actualInvested = sumBy(transactions, 'investment');

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const prevLines = lines.length ? [] : load(prev.y, prev.m);

  const toggle = (id) => setLines((p) => p.map((l) => (l.id === id ? { ...l, done: !l.done } : l)));
  const remove = (id) => setLines((p) => p.filter((l) => l.id !== id));
  const update = (id, text) =>
    setLines((p) => (text.trim() ? p.map((l) => (l.id === id ? { ...l, text } : l)) : p.filter((l) => l.id !== id)));

  const money = (v) => (hideAmounts ? inr(v) : compact(v));

  const Row = ({ l }) =>
    editing === l.id ? (
      <li className="rp-line is-editing">
        <input
          autoFocus
          defaultValue={l.text}
          onBlur={(e) => {
            update(l.id, e.target.value);
            setEditing(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(null);
          }}
        />
      </li>
    ) : (
      <li className={`rp-line${l.done ? ' is-done' : ''}`}>
        <button type="button" className="rp-check" onClick={() => toggle(l.id)} aria-label={l.done ? 'Un-cross' : 'Cross out'}>
          {l.done ? '✓' : ''}
        </button>
        <button type="button" className="rp-text" onClick={() => setEditing(l.id)}>
          {l.text}
        </button>
        {amountIn(l.text) > 0 && !hideAmounts && <span className="rp-amt">{compact(amountIn(l.text))}</span>}
        <button type="button" className="rp-del" onClick={() => remove(l.id)} aria-label="Remove line">
          ×
        </button>
      </li>
    );

  return (
    <section className="rough-plan" aria-label="Rough plan">
      <div className="card rp-card">
        <div className="rp-head">
          <div>
            <h2>Rough plan · {MONTH_LABELS[month - 1]} {year}</h2>
            <p className="muted small">Jot down what you expect to spend or invest. Tap ○ to cross out, tap text to edit.</p>
          </div>
        </div>

        {lines.length === 0 && (
          <div className="rp-empty">
            <p className="muted small">
              Tip: write lines like <b>Rent 32000</b>, <b>SIP 15k</b>, <b>Trip 1.5L</b>. A line ending with “:” becomes a heading with its own total.
            </p>
            <div className="rp-empty-actions">
              <button type="button" className="ghost-btn small" onClick={() => addLines('Expenses:\nInvestments:')}>
                Start with Expenses / Investments
              </button>
              {prevLines.length > 0 && (
                <button
                  type="button"
                  className="ghost-btn small"
                  onClick={() => setLines(prevLines.map((l) => ({ id: newId(), text: l.text, done: false })))}
                >
                  Copy {MONTH_LABELS[prev.m - 1]}’s plan ({prevLines.length} lines)
                </button>
              )}
            </div>
          </div>
        )}

        {sections.map((s) => (
          <div key={s.id} className="rp-section">
            {s.title && (
              <div className="rp-section-head">
                {editing === s.line.id ? (
                  <input
                    autoFocus
                    className="rp-heading-input"
                    defaultValue={s.line.text}
                    onBlur={(e) => {
                      update(s.line.id, e.target.value);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                ) : (
                  <button type="button" className="rp-heading" onClick={() => setEditing(s.line.id)}>
                    {s.title}
                  </button>
                )}
                <span className="rp-subtotal">{s.planned > 0 ? money(s.planned) : ''}</span>
                <button type="button" className="rp-del" onClick={() => remove(s.line.id)} aria-label="Remove heading">
                  ×
                </button>
              </div>
            )}
            <ul className="rp-lines">
              {s.items.map((l) => (
                <Row key={l.id} l={l} />
              ))}
            </ul>
          </div>
        ))}

        <form
          className="rp-add"
          onSubmit={(e) => {
            e.preventDefault();
            addLines(draft);
            setDraft('');
            inputRef.current?.focus();
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text');
              if (t.includes('\n')) {
                e.preventDefault();
                addLines(t);
              }
            }}
            placeholder="Add a line… e.g. Electricity 2500"
            aria-label="New line"
          />
          <button type="submit" className="primary-btn small" disabled={!draft.trim()}>
            Add
          </button>
        </form>
      </div>

      {(totalPlanned > 0 || totalCrossed > 0) && (
        <div className="card rp-totals">
          <div className="rp-total-row">
            <span>Still planned</span>
            <b>{money(totalPlanned)}</b>
          </div>
          <div className="rp-total-row muted">
            <span>Crossed out</span>
            <b>{money(totalCrossed)}</b>
          </div>
          <div className="rp-total-row rp-actual">
            <span>Actual so far this month</span>
            <b>
              {money(actualSpent)} spent · {money(actualInvested)} invested
            </b>
          </div>
        </div>
      )}
      <p className="rp-note muted small">Saved on this device only. It doesn’t change your entries or any app data.</p>
    </section>
  );
}
