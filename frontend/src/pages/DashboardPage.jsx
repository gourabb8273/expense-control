import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import TransactionForm from '../components/TransactionForm';
import MonthlyCharts from '../components/MonthlyCharts';
import YearlyCharts, { YearlyTrendChart } from '../components/YearlyCharts';
import ManageCategoriesModal from '../components/ManageCategoriesModal';
import BalanceSheetSection from '../components/BalanceSheetSection';
import BalanceSheetYearSection from '../components/BalanceSheetYearSection';
import { exportMonthlyPdf, exportYearlyPdf } from '../utils/exportPdf';
import CashInflowSection from '../components/CashInflowSection';
import { MonthlyCashInflowCharts, YearlyCashInflowCharts } from '../components/CashInflowCharts';
import { MonthRemarkSection, YearRemarksSection } from '../components/RemarkSection';
import { AllocationBar, KpiWithPct } from '../components/MoneyFlowSummary';
import AlertsBanner, { buildMonthAlerts } from '../components/AlertsBanner';
import StickyMonthSummary from '../components/StickyMonthSummary';
import RecurringBanner from '../components/RecurringBanner';
import ManageRecurringModal from '../components/ManageRecurringModal';
import { KpiSkeletonGrid } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { ChartsExpandProvider, waitForChartRender } from '../context/ChartsExpandContext';
import ChartsExpandToggle from '../components/ChartsExpandToggle';

function netWorthFromSheet(data) {
  const a = (data?.assets || []).reduce((s, i) => s + (Number(i.value) || 0), 0);
  const d = (data?.debts || []).reduce((s, i) => s + (Number(i.value) || 0), 0);
  return a - d;
}

