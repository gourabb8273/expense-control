import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useFormatMoney } from '../utils/formatMoney';
import { MONTH_LABELS, colorFor } from '../utils/analytics';
import { VxCard, Segmented, EmptyChart, Loading } from './charts/ChartKit';
import { CompareBars, MonthBars } from './charts/BarCharts';
import NetWorthTrend from './NetWorthTrend';
import BalanceSheetSection from './BalanceSheetSection';
import BalanceSheetYearSection from './BalanceSheetYearSection';

/** Read-only fetch of the year's month-by-month balance sheets (+ previous year, for January comparisons). */
function useBalanceYears(year, refreshKey) {
  const [state, setState] = useState({ key: null, cur: null, prev: null });
  const key = `${year}-${refreshKey}`;
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/balance-sheet/year/${year}`).then((r) => r.data?.byMonth || null).catch(() => null),
      api.get(`/balance-sheet/year/${year - 1}`).then((r) => r.data?.byMonth || null).catch(() => null),
    ]).then(([cur, prev]) => !cancelled && setState({ key: `${year}-${refreshKey}`, cur, prev }));
    return () => {
      cancelled = true;
    };
  }, [year, refreshKey]);
  return state.key === key ? state : { cur: null, prev: null, loading: true };
}

const EMPTY = { totalAssets: 0, totalDebts: 0, netWorth: 0, assets: [], debts: [] };

function lineDiff(curItems = [], prevItems = []) {
  const map = new Map();
  prevItems.forEach((i) => map.set(i.name, { name: i.name, tag: i.tag, prev: Number(i.value) || 0, value: 0 }));
  curItems.forEach((i) => {
    const row = map.get(i.name) || { name: i.name, tag: i.tag, prev: 0, value: 0 };
    row.value = Number(i.value) || 0;
    row.tag = i.tag || row.tag;
    map.set(i.name, row);
  });
  return Array.from(map.values())
    .map((r) => ({ ...r, delta: r.value - r.prev }))
    .sort((a, b) => b.value - a.value || b.prev - a.prev);
}

function byTag(items = []) {
  const m = new Map();
  items.forEach((i) => {
    const k = (i.tag || '').trim() || 'Untagged';
    m.set(k, (m.get(k) || 0) + (Number(i.value) || 0));
  });
  return m;
}

/**
 * "Balance sheet" tab: everything about assets & debts in one place.
 * Summary + month-over-month detail + year trend are read-only. The editable sheet is the
 * existing BalanceSheetSection (same component and save flow as the Month tab).
 */
export default function BalanceView({ year, month, refreshKey, tagsRefreshKey, onMetaChange, onSaved }) {
  const { inr, compact, signed, hideAmounts } = useFormatMoney();
  const fmt = (v) => inr(Math.round(v));
  const { cur, prev } = useBalanceYears(year, refreshKey);
  const [side, setSide] = useState('assets');

  const now = cur?.[month] || null;
  const before = month === 1 ? prev?.[12] || null : cur?.[month - 1] || null;
  const startOfYear = prev?.[12] || cur?.[1] || null;
  const prevLabel = month === 1 ? `Dec ${year - 1}` : MONTH_LABELS[month - 2];
  const today = new Date();
  const stop = year === today.getFullYear() ? today.getMonth() + 1 : year < today.getFullYear() ? 12 : 0;

  const rows = useMemo(() => (cur ? Array.from({ length: 12 }, (_, i) => cur[i + 1] || EMPTY) : null), [cur]);
  const hasYear = rows && rows.some((r) => r.totalAssets || r.totalDebts);

  const monthlyChange = useMemo(() => {
    if (!rows) return [];
    return rows.map((r, i) => {
      if (i >= stop) return 0;
      const p = i === 0 ? prev?.[12] : rows[i - 1];
      return p ? r.netWorth - p.netWorth : 0;
    });
  }, [rows, prev, stop]);

  const detail = useMemo(() => {
    if (!now) return [];
    return side === 'assets' ? lineDiff(now.assets, before?.assets) : lineDiff(now.debts, before?.debts);
  }, [now, before, side]);

  const tagRows = useMemo(() => {
    if (!now) return [];
    const c = byTag(side === 'assets' ? now.assets : now.debts);
    const p = byTag(side === 'assets' ? before?.assets : before?.debts);
    return Array.from(c, ([name, value]) => ({ name, value, prev: p.get(name) || 0, color: colorFor(name) })).sort((a, b) => b.value - a.value);
  }, [now, before, side]);

  const d = (a, b) => (a != null && b != null ? a - b : null);
  const nwDelta = d(now?.netWorth, before?.netWorth);
  const nwYtd = d(now?.netWorth, startOfYear?.netWorth);

  const Delta = ({ v, invert = false, label }) =>
    v == null ? null : (
      <span className={`bs-delta ${(invert ? -v : v) >= 0 ? 'good' : 'bad'}`}>
        {v >= 0 ? '▲' : '▼'} {hideAmounts ? '' : compact(Math.abs(v))} {label}
      </span>
    );

  return (
    <div className="balance-view">
      {!cur ? (
        <section className="card bs-hero">
          <Loading text={`Loading ${MONTH_LABELS[month - 1]} ${year}…`} />
        </section>
      ) : (
      <section className="card bs-hero" aria-label="Net worth summary">
        <span className="glance-eyebrow">Net worth · {MONTH_LABELS[month - 1]} {year}</span>
        <span className="glance-big">{now ? inr(now.netWorth) : '—'}</span>
        <div className="bs-hero-deltas">
          <Delta v={nwDelta} label={`vs ${prevLabel}`} />
          {month !== 1 && <Delta v={nwYtd} label="this year" />}
        </div>
        {now && !now.saved && (
          <p className="bs-carried">Not saved for {MONTH_LABELS[month - 1]} yet: showing values carried from an earlier month.</p>
        )}
        <div className="bs-hero-split">
          <div className="glance-tile">
            <span className="glance-tile-label">Assets</span>
            <span className="glance-tile-val bs-asset">{now ? (hideAmounts ? inr(now.totalAssets) : compact(now.totalAssets)) : '—'}</span>
            <Delta v={d(now?.totalAssets, before?.totalAssets)} label={`vs ${prevLabel}`} />
          </div>
          <div className="glance-tile">
            <span className="glance-tile-label">Debts</span>
            <span className="glance-tile-val bs-debt">{now ? (hideAmounts ? inr(now.totalDebts) : compact(now.totalDebts)) : '—'}</span>
            <Delta v={d(now?.totalDebts, before?.totalDebts)} invert label={`vs ${prevLabel}`} />
          </div>
        </div>
        {now && now.totalAssets > 0 && (
          <div className="bs-ratio" title="Debts as a share of assets">
            <span className="bs-ratio-bar">
              <span style={{ width: `${Math.min(100, (now.totalDebts / now.totalAssets) * 100)}%` }} />
            </span>
            <small>Debts are {Math.round((now.totalDebts / now.totalAssets) * 100)}% of assets</small>
          </div>
        )}
      </section>
      )}

      <div className="vx-grid">
        <VxCard
          title={`Line by line vs ${prevLabel}`}
          subtitle="Every item, what it was, what it is now"
          right={<Segmented value={side} onChange={setSide} options={[{ value: 'assets', label: 'Assets' }, { value: 'debts', label: 'Debts' }]} />}
          wide
        >
          {!cur ? (
            <Loading />
          ) : detail.length ? (
            <ul className="bs-lines">
              {detail.map((r) => {
                const good = side === 'assets' ? r.delta >= 0 : r.delta <= 0;
                return (
                  <li key={r.name}>
                    <span className="bs-line-name">
                      <i style={{ background: colorFor(r.tag || r.name) }} />
                      <span>
                        {r.name}
                        {r.tag && <small>{r.tag}</small>}
                      </span>
                    </span>
                    <span className="bs-line-vals">
                      <b>{fmt(r.value)}</b>
                      {r.prev === 0 && r.value > 0 ? (
                        <small className="bs-new">New</small>
                      ) : r.value === 0 && r.prev > 0 ? (
                        <small className="bs-gone">Removed · was {fmt(r.prev)}</small>
                      ) : r.delta !== 0 ? (
                        <small className={good ? 'good' : 'bad'}>
                          {signed(Math.round(r.delta))}
                          {r.prev ? ` (${r.delta > 0 ? '+' : ''}${((r.delta / r.prev) * 100).toFixed(1)}%)` : ''}
                        </small>
                      ) : (
                        <small className="muted">No change</small>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyChart text={`No ${side} recorded for this month.`} />
          )}
        </VxCard>

        <VxCard title={side === 'assets' ? 'What you own, by tag' : 'What you owe, by tag'} subtitle={`Marker = ${prevLabel}`}>
          {tagRows.length ? (
            <CompareBars rows={tagRows} format={fmt} total={tagRows.reduce((s, r) => s + r.value, 0)} hideAmounts={hideAmounts} upIsGood={side === 'assets'} />
          ) : (
            <EmptyChart text="Nothing here yet." />
          )}
        </VxCard>

        <VxCard title="Net worth change each month" subtitle={hideAmounts ? '' : `${signed(Math.round(monthlyChange.reduce((a, b) => a + b, 0)))} so far in ${year}`}>
          {!cur ? (
            <Loading />
          ) : hasYear ? (
            <MonthBars
              labels={MONTH_LABELS.map((m) => m[0])}
              values={monthlyChange}
              color={(v) => (v >= 0 ? '#22c55e' : '#f43f5e')}
              format={fmt}
              compact={compact}
              hideAmounts={hideAmounts}
              highlight={month - 1}
            />
          ) : (
            <EmptyChart text="No balance sheet saved this year." />
          )}
        </VxCard>

        <VxCard title={`Net worth, assets & debts · ${year}`} subtitle="Assets up, debts down, net worth as the line: tap a month" wide>
          {!cur ? <Loading /> : hasYear ? <NetWorthTrend rows={rows} stop={stop || 12} highlight={month - 1} /> : <EmptyChart text="No balance sheet saved this year." />}
        </VxCard>
      </div>

      <div className="bs-edit-wrap">
        <BalanceSheetSection
          year={year}
          month={month}
          tagsRefreshKey={tagsRefreshKey}
          onMetaChange={onMetaChange}
          onSaved={onSaved}
        />
      </div>
      <BalanceSheetYearSection year={year} refreshKey={refreshKey} />
    </div>
  );
}
