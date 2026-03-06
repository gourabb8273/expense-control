import { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { api } from '../services/api';

ChartJS.register(ArcElement, Tooltip, Legend);

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6'];

function BalanceSheetSection({ year, month, onSaved }) {
  const [assets, setAssets] = useState([]);
  const [debts, setDebts] = useState([]);
  const [carriedFrom, setCarriedFrom] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!year || !month) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/balance-sheet', { params: { year, month } });
      setAssets(res.data.assets || []);
      setDebts(res.data.debts || []);
      setCarriedFrom(res.data.carriedFrom || null);
      setSaved(res.data.saved || false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [year, month]);

  const totalAssets = assets.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const totalDebts = debts.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const netWorth = totalAssets - totalDebts;

  const assetsWithValue = assets.filter((a) => (a.name || '').trim() && (Number(a.value) || 0) > 0);
  const debtsWithValue = debts.filter((d) => (d.name || '').trim() && (Number(d.value) || 0) > 0);
  const assetsPieData = {
    labels: assetsWithValue.map((a) => a.name || '—'),
    datasets: [{
      data: assetsWithValue.map((a) => Number(a.value) || 0),
      backgroundColor: PIE_COLORS,
      borderWidth: 0,
    }],
  };
  const debtsPieData = {
    labels: debtsWithValue.map((d) => d.name || '—'),
    datasets: [{
      data: debtsWithValue.map((d) => Number(d.value) || 0),
      backgroundColor: PIE_COLORS.slice().reverse(),
      borderWidth: 0,
    }],
  };
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      datalabels: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw || 0;
            const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
            const pct = total ? Math.round((v / total) * 100) : 0;
            return `₹${Number(v).toLocaleString('en-IN')} (${pct}%)`;
          },
        },
      },
    },
  };

  const addAsset = () => setAssets([...assets, { name: '', value: 0 }]);
  const addDebt = () => setDebts([...debts, { name: '', value: 0 }]);

  const updateAsset = (index, field, val) => {
    const next = [...assets];
    next[index] = { ...next[index], [field]: field === 'value' ? Number(val) || 0 : val };
    setAssets(next);
  };
  const updateDebt = (index, field, val) => {
    const next = [...debts];
    next[index] = { ...next[index], [field]: field === 'value' ? Number(val) || 0 : val };
    setDebts(next);
  };

  const removeAsset = (index) => setAssets(assets.filter((_, i) => i !== index));
  const removeDebt = (index) => setDebts(debts.filter((_, i) => i !== index));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put('/balance-sheet', {
        year,
        month,
        assets: assets.filter((a) => (a.name || '').trim()),
        debts: debts.filter((d) => (d.name || '').trim()),
      });
      setSaved(true);
      setCarriedFrom(null);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = MONTH_NAMES[month] || month;

  return (
    <div className="card balance-sheet-card">
      <div className="balance-sheet-header">
        <h2>Balance sheet · {monthLabel} {year}</h2>
        {carriedFrom && (
          <span className="pill carried-pill">
            Carried from {MONTH_NAMES[carriedFrom.month]} {carriedFrom.year}
          </span>
        )}
        {saved && !carriedFrom && <span className="pill saved-pill">Saved</span>}
      </div>
      <p className="muted small">
        Add your assets (gold, cash, property, etc.) and debts (loans, credit card). Save to update this month. Next month will start from this if you don’t edit.
      </p>

      {loading && <p className="muted small">Loading…</p>}
      {error && <div className="error-banner">{error}</div>}

      {!loading && (
        <>
          <div className="balance-sheet-grid">
            <div className="balance-sheet-column">
              <h3>Assets</h3>
              {assets.map((item, i) => (
                <div key={`a-${i}`} className="balance-sheet-row">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateAsset(i, 'name', e.target.value)}
                    placeholder="e.g. Gold, Cash, Property"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.value || ''}
                    onChange={(e) => updateAsset(i, 'value', e.target.value)}
                    placeholder="Value"
                  />
                  <button
                    type="button"
                    className="link-btn danger small"
                    onClick={() => removeAsset(i)}
                    title="Remove asset"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="ghost-btn small" onClick={addAsset}>+ Add asset</button>
              <div className="balance-sheet-total">
                <span>Total assets</span>
                <strong>₹{totalAssets.toLocaleString()}</strong>
              </div>
            </div>
            <div className="balance-sheet-column">
              <h3>Debts / Liabilities</h3>
              {debts.map((item, i) => (
                <div key={`d-${i}`} className="balance-sheet-row">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateDebt(i, 'name', e.target.value)}
                    placeholder="e.g. Loan, Credit card"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.value || ''}
                    onChange={(e) => updateDebt(i, 'value', e.target.value)}
                    placeholder="Value"
                  />
                  <button
                    type="button"
                    className="link-btn danger small"
                    onClick={() => removeDebt(i)}
                    title="Remove debt"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="ghost-btn small" onClick={addDebt}>+ Add debt</button>
              <div className="balance-sheet-total">
                <span>Total debts</span>
                <strong>₹{totalDebts.toLocaleString()}</strong>
              </div>
            </div>
          </div>
          <div className="balance-sheet-net">
            <span>Net worth</span>
            <strong className={netWorth >= 0 ? 'positive' : 'negative'}>
              ₹{netWorth.toLocaleString()}
            </strong>
          </div>

          {(assetsWithValue.length > 0 || debtsWithValue.length > 0) && (
            <div className="balance-sheet-charts">
              {assetsWithValue.length > 0 && (
                <div className="balance-sheet-chart-card">
                  <h3>Assets by category</h3>
                  <div className="balance-sheet-chart-wrap">
                    <Pie data={assetsPieData} options={pieOptions} />
                  </div>
                  <p className="chart-total">Total: ₹{totalAssets.toLocaleString('en-IN')}</p>
                </div>
              )}
              {debtsWithValue.length > 0 && (
                <div className="balance-sheet-chart-card">
                  <h3>Debts by category</h3>
                  <div className="balance-sheet-chart-wrap">
                    <Pie data={debtsPieData} options={pieOptions} />
                  </div>
                  <p className="chart-total">Total: ₹{totalDebts.toLocaleString('en-IN')}</p>
                </div>
              )}
            </div>
          )}

          <div className="balance-sheet-actions">
            <button type="button" className="primary-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save balance sheet'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default BalanceSheetSection;
