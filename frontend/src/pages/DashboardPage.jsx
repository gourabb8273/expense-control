import { useEffect, useMemo, useState } from 'react';
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

function parseDescriptionBreakdown(description) {
  if (!description || typeof description !== 'string') return null;
  const parts = description.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const items = [];
  parts.forEach((part) => {
    const idx = part.lastIndexOf('-');
    if (idx === -1) return;
    const label = part.slice(0, idx).trim();
    const valueStr = part.slice(idx + 1).trim();
    const value = Number(valueStr);
    if (!label || Number.isNaN(value)) return;
    items.push({ label, value });
  });

  if (items.length === 0) return null;
  const total = items.reduce((sum, x) => sum + (x.value || 0), 0);
  if (total <= 0) return null;
  return { items, total };
}

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
  const [listFilter, setListFilter] = useState('all'); // 'all' | 'expense' | 'investment'
  const [searchQuery, setSearchQuery] = useState('');

  const CASHFLOW_STORAGE_KEY = 'expense_control_monthly_cashflow';
  const getCashflowKey = (y, m) => `${y}-${m}`;
  const loadStoredCashflow = (y, m) => {
    try {
      const raw = localStorage.getItem(CASHFLOW_STORAGE_KEY);
      if (!raw) return '';
      const obj = JSON.parse(raw);
      const val = obj[getCashflowKey(y, m)];
      return val !== undefined && val !== null && val !== '' ? String(val) : '';
    } catch {
      return '';
    }
  };
  const saveStoredCashflow = (y, m, value) => {
    try {
      const raw = localStorage.getItem(CASHFLOW_STORAGE_KEY) || '{}';
      const obj = JSON.parse(raw);
      const num = value === '' ? null : Number(value);
      if (num === null || isNaN(num)) delete obj[getCashflowKey(y, m)];
      else obj[getCashflowKey(y, m)] = num;
      localStorage.setItem(CASHFLOW_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Could not save cashflow', e);
    }
  };

  const [manualCashflow, setManualCashflow] = useState(() => loadStoredCashflow(year, month));

  useEffect(() => {
    setManualCashflow(loadStoredCashflow(year, month));
  }, [month, year]);

  const handleCashflowChange = (e) => {
    const v = e.target.value;
    setManualCashflow(v);
    saveStoredCashflow(year, month, v);
  };

  const getCashflowNum = (y, m) => {
    const v = loadStoredCashflow(y, m);
    return v === '' ? 0 : (Number(v) || 0);
  };

  const yearlyCashflowArray = (() => {
    const arr = [];
    for (let m = 1; m <= 12; m++) arr.push(getCashflowNum(year, m));
    return arr;
  })();

  const [descExpanded, setDescExpanded] = useState(() => ({}));

  const toggleDescExpanded = (id) => {
    setDescExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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
    // Ask for confirmation before deleting an entry
    // eslint-disable-next-line no-alert
    const ok = window.confirm('Delete this entry? This cannot be undone.');
    if (!ok) return;
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
        cashflow: getCashflowNum(year, month),
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
      await exportYearlyPdf({ year, yearlySummary, api, chartImages, yearlyCashflow: yearlyCashflowArray });
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

  const expenseAmount = monthlySummary?.totalExpense || 0;
  const investmentAmount = monthlySummary?.totalInvestment || 0;
  const totalForMonth = expenseAmount + investmentAmount; // Expense + Investment (calculated)
  const cashflowAmount = manualCashflow === '' ? 0 : (Number(manualCashflow) || 0);
  // Remaining in bank = cashflow − total. If cashflow not entered, show 0
  const remainingBalance = manualCashflow === '' ? 0 : (cashflowAmount - totalForMonth);

  const filteredTransactions = (() => {
    let list = transactions;
    if (listFilter !== 'all') {
      list = list.filter((tx) => tx.type === listFilter);
    }
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter(
        (tx) =>
          (tx.category && tx.category.toLowerCase().includes(q)) ||
          (tx.description && tx.description.toLowerCase().includes(q))
      );
    }
    return list;
  })();

  const parsedBreakdowns = useMemo(() => {
    const map = new Map();
    filteredTransactions.forEach((tx) => {
      const parsed = parseDescriptionBreakdown(tx.description || '');
      if (parsed) {
        map.set(tx._id, parsed);
      }
    });
    return map;
  }, [filteredTransactions]);

  const monthlyComparison = (() => {
    const prevMonthNum = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const cashflowCurrent = getCashflowNum(year, month);
    const cashflowPrev = getCashflowNum(prevYear, prevMonthNum);
    let cashflowSum = 0;
    let cashflowMonthsWithData = 0;
    for (let m = 1; m <= 12; m++) {
      const v = getCashflowNum(year, m);
      cashflowSum += v;
      if (v > 0) cashflowMonthsWithData += 1;
    }
    // Year avg = sum of cashflow ÷ count of months that have cashflow (so 1 month → that month's value)
    const cashflowAvg = cashflowMonthsWithData > 0 ? cashflowSum / cashflowMonthsWithData : 0;

    if (!yearlySummary || !Array.isArray(yearlySummary.monthly)) {
      return {
        prevInvestment: 0,
        prevExpense: 0,
        avgInvestment: 0,
        avgExpense: 0,
        currentInvestment: 0,
        currentExpense: 0,
        cashflowCurrent,
        cashflowPrev,
        cashflowAvg,
      };
    }
    const series = yearlySummary.monthly;
    const current = series.find((m) => m.month === month);
    const prev = series.find((m) => m.month === prevMonthNum) || { totalInvestment: 0, totalExpense: 0 };
    const monthsWithData = series.filter(
      (m) => (m.totalInvestment || 0) > 0 || (m.totalExpense || 0) > 0
    );
    if (monthsWithData.length === 0) {
      return {
        prevInvestment: prev.totalInvestment || 0,
        prevExpense: prev.totalExpense || 0,
        avgInvestment: 0,
        avgExpense: 0,
        currentInvestment: current?.totalInvestment || 0,
        currentExpense: current?.totalExpense || 0,
        cashflowCurrent,
        cashflowPrev,
        cashflowAvg,
      };
    }
    const sum = monthsWithData.reduce(
      (acc, m) => ({
        investment: acc.investment + (m.totalInvestment || 0),
        expense: acc.expense + (m.totalExpense || 0),
      }),
      { investment: 0, expense: 0 }
    );
    const avgInvestment = sum.investment / monthsWithData.length;
    const avgExpense = sum.expense / monthsWithData.length;
    return {
      prevInvestment: prev.totalInvestment || 0,
      prevExpense: prev.totalExpense || 0,
      avgInvestment,
      avgExpense,
      currentInvestment: current?.totalInvestment || 0,
      currentExpense: current?.totalExpense || 0,
      cashflowCurrent,
      cashflowPrev,
      cashflowAvg,
    };
  })();

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
              <div className="monthly-cashflow">
                <p className="muted small" style={{ marginBottom: '0.5rem' }}>
                  Month cashflow — you set cashflow; expense &amp; investment from entries; remaining = cashflow − total
                </p>
                <div className="monthly-kpis monthly-cashflow-grid">
                  <div className="kpi kpi-cashflow-input">
                    <span className="kpi-label">Cashflow (in bank)</span>
                    <input
                      type="number"
                      className="cashflow-input"
                      placeholder="Enter amount"
                      min="0"
                      step="1"
                      value={manualCashflow}
                      onChange={handleCashflowChange}
                    />
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Expense</span>
                    <span className="kpi-value">₹{expenseAmount.toLocaleString()}</span>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Investment</span>
                    <span className="kpi-value">₹{investmentAmount.toLocaleString()}</span>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Total</span>
                    <span className="kpi-value">₹{totalForMonth.toLocaleString()}</span>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Remaining</span>
                    <span className={`kpi-value ${remainingBalance >= 0 ? 'positive' : 'negative'}`}>
                      ₹{remainingBalance.toLocaleString()}
                    </span>
                  </div>
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
                <div className="list-filters">
                  <div className="list-filter-buttons">
                    <button
                      type="button"
                      className={listFilter === 'all' ? 'primary-btn small' : 'ghost-btn small'}
                      onClick={() => setListFilter('all')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={listFilter === 'investment' ? 'primary-btn small' : 'ghost-btn small'}
                      onClick={() => setListFilter('investment')}
                    >
                      Investment
                    </button>
                    <button
                      type="button"
                      className={listFilter === 'expense' ? 'primary-btn small' : 'ghost-btn small'}
                      onClick={() => setListFilter('expense')}
                    >
                      Expense
                    </button>
                  </div>
                  <input
                    type="search"
                    className="list-search"
                    placeholder="Search category or description"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
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
                {transactions.length > 0 && filteredTransactions.length === 0 && (
                  <p className="muted small">No entries match the filter or search.</p>
                )}
                <ul>
                  {filteredTransactions.map((tx) => (
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
                      {tx.description && (
                        <div className="tx-desc-wrap">
                          <p className="tx-desc">{tx.description}</p>
                          {parsedBreakdowns.has(tx._id) && (() => {
                            const parsed = parsedBreakdowns.get(tx._id);
                            if (!parsed) return null;
                            const sum = parsed.total;
                            const amount = Number(tx.amount || 0);
                            const diff = amount - sum;
                            const matches = Math.round(sum) === Math.round(amount);
                            const expanded = !!descExpanded[tx._id];
                            return (
                              <>
                                <button
                                  type="button"
                                  className="link-btn small"
                                  onClick={() => toggleDescExpanded(tx._id)}
                                >
                                  {expanded ? 'Hide breakdown' : 'Show breakdown'}
                                </button>
                                {expanded && (
                                  <div className="desc-breakdown">
                                    <ul className="desc-breakdown-list">
                                      {parsed.items.map((item) => (
                                        <li key={item.label} className="desc-breakdown-row">
                                          <span className="desc-breakdown-label">{item.label}</span>
                                          <span className="desc-breakdown-value">
                                            ₹{item.value.toLocaleString('en-IN')}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                    <p className="desc-breakdown-summary">
                                      Breakdown total: ₹{sum.toLocaleString('en-IN')}{' '}
                                      {matches ? (
                                        <span className="desc-breakdown-ok">(matches entry amount)</span>
                                      ) : (
                                        <span className="desc-breakdown-mismatch">
                                          (diff vs entry: ₹{diff.toLocaleString('en-IN')})
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="balance-sheet-month-wrap">
              <BalanceSheetSection year={year} month={month} />
            </div>
            <div className="charts-at-bottom">
              <MonthlyCharts
                monthSummary={monthlySummary}
                comparison={monthlyComparison}
                transactions={transactions}
              />
            </div>
          </section>
        )}

        {viewMode === 'yearly' && (
          <section className="dashboard-sections">
            <div className="content-block">
              {yearlySummary && Array.isArray(yearlySummary.monthly) && (
                <div className="card yearly-cashflow-card">
                  <h2>Year cashflow · {yearlySummary.year}</h2>
                  <div className="year-cashflow-kpis">
                    <div className="kpi">
                      <span className="kpi-label">Total investment</span>
                      <span className="kpi-value">
                        ₹{yearlySummary.monthly.reduce((s, m) => s + m.totalInvestment, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">Total expense</span>
                      <span className="kpi-value">
                        ₹{yearlySummary.monthly.reduce((s, m) => s + m.totalExpense, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">Remaining balance</span>
                      <span className={`kpi-value ${(yearlySummary.monthly.reduce((s, m) => s + m.totalInvestment, 0) - yearlySummary.monthly.reduce((s, m) => s + m.totalExpense, 0)) >= 0 ? 'positive' : 'negative'}`}>
                        ₹{(yearlySummary.monthly.reduce((s, m) => s + m.totalInvestment, 0) - yearlySummary.monthly.reduce((s, m) => s + m.totalExpense, 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="month-strip month-strip-net">
                    {yearlySummary.monthly.map((m) => {
                      const net = m.totalInvestment - m.totalExpense;
                      return (
                        <div key={m.month} className="month-pill">
                          <span className="month-name">
                            {new Date(2000, m.month - 1, 1).toLocaleString('default', { month: 'short' })}
                          </span>
                          <span className={`month-net ${net >= 0 ? 'positive' : 'negative'}`}>
                            ₹{net.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <YearlySummary yearly={yearlySummary} />
              <BalanceSheetYearSection year={year} />
            </div>
            <div className="charts-at-bottom">
              <YearlyCharts yearly={yearlySummary} yearlyCashflow={yearlyCashflowArray} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default DashboardPage;

