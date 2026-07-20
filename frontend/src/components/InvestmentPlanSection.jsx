import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { aggregateByTag } from '../utils/aggregateByTag';
import { formatSharePct } from '../utils/formatSharePct';
import {
  STANDARD_INVESTMENT_PLAN,
  SUGGESTED_PLATFORMS,
  clonePlanItems,
} from '../utils/investmentPlanTemplate';
import InvestmentPlanVisualization from './InvestmentPlanVisualization';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function TagField({ value, options, onChange }) {
  const optionNames = options.map((t) => t.name);
  const trimmed = (value || '').trim();
  const orphanTag = trimmed && !optionNames.includes(trimmed);

  return (
    <div className="bs-field bs-field-tag">
      <span className="bs-field-label bs-field-label-tag">
        <span className="bs-tag-icon" aria-hidden="true">⌁</span>
        Group
      </span>
      <select
        className="balance-sheet-tag-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        title="Group under a bucket (e.g. MF, USA ETF, RD)"
      >
        <option value="">Group</option>
        {orphanTag && <option value={trimmed}>{trimmed}</option>}
        {options.map((t) => (
          <option key={t._id} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function PlanLineRow({ item, index, tagOptions, platformOptions, onUpdate, onRemove }) {
  const platformListId = `plan-platform-list-${index}`;
  return (
    <div className="balance-sheet-row investment-plan-row">
      <div className="bs-field bs-field-name">
        <span className="bs-field-label">Allocation</span>
        <input
          type="text"
          className="bs-field-name-input"
          value={item.name}
          onChange={(e) => onUpdate(index, 'name', e.target.value)}
          placeholder="e.g. Parag Parikh Flexi Cap"
          aria-label="Allocation name"
        />
      </div>
      <TagField
        value={item.tag}
        options={tagOptions}
        onChange={(v) => onUpdate(index, 'tag', v)}
      />
      <div className="bs-field bs-field-platform">
        <span className="bs-field-label">Platform</span>
        <input
          type="text"
          className="bs-field-platform-input"
          list={platformListId}
          value={item.platform || ''}
          onChange={(e) => onUpdate(index, 'platform', e.target.value)}
          placeholder="e.g. Grow, INDmoney"
          aria-label="Broker or platform"
        />
        <datalist id={platformListId}>
          {platformOptions.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div className="bs-field bs-field-value">
        <span className="bs-field-label">Amount (₹)</span>
        <input
          type="number"
          className="bs-field-value-input"
          min="0"
          step="1"
          inputMode="numeric"
          value={item.amount || ''}
          onChange={(e) => onUpdate(index, 'amount', e.target.value)}
          placeholder="Amount"
          aria-label="Planned amount in rupees"
        />
      </div>
      <button
        type="button"
        className="link-btn danger small bs-field-remove"
        onClick={() => onRemove(index)}
        title="Remove line"
        aria-label="Remove line"
      >
        ✕
      </button>
    </div>
  );
}

function applyInitialPlan(data) {
  const items = clonePlanItems(data?.items);
  const notes = data?.notes || '';
  const carriedFrom = data?.carriedFrom || null;
  if (data?.saved || carriedFrom || items.length > 0 || notes.trim()) {
    return { items, notes, carriedFrom };
  }
  return {
    items: clonePlanItems(STANDARD_INVESTMENT_PLAN.items),
    notes: STANDARD_INVESTMENT_PLAN.notes,
    carriedFrom: null,
  };
}

export default function InvestmentPlanSection({
  year,
  month,
  tagsRefreshKey = 0,
  onSaved,
  standalone = false,
}) {
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [carriedFrom, setCarriedFrom] = useState(null);
  const [investmentTags, setInvestmentTags] = useState([]);
  const [saved, setSaved] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/investment-plan', { params: { year, month } });
      const initial = applyInitialPlan(res.data);
      setItems(initial.items);
      setNotes(initial.notes);
      setCarriedFrom(initial.carriedFrom);
      setSaved(!!res.data.saved);
      setSavedAt(res.data.savedAt || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load portfolio plan');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/categories')
      .then((res) => {
        if (cancelled) return;
        const list = res.data.categories || [];
        setInvestmentTags(list.filter((c) => c.type === 'investment'));
      })
      .catch(() => {
        if (!cancelled) setInvestmentTags([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tagsRefreshKey]);

  useEffect(() => {
    if (!year || !month) return undefined;
    setEditOpen(false);
    loadPlan();
  }, [year, month, tagsRefreshKey, loadPlan]);

  const itemsWithAmount = items.filter((i) => (i.name || '').trim() && (Number(i.amount) || 0) > 0);
  const totalPlanned = itemsWithAmount.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const itemsForTagAgg = useMemo(
    () => itemsWithAmount.map((i) => ({ ...i, value: i.amount })),
    [itemsWithAmount]
  );
  const byTag = useMemo(() => {
    const rows = aggregateByTag(itemsForTagAgg);
    return [...rows].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  }, [itemsForTagAgg]);

  const platformOptions = useMemo(() => {
    const fromItems = items
      .map((i) => (i.platform || '').trim())
      .filter(Boolean);
    return [...new Set([...SUGGESTED_PLATFORMS, ...fromItems])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [items]);

  const addLine = () => setItems([...items, { name: '', amount: 0, tag: '', platform: '' }]);
  const updateLine = (index, field, val) => {
    const next = [...items];
    next[index] = {
      ...next[index],
      [field]: field === 'amount' ? Number(val) || 0 : val,
    };
    setItems(next);
  };
  const removeLine = (index) => setItems(items.filter((_, i) => i !== index));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/investment-plan', {
        year,
        month,
        items: items.filter((i) => (i.name || '').trim()),
        notes,
      });
      setItems(clonePlanItems(res.data.items));
      setNotes(res.data.notes || '');
      setCarriedFrom(null);
      setSaved(!!res.data.saved);
      setSavedAt(res.data.savedAt || null);
      setEditOpen(false);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    setReverting(true);
    setError('');
    try {
      await loadPlan();
      setEditOpen(false);
    } finally {
      setReverting(false);
    }
  };

  const monthLabel = MONTH_NAMES[month] || month;
  const carriedLabel = carriedFrom
    ? `${MONTH_NAMES[carriedFrom.month] || carriedFrom.month} ${carriedFrom.year}`
    : null;

  return (
    <div className={`card investment-plan-card${standalone ? ' investment-plan-card-standalone' : ''}`}>
      <div className="balance-sheet-header">
        {!standalone ? (
          <button
            type="button"
            className="section-header-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span className="section-header-chevron" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            <h2>Portfolio plan · {monthLabel} {year}</h2>
            {!expanded && totalPlanned > 0 && (
              <span className="pill section-header-summary">
                ₹{totalPlanned.toLocaleString('en-IN')}
              </span>
            )}
          </button>
        ) : (
          <div className="investment-plan-standalone-head">
            <h2>{monthLabel} {year}</h2>
            {totalPlanned > 0 && (
              <span className="pill section-header-summary">
                ₹{totalPlanned.toLocaleString('en-IN')} planned
              </span>
            )}
          </div>
        )}
        <div className="balance-sheet-header-badges">
          {carriedFrom && (
            <span className="pill carried-pill">
              From {carriedLabel}
            </span>
          )}
          {saved && (
            <span className="pill saved-pill">
              Saved{savedAt ? ` · ${new Date(savedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
            </span>
          )}
          {!saved && carriedFrom && totalPlanned > 0 && (
            <span className="pill investment-plan-draft-pill">Edit &amp; save to update this month</span>
          )}
        </div>
      </div>

      {(standalone || expanded) && (
        <>
          {!standalone && (
            <p className="muted small">
              Your investment portfolio plan carries forward from the last saved month. Edit anytime and save to lock
              changes for this month — later months inherit until you save again.
            </p>
          )}

          {standalone && !saved && !carriedFrom && totalPlanned > 0 && (
            <p className="investment-plan-bootstrap-note muted small">
              Starting template loaded (₹90k split). Save to set this as your portfolio — future months will carry it forward.
            </p>
          )}

          {loading && <p className="muted small">Loading…</p>}
          {error && <div className="error-banner">{error}</div>}

          {!loading && (
            <>
              {itemsWithAmount.length > 0 ? (
                <InvestmentPlanVisualization
                  itemsWithAmount={itemsWithAmount}
                  notes={notes}
                  totalPlanned={totalPlanned}
                />
              ) : (
                <p className="muted small investment-plan-empty">
                  No portfolio plan yet. Add your allocations below and save — future months will carry this forward.
                </p>
              )}

              <div className="investment-plan-edit-panel">
                <button
                  type="button"
                  className="investment-plan-edit-toggle"
                  onClick={() => setEditOpen((v) => !v)}
                  aria-expanded={editOpen}
                >
                  <span className="section-header-chevron" aria-hidden="true">
                    {editOpen ? '▾' : '▸'}
                  </span>
                  {standalone ? 'Edit allocations' : 'Edit portfolio'}
                  {!editOpen && byTag.length > 0 && (
                    <span className="muted small investment-plan-edit-hint">
                      {byTag.map((g) => `${g.tag} ${formatSharePct(g.value, totalPlanned)}%`).join(' · ')}
                    </span>
                  )}
                </button>

                {editOpen && (
                  <div className="investment-plan-edit-body">
                    <div className="investment-plan-lines">
                      {items.map((item, i) => (
                        <PlanLineRow
                          key={`plan-${i}`}
                          item={item}
                          index={i}
                          tagOptions={investmentTags}
                          platformOptions={platformOptions}
                          onUpdate={updateLine}
                          onRemove={removeLine}
                        />
                      ))}
                      <div className="investment-plan-line-actions">
                        <button type="button" className="ghost-btn small" onClick={addLine}>
                          + Add allocation
                        </button>
                        {!saved && (
                          <button
                            type="button"
                            className="ghost-btn small"
                            onClick={handleRevert}
                            disabled={reverting}
                          >
                            {reverting ? 'Reverting…' : 'Revert unsaved changes'}
                          </button>
                        )}
                      </div>
                    </div>

                    <label className="investment-plan-notes">
                      <span className="bs-field-label">Notes (optional)</span>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Rest ₹10,000 in stock · Total budget ₹90k"
                        maxLength={2000}
                      />
                    </label>

                    <div className="balance-sheet-total investment-plan-total">
                      <span>Total planned</span>
                      <strong className="investment-plan-total-amt">
                        ₹{totalPlanned.toLocaleString('en-IN')}
                      </strong>
                    </div>

                    <div className="balance-sheet-actions">
                      <button type="button" className="primary-btn" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save for this month'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
