import { useEffect, useMemo, useState } from 'react';
import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS } from '../utils/analytics';
import { Segmented } from './charts/ChartKit';

/*
 * Future buys: one global wishlist of things you plan to buy someday (music system, sofa, trip…)
 * with a budget, an optional target month and priority. Cross them off when done.
 * Stored ONLY in this browser (localStorage) — never touches entries or any app data.
 */

const KEY = 'rough-plan:future-buys';

function loadItems() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(d?.items) ? d.items : [];
  } catch {
    return [];
  }
}

function parseAmount(v) {
  const m = String(v || '')
    .replace(/[₹,\s]/g, '')
    .match(/^(\d+(?:\.\d+)?)(k|l|lac|lakh|cr)?$/i);
  if (!m) return 0;
  const unit = (m[2] || '').toLowerCase();
  return parseFloat(m[1]) * (unit === 'k' ? 1e3 : unit === 'cr' ? 1e7 : unit ? 1e5 : 1);
}

let seq = 0;
const newId = () => `fb${Date.now().toString(36)}${(seq += 1)}`;

function monthOptions(count = 24) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` };
  });
}
const whenLabel = (v) => {
  if (!v) return 'Someday';
  const [y, m] = v.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
};

export default function FutureBuys({ onAddToPlan }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const [items, setItems] = useState(loadItems);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [when, setWhen] = useState('');
  const [priority, setPriority] = useState('must');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState(null);
  const months = useMemo(() => monthOptions(24), []);

  useEffect(() => {
    try {
      if (items.length) localStorage.setItem(KEY, JSON.stringify({ items, updatedAt: Date.now() }));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setItems((p) => [...p, { id: newId(), name: name.trim(), budget: parseAmount(budget), when, priority, done: false, createdAt: Date.now() }]);
    setName('');
    setBudget('');
  };
  const patch = (id, ch) => setItems((p) => p.map((i) => (i.id === id ? { ...i, ...ch } : i)));
  const remove = (id) => setItems((p) => p.filter((i) => i.id !== id));

  const open = items
    .filter((i) => !i.done)
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'must' ? -1 : 1) || (a.when || '9999').localeCompare(b.when || '9999'));
  const done = items.filter((i) => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const openTotal = open.reduce((s, i) => s + (i.budget || 0), 0);
  const mustTotal = open.filter((i) => i.priority === 'must').reduce((s, i) => s + (i.budget || 0), 0);
  const doneTotal = done.reduce((s, i) => s + (i.budget || 0), 0);
  const money = (v) => (hideAmounts ? inr(v) : compact(v));
  const nowKey = months[0].value;

  // group open items by when
  const groups = [];
  open.forEach((i) => {
    const k = i.when || '';
    let g = groups.find((x) => x.k === k);
    if (!g) groups.push((g = { k, items: [] }));
    g.items.push(i);
  });
  groups.sort((a, b) => (a.k || '9999').localeCompare(b.k || '9999'));

  const renderItem = (i) =>
    editing === i.id ? (
      <li key={i.id} className="fb-item is-editing">
        <div className="fb-edit">
          <input defaultValue={i.name} onBlur={(e) => e.target.value.trim() && patch(i.id, { name: e.target.value.trim() })} aria-label="Name" />
          <input defaultValue={i.budget || ''} inputMode="decimal" onBlur={(e) => patch(i.id, { budget: parseAmount(e.target.value) })} aria-label="Budget" placeholder="Budget" />
          <select value={i.when || ''} onChange={(e) => patch(i.id, { when: e.target.value })} aria-label="When">
            <option value="">Someday</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input defaultValue={i.note || ''} onBlur={(e) => patch(i.id, { note: e.target.value })} placeholder="Note (optional)" aria-label="Note" />
          <div className="fb-edit-actions">
            <button type="button" className="ghost-btn small" onClick={() => patch(i.id, { priority: i.priority === 'must' ? 'nice' : 'must' })}>
              {i.priority === 'must' ? 'Make it “Nice to have”' : 'Make it “Must buy”'}
            </button>
            <button type="button" className="ghost-btn small danger-text" onClick={() => remove(i.id)}>
              Remove
            </button>
            <button type="button" className="primary-btn small" onClick={() => setEditing(null)}>
              Done
            </button>
          </div>
        </div>
      </li>
    ) : (
      <li key={i.id} className={`fb-item${i.done ? ' is-done' : ''}${i.priority === 'nice' ? ' is-nice' : ''}`}>
        <button
          type="button"
          className="rp-check"
          onClick={() => patch(i.id, { done: !i.done, doneAt: i.done ? null : Date.now() })}
          aria-label={i.done ? 'Mark not done' : 'Mark bought'}
        >
          {i.done ? '✓' : ''}
        </button>
        <button type="button" className="fb-main" onClick={() => setEditing(i.id)}>
          <span className="fb-name">{i.name}</span>
          <span className="fb-meta">
            <em className={`fb-pri ${i.priority}`}>{i.priority === 'must' ? 'Must buy' : 'Nice to have'}</em>
            {i.when && i.when < nowKey && !i.done && <em className="fb-late">overdue</em>}
            {i.note && <span className="fb-note">{i.note}</span>}
          </span>
        </button>
        <span className="fb-right">
          <b>{i.budget ? money(i.budget) : '—'}</b>
          {!i.done && onAddToPlan && i.when && (
            i.inPlan === i.when ? (
              <span className="fb-inplan">In {whenLabel(i.when).split(' ')[0]} plan ✓</span>
            ) : (
              <button
                type="button"
                className="link-btn small"
                onClick={() => {
                  patch(i.id, { inPlan: i.when });
                  onAddToPlan(i);
                }}
                title="Add as an expense line in that month's plan"
              >
                + to plan
              </button>
            )
          )}
        </span>
      </li>
    );

  return (
    <div className="future-buys">
      <div className="card rp-summary">
        <div className="rp-sum-grid">
          <div>
            <span>To buy ({open.length})</span>
            <b>{money(openTotal)}</b>
          </div>
          <div>
            <span>Must buy</span>
            <b className="exp">{money(mustTotal)}</b>
          </div>
          <div>
            <span>Done ({done.length})</span>
            <b className="inv">{money(doneTotal)}</b>
          </div>
        </div>
      </div>

      <form className="card fb-add" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What? e.g. Music system" aria-label="What to buy" />
        <div className="fb-add-row">
          <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget e.g. 45k" inputMode="decimal" aria-label="Budget" />
          <select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When">
            <option value="">Someday</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fb-add-row">
          <Segmented value={priority} onChange={setPriority} options={[{ value: 'must', label: 'Must buy' }, { value: 'nice', label: 'Nice to have' }]} />
          <button type="submit" className="primary-btn small" disabled={!name.trim()}>
            Add
          </button>
        </div>
      </form>

      {open.length === 0 && !done.length && (
        <p className="muted small fb-empty">Nothing here yet. Add the big things you want to buy later (music system, sofa, trip…) with a rough budget.</p>
      )}

      {groups.map((g) => (
        <div key={g.k || 'someday'} className="card fb-group">
          <div className="rp-section-head">
            <span className="rp-heading">{whenLabel(g.k)}</span>
            <span className="rp-subtotal">{money(g.items.reduce((s, i) => s + (i.budget || 0), 0))}</span>
          </div>
          <ul className="fb-list">
            {g.items.map(renderItem)}
          </ul>
        </div>
      ))}

      {done.length > 0 && (
        <div className="card fb-group fb-done">
          <button type="button" className="rp-section-head fb-done-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            <span className="rp-heading">
              {showDone ? '▾' : '▸'} Done · {done.length}
            </span>
            <span className="rp-subtotal">{money(doneTotal)}</span>
          </button>
          {showDone && (
            <ul className="fb-list">
              {done.map(renderItem)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
