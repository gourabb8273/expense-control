import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import PrivacyAmountInput from './PrivacyAmountInput';

import { useFormatMoney } from '../utils/formatMoney';

const EMPTY_FORM = {
  name: '',
  type: 'expense',
  amount: '',
  category: '',
  tag: '',
  description: '',
  expenseEssential: '',
  dayOfMonth: 1,
  active: true,
};

function ManageRecurringModal({ isOpen, onClose, onSaved, staticCategories = [] }) {
  const toast = useToast();
  const { inr } = useFormatMoney();
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tagOptions = staticCategories.filter((c) => c.type === form.type);

  const load = async () => {
    const res = await api.get('/recurring');
    setRules(res.data.rules || []);
  };

  useEffect(() => {
    if (isOpen) {
      load().catch(() => setRules([]));
      setForm(EMPTY_FORM);
      setEditingId(null);
      setError('');
    }
  }, [isOpen]);

  const startEdit = (rule) => {
    setEditingId(rule._id);
    setForm({
      name: rule.name,
      type: rule.type,
      amount: String(rule.amount),
      category: rule.category,
      tag: rule.tag || '',
      description: rule.description || '',
      expenseEssential: rule.expenseEssential || '',
      dayOfMonth: rule.dayOfMonth || 1,
      active: rule.active !== false,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.amount) {
      setError('Name, amount, and category are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        amount: Number(form.amount),
        category: form.category.trim(),
        tag: form.tag || '',
        description: form.description || '',
        dayOfMonth: Number(form.dayOfMonth) || 1,
        active: form.active,
      };
      if (form.type === 'expense' && form.expenseEssential) {
        payload.expenseEssential = form.expenseEssential;
      }
      if (editingId) {
        await api.put(`/recurring/${editingId}`, payload);
        toast.success('Recurring rule updated');
      } else {
        await api.post('/recurring', payload);
        toast.success('Recurring rule created');
      }
      resetForm();
      await load();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this recurring rule? Existing entries stay; future apply will skip it.')) return;
    setLoading(true);
    try {
      await api.delete(`/recurring/${id}`);
      toast.success('Rule deleted');
      if (editingId === id) resetForm();
      await load();
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (rule) => {
    try {
      await api.put(`/recurring/${rule._id}`, { active: !rule.active });
      await load();
      onSaved?.();
      toast.info(rule.active ? 'Rule paused' : 'Rule activated');
    } catch (err) {
      toast.error('Could not update rule');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card recurring-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="recurring-modal-title">
        <div className="modal-header">
          <h2 id="recurring-modal-title">Manage recurring rules</h2>
          <button type="button" className="ghost-btn" onClick={onClose}>Close</button>
        </div>
        <p className="muted small">
          Same amount every month (EMI, SIP, etc.). Apply from the month view banner — you review before entries are created.
        </p>

        <form onSubmit={handleSubmit} className="recurring-form">
          <div className="recurring-form-grid">
            <label className="field">
              <span>Rule name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Home Loan EMI" />
            </label>
            <label className="field">
              <span>Type</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, expenseEssential: '' })}>
                <option value="expense">Expense</option>
                <option value="investment">Investment</option>
              </select>
            </label>
            <label className="field">
              <span>Amount</span>
              <PrivacyAmountInput min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </label>
            <label className="field">
              <span>Category</span>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Home Loan" />
            </label>
            <label className="field">
              <span>Day of month (1–28)</span>
              <input type="number" min="1" max="28" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} />
            </label>
            <label className="field">
              <span>Tag (optional)</span>
              <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
                <option value="">— None —</option>
                {tagOptions.map((c) => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
          {form.type === 'expense' && (
            <label className="field">
              <span>Essential?</span>
              <select value={form.expenseEssential} onChange={(e) => setForm({ ...form, expenseEssential: e.target.value })}>
                <option value="">— Not set —</option>
                <option value="essential">Essential</option>
                <option value="nonessential">Non-essential</option>
              </select>
            </label>
          )}
          <label className="field">
            <span>Description (optional)</span>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="field inline recurring-active-toggle">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Active (include when applying)</span>
          </label>
          {error && <div className="error-banner">{error}</div>}
          <div className="actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              {editingId ? 'Update rule' : 'Add rule'}
            </button>
            {editingId && (
              <button type="button" className="ghost-btn" onClick={resetForm}>Cancel edit</button>
            )}
          </div>
        </form>

        <h3 className="recurring-list-title">Your rules ({rules.length})</h3>
        {rules.length === 0 ? (
          <p className="muted small">No rules yet. Add one above or tick &quot;Save as recurring&quot; when adding an entry.</p>
        ) : (
          <ul className="recurring-rules-list">
            {rules.map((rule) => (
              <li key={rule._id} className={`recurring-rule-row ${rule.active ? '' : 'paused'}`}>
                <div className="recurring-rule-main">
                  <strong>{rule.name}</strong>
                  <span className="muted small">
                    {rule.type} · {inr(rule.amount)} · {rule.category} · day {rule.dayOfMonth}
                  </span>
                </div>
                <div className="recurring-rule-actions">
                  <button type="button" className="ghost-btn small" onClick={() => toggleActive(rule)}>
                    {rule.active ? 'Pause' : 'Activate'}
                  </button>
                  <button type="button" className="ghost-btn small" onClick={() => startEdit(rule)}>Edit</button>
                  <button type="button" className="link-btn danger small" onClick={() => handleDelete(rule._id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ManageRecurringModal;
