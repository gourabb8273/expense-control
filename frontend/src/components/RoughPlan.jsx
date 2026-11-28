import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS, sumBy } from '../utils/analytics';
import { Segmented } from './charts/ChartKit';
import FutureBuys from './FutureBuys';

/*
 * Rough plan: plan this month or a coming month like a notepad — each line is an Expense,
 * an Investment or a plain Note, can be crossed out, and totals update as you type.
 * Stored ONLY in this browser (localStorage). It only READS your recurring rules and inflow
 * (GET requests) and never changes entries or any app data.
 */

const keyFor = (y, m) => `rough-plan:${y}-${String(m).padStart(2, '0')}`;

function inferKind(l, current) {
  if (l.kind) return l.kind;
  const t = String(l.text || '').trim();
  if (/^#|:\s*$/.test(t)) return { heading: /invest/i.test(t) ? 'investment' : /expen|spend/i.test(t) ? 'expense' : 'note' };
  return current;
}

function load(y, m) {
  try {
    const raw = localStorage.getItem(keyFor(y, m));
    const data = raw ? JSON.parse(raw) : null;
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    // Older plans used "Expenses:" / "Investments:" headings: convert them to typed lines
    let cur = 'expense';
    const out = [];
    lines.forEach((l) => {
      const k = inferKind(l, cur);
      if (typeof k === 'object') {
        cur = k.heading === 'note' ? cur : k.heading;
        return;
      }
      out.push({ id: l.id, text: l.text, done: !!l.done, kind: l.kind || (amountIn(l.text) > 0 ? k : 'note') });
    });
    return out;
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

/** "Rent 32000", "SIP - 15k", "trip 1.5L", "groceries 8,500" → number. */
function amountIn(text) {
  const clean = String(text).replace(/₹/g, '');
  const m =
    clean.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|l|lac|lakh|lakhs|cr)?\s*\W*$/i) ||
    clean.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|l|lac|lakh|lakhs|cr)?\b/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').toLowerCase();
  const mult = unit === 'k' ? 1e3 : unit === 'cr' ? 1e7 : unit ? 1e5 : 1;
  return Number.isFinite(n) ? n * mult : 0;
}

const KINDS = [
  { value: 'expense', label: 'Expense' },
  { value: 'investment', label: 'Invest' },
  { value: 'note', label: 'Note' },
];
const KIND_NEXT = { expense: 'investment', investment: 'note', note: 'expense' };

function upcomingMonths(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1, i };
  });
}