function pctOfInflow(part, inflow) {
  if (!inflow || inflow <= 0) return null;
  return Math.round((part / inflow) * 1000) / 10;
}

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
  const toast = useToast();
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
  const [balanceSheetRefreshKey, setBalanceSheetRefreshKey] = useState(0);
  const [entriesExpanded, setEntriesExpanded] = useState(true);
  const [tagsRefreshKey, setTagsRefreshKey] = useState(0);
  const [cashflowRefreshKey, setCashflowRefreshKey] = useState(0);
  const [recurringRefreshKey, setRecurringRefreshKey] = useState(0);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [balanceSheetMeta, setBalanceSheetMeta] = useState({
    saved: false,
    carried: false,
    savedAt: null,
    netWorth: 0,
  });
  const [prevMonthNetWorth, setPrevMonthNetWorth] = useState(null);
  const [pendingRecurringCount, setPendingRecurringCount] = useState(0);
  const [chartsExpandAll, setChartsExpandAll] = useState(false);
  const [expandAllGeneration, setExpandAllGeneration] = useState(0);
  const [lineChartFullWidth, setLineChartFullWidth] = useState(false);

  const handleSetExpandAll = useCallback((value) => {
    if (value) {
      setExpandAllGeneration((g) => g + 1);
    }
    setChartsExpandAll(value);
  }, []);

  const [monthInflowTotal, setMonthInflowTotal] = useState(0);
  const [monthInflows, setMonthInflows] = useState([]);
  const [yearlyCashflowArray, setYearlyCashflowArray] = useState(() => Array(12).fill(0));

  const loadYearlyCashflowArray = async (y) => {
    try {
      const res = await api.get('/cashflow/year', { params: { year: y } });
      const months = Array.isArray(res.data?.months) ? res.data.months : [];
      const filled = [...months, ...Array(12).fill(0)].slice(0, 12).map((v) => Number(v) || 0);
      setYearlyCashflowArray(filled);
    } catch (err) {
      console.error('Failed to load yearly cashflow', err);
      setYearlyCashflowArray(Array(12).fill(0));
    }
  };

  useEffect(() => {
    loadYearlyCashflowArray(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const handleInflowSaved = () => {
    loadYearlyCashflowArray(year);
    setCashflowRefreshKey((k) => k + 1);
  };

  const handleInflowTotalChange = (total) => {
    setMonthInflowTotal(total);
  };

  const getCashflowNum = (y, m) => {
    const idx = m - 1;
    if (y !== year || idx < 0 || idx >= yearlyCashflowArray.length) return 0;
    return Number(yearlyCashflowArray[idx] || 0);
  };

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

  useEffect(() => {
    setChartsExpandAll(false);
    setLineChartFullWidth(false);
  }, [viewMode, year, month]);

  useEffect(() => {
    if (viewMode !== 'monthly') return undefined;
    let cancelled = false;
    api
      .get('/recurring/pending', { params: { year, month } })
      .then((res) => {
        if (!cancelled) setPendingRecurringCount(res.data.pending?.length || 0);
      })
      .catch(() => {
        if (!cancelled) setPendingRecurringCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, viewMode, recurringRefreshKey]);

  useEffect(() => {
    if (viewMode !== 'monthly') return undefined;
    let cancelled = false;
    const prevMonthNum = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    api
      .get('/balance-sheet', { params: { year: prevYear, month: prevMonthNum } })
      .then((res) => {
        if (!cancelled) setPrevMonthNetWorth(netWorthFromSheet(res.data));
      })
      .catch(() => {
        if (!cancelled) setPrevMonthNetWorth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, viewMode, balanceSheetRefreshKey]);

  const handleCreateTransaction = async (payload, recurringMeta) => {
    const res = await api.post('/transactions', payload);
    if (recurringMeta) {
      await api.post('/recurring', {
        name: recurringMeta.name,
        type: payload.type,
        amount: payload.amount,
        category: payload.category,
        tag: payload.tag || '',
        description: payload.description || '',
        expenseEssential: payload.expenseEssential,
        dayOfMonth: recurringMeta.dayOfMonth,
      });
      toast.success('Entry saved and recurring rule created');
      setRecurringRefreshKey((k) => k + 1);
    } else {
      toast.success('Entry saved');
    }
    await loadData(month, year);
    return res.data.transaction;
  };

  const handleDelete = async (id) => {
    // Ask for confirmation before deleting an entry
    // eslint-disable-next-line no-alert
    const ok = window.confirm('Delete this entry? This cannot be undone.');
    if (!ok) return;
    await api.delete(`/transactions/${id}`);
    toast.success('Entry deleted');
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
    if (editingTx.type === 'expense') {
      payload.expenseEssential = editingTx.expenseEssential || '';
    }
    await api.put(`/transactions/${editingTx._id}`, payload);
    setEditingTx(null);
    toast.success('Entry updated');
    await loadData(month, year);
  };

  const collectChartImages = (...sectionSelectors) => {
    const images = [];
    const seen = new Set();
    sectionSelectors.forEach((sectionClass) => {
      const section = document.querySelector(sectionClass);
      if (!section) return;
      section.querySelectorAll('.chart-card[data-chart-title]').forEach((card) => {
        const canvas = card.querySelector('canvas');
        const title = card.getAttribute('data-chart-title');
        if (!canvas || !title || seen.has(title)) return;
        try {
          seen.add(title);
          images.push({
            title,
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
          });
        } catch (_) {}
      });
    });
    return images;
  };

  const handleExportMonthlyPdf = async () => {
    setExportingPdf(true);
    const prevExpand = chartsExpandAll;
    const prevLineWidth = lineChartFullWidth;
    try {
      setChartsExpandAll(true);
      setLineChartFullWidth(true);
      await waitForChartRender();
      const chartImages = collectChartImages('.cash-inflow-charts', '.monthly-charts');
      await exportMonthlyPdf({
        year,
        month,
        monthlySummary,
        transactions,
        api,
        chartImages,
        cashflow: getCashflowNum(year, month),
        inflows: monthInflows,
        netWorth: balanceSheetMeta.netWorth,
        netWorthChange,
      });
      toast.success('Monthly PDF exported');
    } catch (err) {
      console.error('Export PDF failed', err);
      toast.error('PDF export failed');
    } finally {
      setChartsExpandAll(prevExpand);
      setLineChartFullWidth(prevLineWidth);
      setExportingPdf(false);
    }
  };

  const handleExportYearlyPdf = async () => {
    setExportingPdf(true);
    const prevExpand = chartsExpandAll;
    const prevLineWidth = lineChartFullWidth;
    try {
      setChartsExpandAll(true);
      setLineChartFullWidth(true);
      await waitForChartRender();
      const chartImages = collectChartImages(
        '.yearly-cash-inflow-charts',
        '.yearly-charts',
        '.balance-sheet-year-card'
      );
      await exportYearlyPdf({ year, yearlySummary, api, chartImages, yearlyCashflow: yearlyCashflowArray });
      toast.success('Yearly PDF exported');
    } catch (err) {
      console.error('Export PDF failed', err);
      toast.error('PDF export failed');
    } finally {
      setChartsExpandAll(prevExpand);
      setLineChartFullWidth(prevLineWidth);
      setExportingPdf(false);
    }
  };

  const handleTagChange = async (tx, newTag) => {
    const dateStr = new Date(tx.date).toISOString().slice(0, 10);
    try {
      const body = {
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        tag: newTag || undefined,
        description: tx.description || '',
        date: dateStr,
      };
      if (tx.type === 'expense') {
        body.expenseEssential = tx.expenseEssential || '';
      }
      await api.put(`/transactions/${tx._id}`, body);
      await loadData(month, year);
    } catch (err) {
      console.error('Failed to update tag', err);
    }
  };

  const expenseAmount = monthlySummary?.totalExpense || 0;
  const investmentAmount = monthlySummary?.totalInvestment || 0;
  const totalForMonth = expenseAmount + investmentAmount; // Expense + Investment (calculated)
  const cashflowAmount = monthInflowTotal;
  const remainingBalance = cashflowAmount - totalForMonth;

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

  const lastEntryAt = useMemo(() => {
    if (!transactions.length) return null;
    const times = transactions.map((tx) => new Date(tx.updatedAt || tx.date).getTime());
    return new Date(Math.max(...times));
  }, [transactions]);

  const untaggedExpenseAmount = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'expense' && !(tx.tag || '').trim())
        .reduce((s, tx) => s + (Number(tx.amount) || 0), 0),
    [transactions]
  );

  const netWorthChange =
    prevMonthNetWorth != null ? balanceSheetMeta.netWorth - prevMonthNetWorth : null;

  const monthAlerts = useMemo(
    () =>
      buildMonthAlerts({
        inflow: cashflowAmount,
        expense: expenseAmount,
        investment: investmentAmount,
        remaining: remainingBalance,
        balanceSheetSaved: balanceSheetMeta.saved,
        balanceSheetCarried: balanceSheetMeta.carried,
        pendingRecurringCount,
        untaggedExpenseAmount,
        netWorthDown: netWorthChange != null && netWorthChange < 0,
      }),
    [
      cashflowAmount,
      expenseAmount,
      investmentAmount,
      remainingBalance,
      balanceSheetMeta,
      pendingRecurringCount,
      untaggedExpenseAmount,
      netWorthChange,
    ]
  );

  return (
    <ChartsExpandProvider
      expandAll={chartsExpandAll}
      setExpandAll={handleSetExpandAll}
      expandAllGeneration={expandAllGeneration}
      lineChartFullWidth={lineChartFullWidth}
      setLineChartFullWidth={setLineChartFullWidth}
    >
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
          <button type="button" className="ghost-btn" onClick={() => setRecurringModalOpen(true)}>
            Manage recurring
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
        onSaved={() => {
          loadData(month, year);
          setTagsRefreshKey((k) => k + 1);
        }}
      />
      <ManageRecurringModal
        isOpen={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        staticCategories={staticCategories}
        onSaved={() => setRecurringRefreshKey((k) => k + 1)}
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
              <StickyMonthSummary
                year={year}
                month={month}
                inflow={cashflowAmount}
                expense={expenseAmount}
                investment={investmentAmount}
                remaining={remainingBalance}
                netWorth={balanceSheetMeta.netWorth}
                netWorthChange={netWorthChange}
                loading={loading}
              />
              <div className="monthly-cashflow">
                <CashInflowSection
                  year={year}
                  month={month}
                  onTotalChange={handleInflowTotalChange}
                  onSaved={handleInflowSaved}
                  onInflowsChange={setMonthInflows}
                />
                <div className="monthly-kpis monthly-cashflow-grid monthly-cashflow-summary">
                  {loading ? (
                    <KpiSkeletonGrid count={6} />
                  ) : (
                    <>
                  <KpiWithPct
                    label="Inflow"
                    amount={cashflowAmount}
                    className="inflow"
                  />
                  <KpiWithPct
                    label="Expense"
                    amount={expenseAmount}
                    pctOfInflow={pctOfInflow(expenseAmount, cashflowAmount)}
                    className="expense"
                  />
                  <KpiWithPct
                    label="Investment"
                    amount={investmentAmount}
                    pctOfInflow={pctOfInflow(investmentAmount, cashflowAmount)}
                    className="invest"
                  />
                  <KpiWithPct
                    label="Remaining"
                    amount={remainingBalance}
                    pctOfInflow={remainingBalance >= 0 ? pctOfInflow(remainingBalance, cashflowAmount) : null}
                    className={remainingBalance >= 0 ? 'positive' : 'negative'}
                  />
                  <div className="kpi kpi-with-pct kpi-networth">
                    <span className="kpi-label">Net worth</span>
                    <span className={`kpi-value networth ${balanceSheetMeta.netWorth >= 0 ? '' : 'negative'}`}>
                      ₹{balanceSheetMeta.netWorth.toLocaleString('en-IN')}
                    </span>
                    {netWorthChange != null && (
                      <span className={`kpi-pct ${netWorthChange >= 0 ? 'positive' : 'negative'}`}>
                        {netWorthChange >= 0 ? '+' : '-'}₹{Math.abs(netWorthChange).toLocaleString('en-IN')} vs last month
                      </span>
                    )}
                  </div>
                  <div className="kpi kpi-with-pct outflow">
                    <span className="kpi-label">Total outflow</span>
                    <span className="kpi-value outflow">₹{totalForMonth.toLocaleString('en-IN')}</span>
                    {cashflowAmount > 0 && (
                      <span className="kpi-pct muted small">
                        {pctOfInflow(totalForMonth, cashflowAmount)}% of inflow
                      </span>
                    )}
                  </div>
                    </>
                  )}
                  {!loading && (
                    <AllocationBar
                      inflow={cashflowAmount}
                      investment={investmentAmount}
                      expense={expenseAmount}
                    />
                  )}
                </div>
              </div>
              <AlertsBanner alerts={monthAlerts} />
              <RecurringBanner
                year={year}
                month={month}
                refreshKey={recurringRefreshKey}
                onApplied={() => {
                  loadData(month, year);
                  setRecurringRefreshKey((k) => k + 1);
                }}
              />
              <MonthRemarkSection key={`${year}-${month}`} year={year} month={month} />
            </>
          )}

          {viewMode === 'yearly' && (
            <>
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
            <YearRemarksSection key={year} year={year} />
            </>
          )}
        </section>

        {viewMode === 'monthly' && (
          <section className="dashboard-sections">
            <div className="content-block">
              <TransactionForm onCreated={handleCreateTransaction} staticCategories={staticCategories} />
              <div className={`card transactions-list${entriesExpanded ? ' entries-expanded' : ''}`}>
                <div className="list-header">
                  <button
                    type="button"
                    className="list-header-toggle"
                    onClick={() => setEntriesExpanded((v) => !v)}
                    aria-expanded={entriesExpanded}
                  >
                    <span className="list-header-chevron" aria-hidden="true">
                      {entriesExpanded ? '▾' : '▸'}
                    </span>
                    <h2>Entries this month</h2>
                    {!entriesExpanded && transactions.length > 0 && (
                      <span className="pill list-header-count">{transactions.length}</span>
                    )}
                  </button>
                  {loading ? (
                    <span className="pill pill-loading">Loading…</span>
                  ) : lastEntryAt ? (
                    <span className="pill pill-meta" title="Most recent entry this month">
                      Last entry · {lastEntryAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  ) : null}
                </div>
                {entriesExpanded && (
                  <>
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
                      {editingTx.type === 'expense' && (
                        <select
                          value={editingTx.expenseEssential || ''}
                          onChange={(e) =>
                            setEditingTx({ ...editingTx, expenseEssential: e.target.value })
                          }
                          title="Essential vs non-essential"
                        >
                          <option value="">Essential? — not set</option>
                          <option value="essential">Essential</option>
                          <option value="nonessential">Non-essential</option>
                        </select>
                      )}
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
                        {tx.type === 'expense' && tx.expenseEssential === 'essential' && (
                          <span className="tx-essential-pill">Essential</span>
                        )}
                        {tx.type === 'expense' && tx.expenseEssential === 'nonessential' && (
                          <span className="tx-essential-pill nonessential">Non-essential</span>
                        )}
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
                  </>
                )}
              </div>
            </div>
            <div className="balance-sheet-month-wrap">
              <BalanceSheetSection
                year={year}
                month={month}
                tagsRefreshKey={tagsRefreshKey}
                onMetaChange={setBalanceSheetMeta}
                onSaved={() => {
                  setBalanceSheetRefreshKey((k) => k + 1);
                  toast.success('Balance sheet saved');
                }}
              />
            </div>
            <ChartsExpandToggle />
            <MonthlyCashInflowCharts inflows={monthInflows} year={year} month={month} />
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
                  {(() => {
                    const yearlyInvestment = yearlySummary.monthly.reduce(
                      (s, m) => s + m.totalInvestment,
                      0
                    );
                    const yearlyExpense = yearlySummary.monthly.reduce(
                      (s, m) => s + m.totalExpense,
                      0
                    );
                    const yearlyCashflow = yearlyCashflowArray.reduce(
                      (s, v) => s + (Number(v) || 0),
                      0
                    );
                    const remaining =
                      yearlyCashflow > 0
                        ? yearlyCashflow - (yearlyInvestment + yearlyExpense)
                        : yearlyInvestment - yearlyExpense;
                    const remainingClass = remaining >= 0 ? 'positive' : 'negative';
                    return (
                      <>
                        <div className="year-cashflow-kpis">
                          <div className="kpi">
                            <span className="kpi-label">Total cash inflow (sum of months)</span>
                            <span className="kpi-value">
                              ₹{yearlyCashflow.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="kpi">
                            <span className="kpi-label">Total investment (year)</span>
                            <span className="kpi-value invest">
                              ₹{yearlyInvestment.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="kpi">
                            <span className="kpi-label">Total expense (year)</span>
                            <span className="kpi-value expense">
                              ₹{yearlyExpense.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="kpi">
                            <span className="kpi-label">
                              Remaining balance (cashflow − invest − expense)
                            </span>
                            <span className={`kpi-value ${remainingClass}`}>
                              ₹{remaining.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                        <AllocationBar
                          inflow={yearlyCashflow}
                          investment={yearlyInvestment}
                          expense={yearlyExpense}
                        />
                        <div className="month-strip month-strip-net">
                          {yearlySummary.monthly.map((m, idx) => {
                            const inv = m.totalInvestment || 0;
                            const exp = m.totalExpense || 0;
                            const diff = inv - exp;
                            const diffAbs = Math.abs(diff);
                            const cashflowForMonth = yearlyCashflowArray[idx] || 0;
                            const monthRemaining =
                              cashflowForMonth > 0
                                ? cashflowForMonth - inv - exp
                                : null;
                            let summaryText;
                            let summaryClass = 'month-ie-neutral';
                            if (diff > 0) {
                              summaryText = `Invest ahead by ₹${diffAbs.toLocaleString('en-IN')}`;
                              summaryClass = 'month-ie-positive';
                            } else if (diff < 0) {
                              summaryText = `Expenses ahead by ₹${diffAbs.toLocaleString('en-IN')}`;
                              summaryClass = 'month-ie-negative';
                            } else {
                              summaryText = 'Invest & expense matched';
                              summaryClass = 'month-ie-neutral';
                            }
                            return (
                              <div key={m.month} className="month-pill month-pill-ie">
                                <span className="month-name">
                                  {new Date(2000, m.month - 1, 1).toLocaleString('default', {
                                    month: 'short',
                                  })}
                                </span>
                                <span className="month-values">
                                  CF: ₹{cashflowForMonth.toLocaleString('en-IN')}
                                </span>
                                <span className="month-ie-line">
                                  <span className="month-ie-inv">Inv ₹{inv.toLocaleString('en-IN')}</span>
                                  <span className="month-ie-sep"> · </span>
                                  <span className="month-ie-exp">Exp ₹{exp.toLocaleString('en-IN')}</span>
                                </span>
                                <span className={`month-ie-summary ${summaryClass}`} title="Investment minus expense for this month (cashflow is separate above).">
                                  {summaryText}
                                </span>
                                {monthRemaining != null && (
                                  <span
                                    className={`month-after-cf ${monthRemaining >= 0 ? 'positive' : 'negative'}`}
                                    title="Cashflow you entered this month, minus investment and expense."
                                  >
                                    After CF: ₹{monthRemaining.toLocaleString('en-IN')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              <ChartsExpandToggle />
              <YearlyTrendChart yearly={yearlySummary} />
              <BalanceSheetYearSection year={year} refreshKey={balanceSheetRefreshKey} />
            </div>
            <div className="charts-at-bottom">
              <YearlyCashInflowCharts key={year} year={year} refreshKey={cashflowRefreshKey} />
              <YearlyCharts key={year} yearly={yearlySummary} yearlyCashflow={yearlyCashflowArray} />
            </div>
          </section>
        )}
      </main>
    </div>
    </ChartsExpandProvider>
  );
}

export default DashboardPage;

