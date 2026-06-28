import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';

function inflowTotal(inflows) {
  return (inflows || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function formatInflowAmount(value) {
  if (value === '' || value == null) return '';
  const num = Number(value);
  return Number.isNaN(num) ? '' : String(num);
}

function resolveLoadedInflows(data, user) {
  const rows = Array.isArray(data?.inflows) ? data.inflows : [];
  const savedTotal = Number(data?.savedTotal ?? data?.total ?? data?.amount) || 0;
  const lastKnown = Number(data?.lastKnownSalary) || 0;
  const profileDefault = Number(user?.defaultMonthlySalary) || 0;
  const suggested = Number(user?.suggestedDefaultSalary) || profileDefault || lastKnown;

  if (inflowTotal(rows) > 0) {
    return rows.map((row) => ({
      ...row,
      amount: formatInflowAmount(row.amount),
    }));
  }
  if (savedTotal > 0) {
    return [{ label: 'Salary', amount: formatInflowAmount(savedTotal), kind: 'salary' }];
  }
  if (suggested > 0) {
    return [{ label: 'Salary', amount: formatInflowAmount(suggested), kind: 'salary' }];
  }
  return [{ label: 'Salary', amount: '', kind: 'salary' }];
}

function resolveDefaultSalaryDisplay(data, user, inflows) {
  const profileDefault = Number(user?.defaultMonthlySalary) || 0;
  if (profileDefault > 0) return String(profileDefault);

  const savedTotal = Number(data?.savedTotal) || 0;
  if (savedTotal > 0) return String(savedTotal);

  const salaryRow = inflows.find((r) => r.kind === 'salary');
  const salaryAmt = Number(salaryRow?.amount) || 0;
  if (salaryAmt > 0) return String(salaryAmt);

  const lastKnown = Number(data?.lastKnownSalary) || Number(user?.lastKnownSalary) || 0;
  if (lastKnown > 0) return String(lastKnown);

  return '';
}

function CashInflowSection({ year, month, onTotalChange, onSaved, onInflowsChange }) {
  const { user, updateUser } = useAuth();
  const [inflows, setInflows] = useState([{ label: 'Salary', amount: '', kind: 'salary' }]);
  const [defaultSalary, setDefaultSalary] = useState('');
  const [loading, setLoading] = useState(false);
  const saveTimerRef = useRef(null);
  const skipSaveRef = useRef(false);
  const userEditedRef = useRef(false);

  const total = inflowTotal(inflows);

  useEffect(() => {
    onTotalChange?.(total);
    onInflowsChange?.(inflows);
  }, [total, inflows, onTotalChange, onInflowsChange]);

  const persistInflows = useCallback(
    async (nextInflows) => {
      try {
        const payload = nextInflows.map((row) => ({
          label: row.label,
          amount: row.amount === '' ? 0 : Number(row.amount) || 0,
          kind: row.kind,
        }));
        await api.put('/cashflow', { year, month, inflows: payload });
        onSaved?.();
      } catch (err) {
        console.error('Failed to save cash inflows', err);
      }
    },
    [year, month, onSaved]
  );

  const scheduleSave = useCallback(
    (nextInflows) => {
      if (!userEditedRef.current || skipSaveRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistInflows(nextInflows);
      }, 400);
    },
    [persistInflows]
  );

  const loadInflows = useCallback(async () => {
    setLoading(true);
    skipSaveRef.current = true;
    userEditedRef.current = false;
    try {
      let profileUser = user;
      if (!user?.defaultMonthlySalary && !user?.suggestedDefaultSalary) {
        try {
          const meRes = await api.get('/auth/me');
          if (meRes.data?.user) {
            profileUser = { ...user, ...meRes.data.user };
            updateUser?.(meRes.data.user);
          }
        } catch (_) {
          /* profile fetch optional */
        }
      }

      const res = await api.get('/cashflow', { params: { year, month } });
      const nextInflows = resolveLoadedInflows(res.data, profileUser);
      setInflows(nextInflows);
      setDefaultSalary(resolveDefaultSalaryDisplay(res.data, profileUser, nextInflows));
    } catch (err) {
      console.error('Failed to load cash inflows', err);
      const fallback =
        user?.defaultMonthlySalary || user?.suggestedDefaultSalary || user?.lastKnownSalary;
      setInflows([
        {
          label: 'Salary',
          amount: fallback ? String(fallback) : '',
          kind: 'salary',
        },
      ]);
      setDefaultSalary(fallback ? String(fallback) : '');
    } finally {
      setLoading(false);
      setTimeout(() => {
        skipSaveRef.current = false;
      }, 0);
    }
  }, [year, month, user, updateUser]);

  useEffect(() => {
    loadInflows();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [loadInflows]);

  const updateInflows = (updater) => {
    userEditedRef.current = true;
    setInflows((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!skipSaveRef.current) scheduleSave(next);
      return next;
    });
  };

  const handleAmountChange = (idx, value) => {
    updateInflows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, amount: value } : row))
    );
  };

  const handleLabelChange = (idx, value) => {
    updateInflows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, label: value } : row))
    );
  };

  const addCustomInflow = () => {
    updateInflows((prev) => [
      ...prev,
      { label: '', amount: '', kind: 'custom' },
    ]);
  };

  const removeInflow = (idx) => {
    updateInflows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDefaultSalaryBlur = async () => {
    const num = defaultSalary === '' ? 0 : Number(defaultSalary) || 0;
    if (num === (user?.defaultMonthlySalary || 0)) return;
    try {
      const res = await api.patch('/auth/me', { defaultMonthlySalary: num });
      updateUser?.(res.data.user);
    } catch (err) {
      console.error('Failed to save default salary', err);
    }
  };

  const applyDefaultSalary = () => {
    const num = defaultSalary === '' ? 0 : Number(defaultSalary) || 0;
    updateInflows((prev) =>
      prev.map((row) =>
        row.kind === 'salary' ? { ...row, amount: num ? String(num) : '' } : row
      )
    );
  };

  return (
    <div className="cash-inflow-section">
      <p className="muted small cash-inflow-hint">
        Cash inflow — add salary and other income (FD interest, refund, etc.); total inflow is used for remaining balance
      </p>

      <div className="default-salary-bar">
        <label className="default-salary-label">
          <span>Default monthly salary</span>
          <input
            type="number"
            className="cashflow-input default-salary-input"
            placeholder="Enter salary"
            min="0"
            step="1"
            value={defaultSalary}
            onChange={(e) => setDefaultSalary(e.target.value)}
            onBlur={handleDefaultSalaryBlur}
          />
        </label>
        <button type="button" className="ghost-btn small" onClick={applyDefaultSalary}>
          Apply to this month
        </button>
      </div>

      <div className="inflow-list">
        {loading && <p className="muted small">Loading inflows…</p>}
        {!loading &&
          inflows.map((row, idx) => (
            <div key={idx} className="inflow-row">
              {row.kind === 'salary' ? (
                <span className="inflow-label-fixed">Salary</span>
              ) : (
                <input
                  type="text"
                  className="inflow-label-input"
                  placeholder="e.g. FD interest, refund"
                  value={row.label}
                  onChange={(e) => handleLabelChange(idx, e.target.value)}
                />
              )}
              <input
                type="number"
                className="cashflow-input inflow-amount-input"
                placeholder="Enter amount"
                min="0"
                step="1"
                value={row.amount ?? ''}
                onChange={(e) => handleAmountChange(idx, e.target.value)}
              />
              {row.kind !== 'salary' && (
                <button
                  type="button"
                  className="ghost-btn small inflow-remove-btn"
                  onClick={() => removeInflow(idx)}
                  title="Remove inflow"
                >
                  ×
                </button>
              )}
            </div>
          ))}
      </div>

      <div className="inflow-actions">
        <button type="button" className="ghost-btn small" onClick={addCustomInflow}>
          + Add inflow
        </button>
        <div className="inflow-total">
          <span className="kpi-label">Total cash inflow</span>
          <span className="kpi-value">₹{total.toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
}

export default CashInflowSection;
export { inflowTotal };
