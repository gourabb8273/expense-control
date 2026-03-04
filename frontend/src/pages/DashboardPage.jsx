import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import TransactionForm from '../components/TransactionForm';
import MonthlyCharts from '../components/MonthlyCharts';
import YearlySummary from '../components/YearlySummary';
import YearlyCharts from '../components/YearlyCharts';
import ManageCategoriesModal from '../components/ManageCategoriesModal';
import BalanceSheetSection from '../components/BalanceSheetSection';
import BalanceSheetYearSection from '../components/BalanceSheetYearSection';
import { exportMonthlyPdf, exportYearlyPdf } from '../utils/exportPdf';

function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [yearlySummary, setYearlySummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'yearly'
  const [staticCategories, setStaticCategories] = useState([]);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
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
      const [monthlyRes, yearlyRes, txRes, catRes] = await Promise.all([
        api.get('/reports/monthly', { params: { month: selectedMonth, year: selectedYear } }),
        api.get('/reports/yearly', { params: { year: selectedYear } }),
        api.get('/transactions', { params: { month: selectedMonth, year: selectedYear } }),
        api.get('/categories').catch(() => ({ data: { categories: [] } })),
      ]);
      setMonthlySummary(monthlyRes.data);
      setYearlySummary(yearlyRes.data);
      setTransactions(txRes.data.transactions);
      setStaticCategories(catRes.data?.categories || []);
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
      tag: editingTx.tag || undefined,
      description: editingTx.description || '',
      date: editingTx.dateInput,
    };
    await api.put(`/transactions/${editingTx._id}`, payload);
    setEditingTx(null);
    await loadData(month, year);
  };

  const captureChartImages = (sectionClass) => {
    const section = document.querySelector(sectionClass);
    if (!section) return [];
    const cards = section.querySelectorAll('.chart-card[data-chart-title]');
    const images = [];
    cards.forEach((card) => {
      const canvas = card.querySelector('canvas');
      const title = card.getAttribute('data-chart-title');
      if (canvas && title) {
        try {
          images.push({
            title,
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
          });
        } catch (_) {}
      }
    });
    return images;
  };

  const handleExportMonthlyPdf = async () => {
    setExportingPdf(true);
    try {
      const chartImages = captureChartImages('.monthly-charts');
      await exportMonthlyPdf({
        year,
        month,
        monthlySummary,
        transactions,
        api,
        chartImages,
      });
    } catch (err) {
      console.error('Export PDF failed', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportYearlyPdf = async () => {
    setExportingPdf(true);
    try {
      const chartImages = captureChartImages('.yearly-charts');
      await exportYearlyPdf({ year, yearlySummary, api, chartImages });
    } catch (err) {
      console.error('Export PDF failed', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleTagChange = async (tx, newTag) => {
    const dateStr = new Date(tx.date).toISOString().slice(0, 10);
    try {
      await api.put(`/transactions/${tx._id}`, {
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        tag: newTag || undefined,
        description: tx.description || '',
        date: dateStr,
      });
      await loadData(month, year);
    } catch (err) {
      console.error('Failed to update tag', err);
    }
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
        <div className="top-bar-actions">
          <button
            type="button"
            className="ghost-btn theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button type="button" className="ghost-btn" onClick={() => setCategoriesModalOpen(true)}>
            Manage categories
          </button>
          <button type="button" className="ghost-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <ManageCategoriesModal
        isOpen={categoriesModalOpen}
        onClose={() => setCategoriesModalOpen(false)}
        onSaved={() => loadData(month, year)}
      />

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
          <div className="export-pdf-row">
            {viewMode === 'monthly' && (
              <button
                type="button"
                className="ghost-btn"
                onClick={handleExportMonthlyPdf}
                disabled={exportingPdf}
              >
                {exportingPdf ? 'Exporting…' : 'Export monthly PDF'}
              </button>
            )}
            {viewMode === 'yearly' && (
              <button
                type="button"
                className="ghost-btn"
                onClick={handleExportYearlyPdf}
                disabled={exportingPdf}
              >
                {exportingPdf ? 'Exporting…' : 'Export yearly PDF'}
              </button>
            )}
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
          <section className="dashboard-sections">
            <div className="content-block">
              <TransactionForm onCreated={handleCreateTransaction} staticCategories={staticCategories} />
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
                        list={`edit-category-${editingTx.type}`}
                        value={editingTx.category}
                        onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                        placeholder="Category"
                      />
                      {staticCategories.filter((c) => c.type === editingTx.type).length > 0 && (
                        <datalist id={`edit-category-${editingTx.type}`}>
                          {staticCategories
                            .filter((c) => c.type === editingTx.type)
                            .map((c) => (
                              <option key={c._id} value={c.name} />
                            ))}
                        </datalist>
                      )}
                      <select
                        value={editingTx.tag || ''}
                        onChange={(e) => setEditingTx({ ...editingTx, tag: e.target.value })}
                        title="Tag"
                      >
                        <option value="">Tag (optional)</option>
                        {staticCategories
                          .filter((c) => c.type === editingTx.type)
                          .map((c) => (
                            <option key={c._id} value={c.name}>{c.name}</option>
                          ))}
                      </select>
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
                        {tx.tag && <span className="tx-tag">#{tx.tag}</span>}
                      </div>
                      <div className="tx-meta">
                        <span className="tx-amount">₹{tx.amount.toLocaleString()}</span>
                        <span className="tx-date">
                          {new Date(tx.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                        <select
                          className="tx-tag-select"
                          value={tx.tag || ''}
                          onChange={(e) => handleTagChange(tx, e.target.value)}
                          title="Add or change tag"
                        >
                          <option value="">Add tag</option>
                          {staticCategories
                            .filter((c) => c.type === tx.type)
                            .map((c) => (
                              <option key={c._id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
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
            <div className="balance-sheet-month-wrap">
              <BalanceSheetSection year={year} month={month} />
            </div>
            <div className="charts-at-bottom">
              <MonthlyCharts monthSummary={monthlySummary} />
            </div>
          </section>
        )}

        {viewMode === 'yearly' && (
          <section className="dashboard-sections">
            <div className="content-block">
              <YearlySummary yearly={yearlySummary} />
              <BalanceSheetYearSection year={year} />
            </div>
            <div className="charts-at-bottom">
              <YearlyCharts yearly={yearlySummary} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default DashboardPage;

