import { useState, useEffect, useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { api } from '../services/api';
import { aggregateByTag } from '../utils/aggregateByTag';

ChartJS.register(ArcElement, Tooltip, Legend);

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6'];

function cloneItems(list) {
  return (list || []).map((i) => ({
    name: i.name ?? '',
    value: Number(i.value) || 0,
    tag: i.tag ?? '',
  }));
}

function TagSelect({ value, options, onChange, placeholder }) {
  return (
    <select
      className="balance-sheet-tag-select"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      title="Tag"
    >
      <option value="">{placeholder}</option>
      {options.map((t) => (
        <option key={t._id} value={t.name}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

function ChartBreakdownList({ items, labelKey, total }) {
  if (!items?.length || !total) return null;
  return (
    <div className="chart-list-wrapper">
      <ul className="chart-list">
        {items.map((item) => {
          const value = Number(item.value) || 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
          return (
            <li key={item[labelKey]} className="chart-list-row">
              <span className="chart-list-label">{item[labelKey]}</span>
              <span className="chart-list-value">
                ₹{value.toLocaleString('en-IN')} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BalanceSheetSection({ year, month, onSaved, tagsRefreshKey = 0 }) {
  const [assets, setAssets] = useState([]);
  const [debts, setDebts] = useState([]);
  const [assetTags, setAssetTags] = useState([]);
  const [debtTags, setDebtTags] = useState([]);
  const [carriedFrom, setCarriedFrom] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/categories')
      .then((res) => {
        if (cancelled) return;
        const list = res.data.categories || [];
        setAssetTags(list.filter((c) => c.type === 'asset'));
        setDebtTags(list.filter((c) => c.type === 'debt'));
      })
      .catch(() => {
        if (!cancelled) {
          setAssetTags([]);
          setDebtTags([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tagsRefreshKey]);

  useEffect(() => {
    if (!year || !month) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await api.get('/balance-sheet', { params: { year, month } });
        if (cancelled) return;
        setAssets(cloneItems(res.data.assets));
        setDebts(cloneItems(res.data.debts));
        setCarriedFrom(res.data.carriedFrom || null);
        setSaved(res.data.saved || false);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load balance sheet');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const totalAssets = assets.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const totalDebts = debts.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const netWorth = totalAssets - totalDebts;

  const assetsWithValue = assets.filter((a) => (a.name || '').trim() && (Number(a.value) || 0) > 0);
  const debtsWithValue = debts.filter((d) => (d.name || '').trim() && (Number(d.value) || 0) > 0);

  const assetsByTag = useMemo(() => aggregateByTag(assetsWithValue), [assetsWithValue]);
  const debtsByTag = useMemo(() => aggregateByTag(debtsWithValue), [debtsWithValue]);

  const buildPie = (rows) => ({
    labels: rows.map((r) => r.tag),
    datasets: [{
      data: rows.map((r) => r.value),
      backgroundColor: PIE_COLORS,
      borderWidth: 0,
    }],
  });

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

  const addAsset = () => setAssets([...assets, { name: '', value: 0, tag: '' }]);
  const addDebt = () => setDebts([...debts, { name: '', value: 0, tag: '' }]);

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
  const assetsTagPie = assetsByTag.length > 0 ? buildPie(assetsByTag) : null;
  const debtsTagPie = debtsByTag.length > 0 ? buildPie(debtsByTag) : null;
  const hasAssetTags = assetsWithValue.some((a) => (a.tag || '').trim());
  const hasDebtTags = debtsWithValue.some((d) => (d.tag || '').trim());

  return (
    <div className="card balance-sheet-card">
      <div className="balance-sheet-header">
        <button
          type="button"
          className="section-header-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="section-header-chevron" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          <h2>Balance sheet · {monthLabel} {year}</h2>
          {!expanded && (totalAssets > 0 || totalDebts > 0) && (
            <span className="pill section-header-summary">
              Net ₹{netWorth.toLocaleString('en-IN')}
            </span>
          )}
        </button>
        <div className="balance-sheet-header-badges">
          {carriedFrom && (
            <span className="pill carried-pill">
              Carried from {MONTH_NAMES[carriedFrom.month]} {carriedFrom.year}
            </span>
          )}
          {saved && !carriedFrom && <span className="pill saved-pill">Saved</span>}
        </div>
      </div>

      {expanded && (
        <>
          <p className="muted small">
            Add assets and debts with optional tags (e.g. Gold for multiple gold items). Manage tags under{' '}
            <strong>Manage categories → Asset tags / Debt tags</strong>.
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
                        className="bs-field-name"
                        value={item.name}
                        onChange={(e) => updateAsset(i, 'name', e.target.value)}
                        placeholder="e.g. Gold coin 2gm 22k"
                      />
                      <TagSelect
                        value={item.tag}
                        options={assetTags}
                        onChange={(v) => updateAsset(i, 'tag', v)}
                        placeholder="Tag"
                      />
                      <input
                        type="number"
                        className="bs-field-value"
                        min="0"
                        step="1"
                        value={item.value || ''}
                        onChange={(e) => updateAsset(i, 'value', e.target.value)}
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        className="link-btn danger small bs-field-remove"
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
                        className="bs-field-name"
                        value={item.name}
                        onChange={(e) => updateDebt(i, 'name', e.target.value)}
                        placeholder="e.g. Home loan"
                      />
                      <TagSelect
                        value={item.tag}
                        options={debtTags}
                        onChange={(v) => updateDebt(i, 'tag', v)}
                        placeholder="Tag"
                      />
                      <input
                        type="number"
                        className="bs-field-value"
                        min="0"
                        step="1"
                        value={item.value || ''}
                        onChange={(e) => updateDebt(i, 'value', e.target.value)}
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        className="link-btn danger small bs-field-remove"
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
                      <h3>Assets by line item</h3>
                      <div className="balance-sheet-chart-wrap">
                        <Pie
                          data={{
                            labels: assetsWithValue.map((a) => a.name || '—'),
                            datasets: [{
                              data: assetsWithValue.map((a) => Number(a.value) || 0),
                              backgroundColor: PIE_COLORS,
                              borderWidth: 0,
                            }],
                          }}
                          options={pieOptions}
                        />
                      </div>
                      <p className="chart-total">Total: ₹{totalAssets.toLocaleString('en-IN')}</p>
                      <ChartBreakdownList
                        items={assetsWithValue.map((a) => ({
                          name: a.name || '—',
                          value: Number(a.value) || 0,
                        }))}
                        labelKey="name"
                        total={totalAssets}
                      />
                    </div>
                  )}
                  {debtsWithValue.length > 0 && (
                    <div className="balance-sheet-chart-card">
                      <h3>Debts by line item</h3>
                      <div className="balance-sheet-chart-wrap">
                        <Pie
                          data={{
                            labels: debtsWithValue.map((d) => d.name || '—'),
                            datasets: [{
                              data: debtsWithValue.map((d) => Number(d.value) || 0),
                              backgroundColor: PIE_COLORS.slice().reverse(),
                              borderWidth: 0,
                            }],
                          }}
                          options={pieOptions}
                        />
                      </div>
                      <p className="chart-total">Total: ₹{totalDebts.toLocaleString('en-IN')}</p>
                      <ChartBreakdownList
                        items={debtsWithValue.map((d) => ({
                          name: d.name || '—',
                          value: Number(d.value) || 0,
                        }))}
                        labelKey="name"
                        total={totalDebts}
                      />
                    </div>
                  )}
                  {hasAssetTags && assetsTagPie && (
                    <div className="balance-sheet-chart-card">
                      <h3>Assets by tag</h3>
                      <div className="balance-sheet-chart-wrap">
                        <Pie data={assetsTagPie} options={pieOptions} />
                      </div>
                      <p className="chart-total">Total: ₹{totalAssets.toLocaleString('en-IN')}</p>
                      <ChartBreakdownList
                        items={assetsByTag}
                        labelKey="tag"
                        total={totalAssets}
                      />
                    </div>
                  )}
                  {hasDebtTags && debtsTagPie && (
                    <div className="balance-sheet-chart-card">
                      <h3>Debts by tag</h3>
                      <div className="balance-sheet-chart-wrap">
                        <Pie data={debtsTagPie} options={pieOptions} />
                      </div>
                      <p className="chart-total">Total: ₹{totalDebts.toLocaleString('en-IN')}</p>
                      <ChartBreakdownList
                        items={debtsByTag}
                        labelKey="tag"
                        total={totalDebts}
                      />
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
        </>
      )}
    </div>
  );
}

export default BalanceSheetSection;
