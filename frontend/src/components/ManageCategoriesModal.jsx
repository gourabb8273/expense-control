import { useState, useEffect } from 'react';
import { api } from '../services/api';

function ManageCategoriesModal({ isOpen, onClose, onSaved }) {
  const [tab, setTab] = useState('investment');
  const [investmentList, setInvestmentList] = useState([]);
  const [expenseList, setExpenseList] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/categories');
      const list = res.data.categories || [];
      setInvestmentList(list.filter((c) => c.type === 'investment'));
      setExpenseList(list.filter((c) => c.type === 'expense'));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load categories');
    }
  };

  useEffect(() => {
    if (isOpen) {
      load();
      setNewName('');
      setEditingId(null);
      setError('');
    }
  }, [isOpen]);

  const list = tab === 'investment' ? investmentList : expenseList;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/categories', { type: tab, name: newName.trim() });
      setNewName('');
      await load();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.put(`/categories/${id}`, { name: editName.trim() });
      setEditingId(null);
      await load();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setLoading(true);
    setError('');
    try {
      await api.delete(`/categories/${id}`);
      await load();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Category tags</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-tabs">
          <button
            type="button"
            className={tab === 'investment' ? 'primary-btn' : 'ghost-btn'}
            onClick={() => setTab('investment')}
          >
            Investment tags
          </button>
          <button
            type="button"
            className={tab === 'expense' ? 'primary-btn' : 'ghost-btn'}
            onClick={() => setTab('expense')}
          >
            Expense tags
          </button>
        </div>
        <p className="muted small">
          Add tags (e.g. RD, FD, ETF for investment; Loan, Rent for expense). Use the <strong>Tag</strong> field when adding or editing entries; tagged entries appear in “Investment by tag” and “Expense by tag” pie charts.
        </p>
        <form onSubmit={handleAdd} className="modal-add-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={tab === 'investment' ? 'e.g. RD, FD, ETF' : 'e.g. Loan, Rent, Groceries'}
            aria-label="New tag name"
          />
          <button type="submit" className="primary-btn" disabled={loading}>
            Add tag
          </button>
        </form>
        {error && <div className="error-banner">{error}</div>}
        <ul className="modal-list">
          {list.map((c) => (
            <li key={c._id} className="modal-list-item">
              {editingId === c._id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="modal-edit-input"
                    autoFocus
                  />
                  <button type="button" className="primary-btn small" onClick={() => handleUpdate(c._id)} disabled={loading}>
                    Save
                  </button>
                  <button type="button" className="ghost-btn small" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="modal-list-name">{c.name}</span>
                  <button type="button" className="link-btn" onClick={() => { setEditingId(c._id); setEditName(c.name); }}>
                    Edit
                  </button>
                  <button type="button" className="link-btn danger" onClick={() => handleDelete(c._id)} disabled={loading}>
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {list.length === 0 && (
          <p className="muted small">No {tab} tags yet. Type a name above and click “Add tag”.</p>
        )}
      </div>
    </div>
  );
}

export default ManageCategoriesModal;