export default function RoughPlan({ year, month }) {
  const { inr, compact, hideAmounts } = useFormatMoney();
  const months = useMemo(() => upcomingMonths(6), []);
  // Plans are for this month or a coming month: start on the month you're viewing if it isn't in the past
  const [sel, setSel] = useState(() => {
    const hit = months.find((p) => p.y === year && p.m === month);
    return hit || months[0];
  });
  const [lines, setLines] = useState(() => load(sel.y, sel.m));
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState('expense');
  const [editing, setEditing] = useState(null);
  const [rules, setRules] = useState(null);
  const [inflowInfo, setInflowInfo] = useState(null);
  const [actualTx, setActualTx] = useState([]);
  const [mode, setMode] = useState('month');
  const loadedFor = useRef(`${sel.y}-${sel.m}`);
  const inputRef = useRef(null);
  const isCurrent = sel.i === 0;

  useEffect(() => {
    loadedFor.current = `${sel.y}-${sel.m}`;
    setLines(load(sel.y, sel.m));
    setEditing(null);
  }, [sel]);

  useEffect(() => {
    if (loadedFor.current === `${sel.y}-${sel.m}`) save(sel.y, sel.m, lines);
  }, [lines, sel]);

  // Read-only: recurring rules (to pre-fill) and the month's inflow / usual salary (to compare)
  useEffect(() => {
    let cancelled = false;
    api
      .get('/recurring')
      .then((r) => !cancelled && setRules((r.data?.rules || []).filter((x) => x.active !== false)))
      .catch(() => !cancelled && setRules([]));
    return () => {
      cancelled = true;
    };
  }, []);
  // Read-only: this month's entries, to compare plan vs actual
  useEffect(() => {
    if (!isCurrent) return undefined;
    let cancelled = false;
    api
      .get('/transactions', { params: { year: sel.y, month: sel.m } })
      .then((r) => !cancelled && setActualTx(r.data?.transactions || []))
      .catch(() => !cancelled && setActualTx([]));
    return () => {
      cancelled = true;
    };
  }, [sel, isCurrent]);

  useEffect(() => {
    let cancelled = false;
    setInflowInfo(null);
    api
      .get('/cashflow', { params: { year: sel.y, month: sel.m } })
      .then((r) => {
        if (cancelled) return;
        const d = r.data || {};
        const saved = d.hasSavedRecord ? Number(d.total) || 0 : 0;
        const usual = Number(d.defaultMonthlySalary) || Number(d.lastKnownSalary) || 0;
        setInflowInfo(saved > 0 ? { amount: saved, source: 'saved' } : usual > 0 ? { amount: usual, source: 'usual' } : { amount: 0 });
      })
      .catch(() => !cancelled && setInflowInfo({ amount: 0 }));
    return () => {
      cancelled = true;
    };
  }, [sel]);

  const add = (text, k = kind) => {
    const parts = String(text)
      .split(/\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setLines((prev) => [...prev, ...parts.map((t) => ({ id: newId(), text: t, done: false, kind: k }))]);
  };

  const groups = useMemo(() => {
    const g = { expense: [], investment: [], note: [] };
    lines.forEach((l) => g[l.kind || 'note'].push(l));
    const total = (arr, done) => arr.filter((l) => l.done === done).reduce((s, l) => s + amountIn(l.text), 0);
    return {
      ...g,
      expTotal: total(g.expense, false) + total(g.expense, true),
      invTotal: total(g.investment, false) + total(g.investment, true),
      expOpen: total(g.expense, false),
      invOpen: total(g.investment, false),
    };
  }, [lines]);

  const outflow = groups.expTotal + groups.invTotal;
  const inflow = inflowInfo?.amount || 0;
  const left = inflow - outflow;
  const actualExp = isCurrent ? sumBy(actualTx, 'expense') : 0;
  const actualInv = isCurrent ? sumBy(actualTx, 'investment') : 0;

  const prev = sel.m === 1 ? { y: sel.y - 1, m: 12 } : { y: sel.y, m: sel.m - 1 };
  const prevLines = lines.length ? [] : load(prev.y, prev.m);
  const rulesToAdd = (rules || []).filter(
    (r) => !lines.some((l) => l.text.toLowerCase().startsWith(String(r.name).toLowerCase()))
  );

  const toggle = (id) => setLines((p) => p.map((l) => (l.id === id ? { ...l, done: !l.done } : l)));
  const cycleKind = (id) => setLines((p) => p.map((l) => (l.id === id ? { ...l, kind: KIND_NEXT[l.kind || 'note'] } : l)));
  const remove = (id) => setLines((p) => p.filter((l) => l.id !== id));
  const update = (id, text) =>
    setLines((p) => (text.trim() ? p.map((l) => (l.id === id ? { ...l, text } : l)) : p.filter((l) => l.id !== id)));

  const money = (v) => (hideAmounts ? inr(v) : compact(v));

  const renderLine = (l) =>
    editing === l.id ? (
      <li key={l.id} className="rp-line is-editing">
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
      <li key={l.id} className={`rp-line${l.done ? ' is-done' : ''}`}>
        <button type="button" className="rp-check" onClick={() => toggle(l.id)} aria-label={l.done ? 'Un-cross' : 'Cross out'}>
          {l.done ? '✓' : ''}
        </button>
        <button type="button" className="rp-text" onClick={() => setEditing(l.id)}>
          {l.text}
        </button>
        <span className="rp-right">
          {l.kind !== 'note' && amountIn(l.text) > 0 && <span className="rp-amt">{money(amountIn(l.text))}</span>}
          <button type="button" className={`rp-kind k-${l.kind}`} onClick={() => cycleKind(l.id)} title="Tap to change type">
            {l.kind === 'investment' ? 'Invest' : l.kind === 'expense' ? 'Exp' : 'Note'}
          </button>
        </span>
        <button type="button" className="rp-del" onClick={() => remove(l.id)} aria-label="Remove line">
          ×
        </button>
      </li>
    );

  const section = (k, title, total, open) =>
    groups[k].length > 0 && (
      <div className={`rp-section rp-${k}`}>
        <div className="rp-section-head">
          <span className="rp-heading">{title}</span>
          {k !== 'note' && (
            <span className="rp-subtotal">
              {money(total)}
              {open !== total && <small> · {money(open)} left to do</small>}
            </span>
          )}
        </div>
        <ul className="rp-lines">{groups[k].map(renderLine)}</ul>
      </div>
    );

  // From the Future buys list: drop an item into its target month's plan as an expense line
  const addToMonthPlan = (item) => {
    const [y, m] = item.when.split('-').map(Number);
    const line = { id: newId(), text: `${item.name} ${item.budget || ''}`.trim(), done: false, kind: 'expense' };
    if (y === sel.y && m === sel.m) setLines((p) => [...p, line]);
    else save(y, m, [...load(y, m), line]);
    const target = months.find((p) => p.y === y && p.m === m);
    if (target) setSel(target);
    setMode('month');
  };

  const modeSwitch = (
    <div className="rp-mode">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'month', label: 'Monthly plan' },
          { value: 'future', label: 'Future buys' },
        ]}
      />
    </div>
  );

  if (mode === 'future') {
    return (
      <section className="rough-plan" aria-label="Future buys">
        {modeSwitch}
        <FutureBuys onAddToPlan={addToMonthPlan} />
        <p className="rp-note muted small">Saved on this device only. It never changes your entries or any app data.</p>
      </section>
    );
  }

  return (
    <section className="rough-plan" aria-label="Rough plan">
      {modeSwitch}
      <div className="rp-months no-swipe" role="tablist" aria-label="Plan month">
        {months.map((p) => (
          <button
            key={`${p.y}-${p.m}`}
            type="button"
            role="tab"
            aria-selected={sel.i === p.i}
            className={`rp-month${sel.i === p.i ? ' is-active' : ''}`}
            onClick={() => setSel(p)}
          >
            <b>{MONTH_LABELS[p.m - 1]}</b>
            <small>{p.i === 0 ? 'This month' : p.i === 1 ? 'Next' : p.y}</small>
          </button>
        ))}
      </div>

      <div className="card rp-summary">
        <div className="rp-sum-grid">
          <div>
            <span>Expenses</span>
            <b className="exp">{money(groups.expTotal)}</b>
          </div>
          <div>
            <span>Investments</span>
            <b className="inv">{money(groups.invTotal)}</b>
          </div>
          <div>
            <span>Total out</span>
            <b>{money(outflow)}</b>
          </div>
        </div>
        {inflowInfo == null ? null : inflow > 0 ? (
          <div className="rp-sum-left">
            <span>
              {inflowInfo.source === 'saved' ? 'Inflow' : 'Usual salary'} {money(inflow)} − plan {money(outflow)}
            </span>
            <b className={left < 0 ? 'bad' : 'good'}>
              {left < 0 ? 'Short by ' : 'Left '}
              {money(Math.abs(left))}
            </b>
          </div>
        ) : (
          <p className="muted small rp-sum-note">Add this month’s inflow on the Month tab to see what’s left after your plan.</p>
        )}
        {isCurrent && outflow > 0 && (actualExp > 0 || actualInv > 0) && (
          <div className="rp-sum-actual">
            Actual so far: {money(actualExp)} spent
            {groups.expTotal > 0 && ` (${Math.round((actualExp / groups.expTotal) * 100)}% of plan)`} · {money(actualInv)} invested
            {groups.invTotal > 0 && ` (${Math.round((actualInv / groups.invTotal) * 100)}% of plan)`}
          </div>
        )}
      </div>

      <div className="card rp-card">
        <form
          className="rp-add"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
            setDraft('');
            inputRef.current?.focus();
          }}
        >
          <Segmented value={kind} onChange={setKind} options={KINDS} />
          <div className="rp-add-row">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text');
                if (t.includes('\n')) {
                  e.preventDefault();
                  add(t);
                }
              }}
              placeholder={kind === 'investment' ? 'e.g. Nifty SIP 15k' : kind === 'expense' ? 'e.g. Home loan EMI 30k' : 'e.g. call CA about tax'}
              aria-label="New line"
            />
            <button type="submit" className="primary-btn small" disabled={!draft.trim()}>
              Add
            </button>
          </div>
        </form>

        {lines.length === 0 && (
          <div className="rp-empty">
            <p className="muted small">
              Pick <b>Expense</b> or <b>Invest</b>, type the item with an amount (<b>Home loan 30k</b>, <b>SIP 15000</b>, <b>Trip 1.2L</b>) and tap Add.
              Tap a line’s circle to cross it out when done.
            </p>
            <div className="rp-empty-actions">
              {prevLines.length > 0 && (
                <button
                  type="button"
                  className="ghost-btn small"
                  onClick={() => setLines(prevLines.map((l) => ({ ...l, id: newId(), done: false })))}
                >
                  Copy {MONTH_LABELS[prev.m - 1]}’s plan ({prevLines.length})
                </button>
              )}
            </div>
          </div>
        )}
        {rulesToAdd.length > 0 && (
          <button
            type="button"
            className="ghost-btn small rp-rules"
            onClick={() =>
              setLines((p) => [
                ...p,
                ...rulesToAdd.map((r) => ({ id: newId(), text: `${r.name} ${r.amount}`, done: false, kind: r.type === 'investment' ? 'investment' : 'expense' })),
              ])
            }
          >
            + Add my {rulesToAdd.length} recurring item{rulesToAdd.length === 1 ? '' : 's'} to the plan
          </button>
        )}

        {section('expense', 'Expenses', groups.expTotal, groups.expOpen)}
        {section('investment', 'Investments', groups.invTotal, groups.invOpen)}
        {section('note', 'Notes')}
      </div>
      <p className="rp-note muted small">Saved on this device only. Planning here never changes your entries or any app data.</p>
    </section>
  );
}
