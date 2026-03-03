import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import TransactionForm from '../components/TransactionForm';
import MonthlyCharts from '../components/MonthlyCharts';
import YearlySummary from '../components/YearlySummary';
import YearlyCharts from '../components/YearlyCharts';

function DashboardPage() {
  const { user, logout } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [yearlySummary, setYearlySummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'yearly'
  const displayName =
    user?.name && user.name !== 'Demo User'
      ? user.name
      : user?.email;

  const yearOptions = Array.from({ length: 9 }).map((_, idx) => {
    const base = today.getFullYear() - 4;
    return base + idx;
  });

  const loadData = async (selectedMonth, selectedYear) => {
    setLoading(true);
    try {
      const [monthlyRes, yearlyRes, txRes] = await Promise.all([
        api.get('/reports/monthly', { params: { month: selectedMonth, year: selectedYear } }),
        api.get('/reports/yearly', { params: { year: selectedYear } }),
        api.get('/transactions', { params: { month: selectedMonth, year: selectedYear } }),
      ]);
      setMonthlySummary(monthlyRes.data);
      setYearlySummary(yearlyRes.data);
      setTransactions(txRes.data.transactions);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(month, year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const handleCreateTransaction = async (payload) => {
    const res = await api.post('/transactions', payload);
    await loadData(month, year);
    return res.data.transaction;
  };

  const handleDelete = async (id) => {
    await api.delete(`/transactions/${id}`);
    await loadData(month, year);
  };

  const startEdit = (tx) => {
    setEditingTx({
      ...tx,
      dateInput: new Date(tx.date).toISOString().slice(0, 10),
    });
  };

  const cancelEdit = () => {
    setEditingTx(null);
  };

  const saveEdit = async () => {
    if (!editingTx) return;
    const payload = {
      type: editingTx.type,
      amount: Number(editingTx.amount),
      category: editingTx.category,
      description: editingTx.description || '',
      date: editingTx.dateInput,
    };
    await api.put(`/transactions/${editingTx._id}`, payload);
    setEditingTx(null);
    await loadData(month, year);
  };

  const totalForMonth = (monthlySummary?.totalExpense || 0) + (monthlySummary?.totalInvestment || 0);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1 className="app-title">Expense Control</h1>
          <p className="app-subtitle">
            Hi {displayName}, track your spending and investments.
          </p>
        </div>
        <button type="button" className="ghost-btn" onClick={logout}>
          Logout
        </button>
      </header>

      <main className="content">
        <section className="filters">
          <div className="view-toggle">
            <button
              type="button"
              className={viewMode === 'monthly' ? 'primary-btn' : 'ghost-btn'}
              onClick={() => setViewMode('monthly')}
            >
              Month view
            </button>
            <button
              type="button"
              className={viewMode === 'yearly' ? 'primary-btn' : 'ghost-btn'}
              onClick={() => setViewMode('yearly')}
            >
              Year view
            </button>
          </div>

          {viewMode === 'monthly' && (
            <>
              <div className="filter-group">
                <label>
                  <span>Month</span>
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const m = idx + 1;
                      return (
                        <option key={m} value={m}>
                          {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'short' })}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  <span>Year (for month view)</span>
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="monthly-kpis">
                <div className="kpi">
                  <span className="kpi-label">Total for month</span>
                  <span className="kpi-value">₹{totalForMonth.toLocaleString()}</span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Investment</span>
                  <span className="kpi-value">
                    ₹{(monthlySummary?.totalInvestment || 0).toLocaleString()}
                  </span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Expenses</span>
                  <span className="kpi-value">
                    ₹{(monthlySummary?.totalExpense || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}

          {viewMode === 'yearly' && (
            <div className="filter-group">
              <label>
                <span>Year (for year view)</span>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>

        {viewMode === 'monthly' && (
          <section className="layout-grid">
            <div className="left-column">
              <TransactionForm onCreated={handleCreateTransaction} />
              <div className="card transactions-list">
                <div className="list-header">
                  <h2>Entries this month</h2>
                  {loading && <span className="pill">Loading…</span>}
                </div>
                {editingTx && (
                  <div className="edit-bar">
                    <div className="edit-fields">
                      <select
                        value={editingTx.type}
                        onChange={(e) => setEditingTx({ ...editingTx, type: e.target.value })}
                      >
                        <option value="expense">Expense</option>
                        <option value="investment">Investment</option>
                      </select>
                      <input
                        type="number"
                        value={editingTx.amount}
                        onChange={(e) => setEditingTx({ ...editingTx, amount: e.target.value })}
                        placeholder="Amount"
                      />
                      <input
                        type="text"
                        value={editingTx.category}
                        onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                        placeholder="Category"
                      />
                      <input
                        type="text"
                        value={editingTx.description || ''}
                        onChange={(e) =>
                          setEditingTx({ ...editingTx, description: e.target.value })
                        }
                        placeholder="Description"
                      />
                      <input
                        type="date"
                        value={editingTx.dateInput}
                        onChange={(e) => setEditingTx({ ...editingTx, dateInput: e.target.value })}
                      />
                    </div>
                    <div className="edit-actions">
                      <button type="button" className="ghost-btn" onClick={cancelEdit}>
                        Cancel
                      </button>
                      <button type="button" className="primary-btn" onClick={saveEdit}>
                        Save
                      </button>
                    </div>
                  </div>
                )}
                {transactions.length === 0 && (
                  <p className="muted small">No entries yet for this month.</p>
                )}
                <ul>
                  {transactions.map((tx) => (
                    <li key={tx._id} className="tx-row">
                      <div className="tx-main">
                        <span className={`tx-type tx-type-${tx.type}`}>
                          {tx.type === 'expense' ? 'Expense' : 'Investment'}
                        </span>
                        <span className="tx-category">{tx.category}</span>
                      </div>
                      <div className="tx-meta">
                        <span className="tx-amount">₹{tx.amount.toLocaleString()}</span>
                        <span className="tx-date">
                          {new Date(tx.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => startEdit(tx)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => handleDelete(tx._id)}
                        >
                          Delete
                        </button>
                      </div>
                      {tx.description && <p className="tx-desc">{tx.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="right-column">
              <MonthlyCharts monthSummary={monthlySummary} />
            </div>
          </section>
        )}

        {viewMode === 'yearly' && (
          <section className="layout-grid">
            <div className="left-column">
              <YearlySummary yearly={yearlySummary} />
            </div>
            <div className="right-column">
              <YearlyCharts yearly={yearlySummary} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default DashboardPage;

