import { useState, useEffect } from 'react';
import { api } from '../services/api';

const TAB_CONFIG = [
  { id: 'investment', label: 'Investment tags' },
  { id: 'expense', label: 'Expense tags' },
  { id: 'asset', label: 'Asset tags' },
  { id: 'debt', label: 'Debt tags' },
];

const PLACEHOLDERS = {
  investment: 'e.g. RD, FD, ETF',
  expense: 'e.g. Loan, Rent, Groceries',
  asset: 'e.g. Gold, Stock, Mutual Fund',
  debt: 'e.g. Home loan, Credit card',
};

const HINTS = {
  investment: 'Use when adding investment entries; shows in investment tag charts.',
  expense: 'Use when adding expense entries; shows in expense tag charts.',
  asset: 'Use on balance sheet asset lines',
  debt: 'Use on balance sheet debt lines to group liabilities by tag.',
};

function ManageCategoriesModal({ isOpen, onClose, onSaved }) {
  const [tab, setTab] = useState('investment');
  const [lists, setLists] = useState({ investment: [], expense: [], asset: [], debt: [] });
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/categories');
      const list = res.data.categories || [];
      setLists({
        investment: list.filter((c) => c.type === 'investment'),
        expense: list.filter((c) => c.type === 'expense'),
        asset: list.filter((c) => c.type === 'asset'),
        debt: list.filter((c) => c.type === 'debt'),
      });
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

  const list = lists[tab] || [];

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
        <div className="modal-tabs modal-tabs-scroll">
          {TAB_CONFIG.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'primary-btn small' : 'ghost-btn small'}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted small">{HINTS[tab]}</p>
        <form onSubmit={handleAdd} className="modal-add-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={PLACEHOLDERS[tab]}
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
