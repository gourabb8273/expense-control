import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

function resolveLoadedInflows(data) {
  const fromApi = data?.inflows;
  if (Array.isArray(fromApi) && fromApi.length > 0) {
    const salary = fromApi.find((r) => r.kind === 'salary');
    const carry = fromApi.find((r) => r.kind === 'carryforward');
    const custom = fromApi.filter((r) => r.kind !== 'salary' && r.kind !== 'carryforward');
    const rows = [
      salary || { label: 'Salary', amount: 0, kind: 'salary' },
      ...(carry ? [carry] : []),
      ...custom,
    ];
    return rows;
  }
  return [{ label: 'Salary', amount: 0, kind: 'salary' }];
}

function orderInflowsForSave(rows) {
  const salary = rows.find((r) => r.kind === 'salary') || {
    label: 'Salary',
    amount: 0,
    kind: 'salary',
  };
  const carry = rows.find((r) => r.kind === 'carryforward');
  const custom = rows.filter((r) => r.kind !== 'salary' && r.kind !== 'carryforward');
  return [salary, ...(carry ? [carry] : []), ...custom];
}

export default function CashInflowSection({ year, month, onTotalChange, onSaved }) {
  const toast = useToast();
  const [inflows, setInflows] = useState([{ label: 'Salary', amount: 0, kind: 'salary' }]);
  const [carryForwardInfo, setCarryForwardInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const saveTimerRef = useRef(null);
  const skipNextSaveRef = useRef(false);
  const userEditedRef = useRef(false);
  const inflowsRef = useRef(inflows);
  inflowsRef.current = inflows;

  const total = inflows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const load = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setLoading(true);
    try {
      const res = await api.get('/cashflow', {
        params: { year, month },
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = res.data;
      skipNextSaveRef.current = true;
      userEditedRef.current = false;
      setInflows(resolveLoadedInflows(data));
      setCarryForwardInfo(data.carryForward || null);
      onTotalChange?.(data.total ?? 0);
    } catch {
      skipNextSaveRef.current = true;
      userEditedRef.current = false;
      setInflows([{ label: 'Salary', amount: 0, kind: 'salary' }]);
      setCarryForwardInfo(null);
      onTotalChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [year, month, onTotalChange]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    async (rows, targetYear, targetMonth) => {
      const ordered = orderInflowsForSave(rows);
      setSaving(true);
      try {
        const res = await api.put('/cashflow', {
          year: Number(targetYear),
          month: Number(targetMonth),
          inflows: ordered,
          explicitInflow: true,
        });
        const totalSaved = res.data.total ?? 0;
        skipNextSaveRef.current = true;
        setInflows(resolveLoadedInflows(res.data));
        onTotalChange?.(totalSaved);
        onSaved?.(totalSaved);
        setSavedAt(new Date());
        return true;
      } catch {
        toast.error('Could not save cash inflow');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onTotalChange, onSaved, toast]
  );

  const yearRef = useRef(year);
  const monthRef = useRef(month);
  yearRef.current = year;
  monthRef.current = month;

  useEffect(() => {
    if (loading) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!userEditedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persist(inflowsRef.current, yearRef.current, monthRef.current);
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [inflows, loading, persist]);

  const markEdited = () => {
    userEditedRef.current = true;
  };

  const updateRow = (index, patch) => {
    markEdited();
    setInflows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addCustomRow = () => {
    markEdited();
    setInflows((prev) => [...prev, { label: '', amount: 0, kind: 'custom' }]);
  };

  const removeRow = (index) => {
    markEdited();
    setInflows((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleCarryForward = (include) => {
    if (!carryForwardInfo?.available) return;
    markEdited();
    const label = `Carried from ${carryForwardInfo.prevMonthLabel}`;
    const amount = carryForwardInfo.available;

    setInflows((prev) => {
      const without = prev.filter((r) => r.kind !== 'carryforward');
      if (!include) return without;
      const salary = without.find((r) => r.kind === 'salary') || {
        label: 'Salary',
        amount: 0,
        kind: 'salary',
      };
      const custom = without.filter((r) => r.kind !== 'salary');
      return [salary, { label, amount, kind: 'carryforward' }, ...custom];
    });
    setCarryForwardInfo((prev) => (prev ? { ...prev, included: include } : prev));
  };

  const carryForwardIncluded = inflows.some((r) => r.kind === 'carryforward');
  const canOfferCarryForward =
    carryForwardInfo?.available > 0 || carryForwardIncluded;

  if (loading) {
    return (
      <section className="card cash-inflow-section">
        <h2>Cash inflow</h2>
        <p className="muted cash-inflow-hint">Loading…</p>
      </section>
    );
  }

  return (
    <section className="card cash-inflow-section">
      <h2>Cash inflow</h2>

      {canOfferCarryForward && (
        <label className="carry-forward-option">
          <input
            type="checkbox"
            checked={carryForwardIncluded}
            onChange={(e) => toggleCarryForward(e.target.checked)}
            disabled={!carryForwardInfo?.available && !carryForwardIncluded}
          />
          <span>
            {carryForwardIncluded ? (
              <>
                Include carry forward from {carryForwardInfo?.prevMonthLabel}
                {carryForwardInfo?.available > 0 && (
                  <span className="carry-forward-amount">
                    {' '}
                    (₹{Number(carryForwardInfo.available).toLocaleString('en-IN')} available)
                  </span>
                )}
              </>
            ) : (
              <>
                Carry forward leftover from {carryForwardInfo?.prevMonthLabel}
                <span className="carry-forward-amount">
                  {' '}
                  — ₹{Number(carryForwardInfo.available).toLocaleString('en-IN')}
                </span>
              </>
            )}
          </span>
        </label>
      )}

      <div className="inflow-list">
        {inflows.map((row, index) => {
          const isSalary = row.kind === 'salary';
          const isCarryForward = row.kind === 'carryforward';

          return (
            <div
              key={`${row.kind}-${index}`}
              className={`inflow-row${isCarryForward ? ' inflow-row-carryforward' : ''}`}
            >
              {isSalary ? (
                <span className="inflow-label-fixed">Salary</span>
              ) : isCarryForward ? (
                <span className="inflow-label-fixed inflow-label-carryforward">{row.label}</span>
              ) : (
                <input
                  type="text"
                  className="inflow-label-input"
                  placeholder="Source (e.g. Bonus, Freelance)"
                  value={row.label}
                  onChange={(e) => updateRow(index, { label: e.target.value })}
                />
              )}
              <input
                type="number"
                min="0"
                step="0.01"
                className="cashflow-input inflow-amount-input"
                value={row.amount === 0 ? '' : row.amount}
                onChange={(e) =>
                  updateRow(index, { amount: e.target.value === '' ? 0 : Number(e.target.value) })
                }
                placeholder="0"
              />
              {!isSalary && !isCarryForward && (
                <button
                  type="button"
                  className="link-btn danger small inflow-remove-btn"
                  onClick={() => removeRow(index)}
                  aria-label="Remove inflow"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="inflow-actions">
        <button type="button" className="ghost-btn small inflow-add-btn" onClick={addCustomRow}>
          + Add inflow
        </button>
        <div className="inflow-total">
          <span className="inflow-total-label">Total inflow</span>
          <strong className="inflow-total-value">₹{total.toLocaleString('en-IN')}</strong>
          {saving && <span className="inflow-save-status muted">Saving…</span>}
          {!saving && savedAt && (
            <span className="inflow-save-status muted">Saved</span>
          )}
        </div>
      </div>
    </section>
  );
}
