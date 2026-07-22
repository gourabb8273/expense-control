import { useMemo } from 'react';
import { Doughnut, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { formatSharePct } from '../utils/formatSharePct';
import { useFormatMoney } from '../utils/formatMoney';
import { itemColor, groupColor } from '../utils/investmentPlanColors';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

function lineOpacity(index, total) {
  if (total <= 1) return 1;
  return Math.max(0.5, 1 - index * (0.35 / (total - 1)));
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildGroups(itemsWithAmount) {
  const map = new Map();
  itemsWithAmount.forEach((item) => {
    const tag = (item.tag || '').trim() || 'Other';
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag).push(item);
  });
  return Array.from(map.entries())
    .map(([tag, lines], index) => ({
      tag,
      color: groupColor(index),
      total: lines.reduce((s, i) => s + (Number(i.amount) || 0), 0),
      lines: [...lines].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)),
    }))
    .sort((a, b) => b.total - a.total);
}

function buildSortedItems(itemsWithAmount, groups) {
  const tagColor = new Map(groups.map((g) => [g.tag, g.color]));
  return [...itemsWithAmount]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .map((item, index) => {
      const tag = (item.tag || '').trim() || 'Other';
      return {
        ...item,
        tag,
        color: itemColor(index),
        groupColor: tagColor.get(tag) || groupColor(0),
      };
    });
}

const doughnutOptionsBase = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '64%',
  plugins: {
    legend: { display: false },
    datalabels: {
      display: (ctx) => {
        const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
        const v = ctx.raw || 0;
        if (!total || !v) return false;
        return (v / total) * 100 >= 4.5;
      },
      color: '#f8fafc',
      font: { size: 10, weight: '700' },
      formatter: (v, ctx) => {
        const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
        return `${formatSharePct(v, total)}%`;
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      borderWidth: 1,
      padding: 10,
    },
  },
};

function buildDoughnutOptions(chartLabel) {
  return {
    ...doughnutOptionsBase,
    plugins: {
      ...doughnutOptionsBase.plugins,
      tooltip: {
        ...doughnutOptionsBase.plugins.tooltip,
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: (ctx) => {
            const v = ctx.raw || 0;
            const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
            const pct = formatSharePct(v, total);
            const tag = ctx.dataset.tags?.[ctx.dataIndex] || '';
            const platform = ctx.dataset.platforms?.[ctx.dataIndex] || '';
            const lines = [`${chartLabel(v)} · ${pct}% of plan`];
            if (tag) lines.push(`Group: ${tag}`);
            if (platform) lines.push(`Platform: ${platform}`);
            return lines;
          },
        },
      },
    },
  };
}

function buildGroupPieOptions(chartLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw || 0;
            const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
            const pct = formatSharePct(v, total);
            return `${chartLabel(v)} (${pct}%)`;
          },
        },
      },
    },
  };
}

function buildMiniPieOptions(chartLabel) {
  const base = buildGroupPieOptions(chartLabel);
  return {
    ...base,
    plugins: {
      ...base.plugins,
      tooltip: {
        ...base.plugins.tooltip,
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw || 0;
            const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
            const pct = formatSharePct(v, total);
            const label = ctx.label || '';
            return `${label}: ${chartLabel(v)} (${pct}% of group)`;
          },
        },
      },
    },
  };
}

function GroupMiniBar({ group }) {
  return (
    <div
      className="investment-plan-viz-mini-bar"
      role="img"
      aria-label={`${group.tag} split across ${group.lines.length} allocations`}
    >
      {group.lines.map((line, i) => (
        <div
          key={`${group.tag}-${line.name}-mini`}
          className="investment-plan-viz-mini-bar-seg"
          style={{
            width: `${((Number(line.amount) || 0) / group.total) * 100}%`,
            backgroundColor: group.color,
            opacity: lineOpacity(i, group.lines.length),
          }}
        />
      ))}
    </div>
  );
}

function GroupDetailChart({ group, totalPlanned }) {
  const { inr, chartLabel, hideAmounts } = useFormatMoney();
  const miniPieOptions = useMemo(
    () => buildMiniPieOptions(chartLabel),
    [chartLabel, hideAmounts]
  );
  const pieData = {
    labels: group.lines.map((l) => l.name),
    datasets: [{
      data: group.lines.map((l) => Number(l.amount) || 0),
      backgroundColor: group.lines.map((_, i) =>
        hexToRgba(group.color, lineOpacity(i, group.lines.length))
      ),
      borderColor: 'rgba(15, 23, 42, 0.45)',
      borderWidth: 1,
    }],
  };

  return (
    <article className="investment-plan-viz-group-chart" style={{ '--group-color': group.color }}>
      <header className="investment-plan-viz-group-chart-head">
        <span className="investment-plan-viz-group-chart-tag">{group.tag}</span>
        <span className="investment-plan-viz-group-chart-meta">
          {inr(group.total)}
          <em>{formatSharePct(group.total, totalPlanned)}% of plan</em>
        </span>
      </header>
      {group.lines.length > 1 ? (
        <div className="investment-plan-viz-group-chart-body">
          <div className="investment-plan-viz-group-chart-pie">
            <Pie data={pieData} options={miniPieOptions} />
          </div>
          <ul className="investment-plan-viz-group-chart-legend">
            {group.lines.map((line, i) => (
              <li key={`${group.tag}-${line.name}-legend`}>
                <i
                  className="investment-plan-viz-swatch"
                  style={{ backgroundColor: group.color, opacity: lineOpacity(i, group.lines.length) }}
                  aria-hidden="true"
                />
                <span className="investment-plan-viz-group-chart-legend-name">{line.name}</span>
                <strong>{inr(line.amount)}</strong>
                <em>{formatSharePct(line.amount, group.total)}%</em>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="investment-plan-viz-group-chart-single">
          <GroupMiniBar group={group} />
          <p className="investment-plan-viz-group-chart-single-line">
            <span>{group.lines[0]?.name}</span>
            <strong>{inr(group.lines[0]?.amount || 0)}</strong>
          </p>
        </div>
      )}
    </article>
  );
}

function GroupStrip({ groups, totalPlanned }) {
  const { inr } = useFormatMoney();
  return (
    <div className="investment-plan-viz-strip">
      <div
        className="investment-plan-viz-bar investment-plan-viz-bar-nested"
        role="img"
        aria-label={`Plan split across ${groups.length} groups`}
      >
        {groups.map((g) => (
          <div
            key={g.tag}
            className="investment-plan-viz-bar-group"
            style={{ width: `${(g.total / totalPlanned) * 100}%` }}
            title={`${g.tag}: ${inr(g.total)}`}
          >
            {g.lines.map((line, i) => (
              <div
                key={`${g.tag}-${line.name}`}
                className="investment-plan-viz-bar-seg investment-plan-viz-bar-subseg"
                style={{
                  width: `${((Number(line.amount) || 0) / g.total) * 100}%`,
                  backgroundColor: g.color,
                  opacity: lineOpacity(i, g.lines.length),
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="investment-plan-viz-group-pills">
        {groups.map((g) => (
          <span key={g.tag} className="investment-plan-viz-group-pill" style={{ '--pill-color': g.color }}>
            <i aria-hidden="true" />
            {g.tag}
            <em>{formatSharePct(g.total, totalPlanned)}%</em>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function InvestmentPlanVisualization({ itemsWithAmount, notes, totalPlanned }) {
  const { inr, chartLabel, hideAmounts } = useFormatMoney();
  const doughnutOptions = useMemo(
    () => buildDoughnutOptions(chartLabel),
    [chartLabel, hideAmounts]
  );
  const groupPieOptions = useMemo(
    () => buildGroupPieOptions(chartLabel),
    [chartLabel, hideAmounts]
  );
  const groups = useMemo(() => buildGroups(itemsWithAmount), [itemsWithAmount]);
  const sortedItems = useMemo(
    () => buildSortedItems(itemsWithAmount, groups),
    [itemsWithAmount, groups]
  );

  if (!itemsWithAmount.length || totalPlanned <= 0) return null;

  const itemChartData = {
    labels: sortedItems.map((i) => i.name),
    datasets: [{
      data: sortedItems.map((i) => Number(i.amount) || 0),
      backgroundColor: sortedItems.map((i) => i.color),
      borderColor: 'rgba(15, 23, 42, 0.55)',
      borderWidth: 2,
      hoverBorderColor: 'rgba(248, 250, 252, 0.85)',
      hoverBorderWidth: 2,
      hoverOffset: 6,
      tags: sortedItems.map((i) => i.tag),
      platforms: sortedItems.map((i) => (i.platform || '').trim()),
    }],
  };

  const groupPieData = {
    labels: groups.map((g) => g.tag),
    datasets: [{
      data: groups.map((g) => g.total),
      backgroundColor: groups.map((g) => g.color),
      borderColor: 'rgba(15, 23, 42, 0.45)',
      borderWidth: 2,
      hoverOffset: 4,
    }],
  };

  return (
    <div className="investment-plan-viz">
      <header className="investment-plan-viz-hero">
        <div className="investment-plan-viz-total">
          <span className="investment-plan-viz-total-label">Portfolio plan</span>
          <strong className="investment-plan-viz-total-amt">
            {inr(totalPlanned)}
          </strong>
          <span className="investment-plan-viz-total-meta">
            {itemsWithAmount.length} allocations · {groups.length} groups
          </span>
        </div>
        {notes?.trim() && (
          <p className="investment-plan-viz-notes">{notes.trim()}</p>
        )}
      </header>

      <GroupStrip groups={groups} totalPlanned={totalPlanned} />

      <section className="investment-plan-viz-primary">
        <h3 className="investment-plan-viz-section-title">All allocations</h3>
        <div className="investment-plan-viz-item-chart">
          <div className="investment-plan-viz-donut-wrap">
            <div className="investment-plan-viz-donut-canvas">
              <Doughnut data={itemChartData} options={doughnutOptions} />
            </div>
            <div className="investment-plan-viz-donut-center" aria-hidden="true">
              <span>Total</span>
              <strong>{inr(totalPlanned)}</strong>
            </div>
          </div>
          <ul className="investment-plan-viz-item-legend">
            {sortedItems.map((item) => (
              <li key={`${item.name}-${item.platform || ''}`}>
                <i className="investment-plan-viz-item-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <div className="investment-plan-viz-item-main">
                  <span className="investment-plan-viz-item-name">{item.name}</span>
                  <span className="investment-plan-viz-item-meta">
                    <em className="investment-plan-viz-item-tag" style={{ '--tag-color': item.groupColor }}>
                      {item.tag}
                    </em>
                    {(item.platform || '').trim() && (
                      <>
                        <span className="investment-plan-viz-item-sep">·</span>
                        <span className="investment-plan-viz-item-platform">{(item.platform || '').trim()}</span>
                      </>
                    )}
                  </span>
                </div>
                <span className="investment-plan-viz-item-amt">
                  {inr(item.amount)}
                  <em>{formatSharePct(item.amount, totalPlanned)}%</em>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="investment-plan-viz-charts-row">
        <div className="investment-plan-viz-chart">
          <h3 className="investment-plan-viz-section-title">Split by group</h3>
          <div className="investment-plan-viz-chart-wrap">
            <Pie data={groupPieData} options={groupPieOptions} />
          </div>
          <ul className="investment-plan-viz-bar-legend investment-plan-viz-pie-legend">
            {groups.map((g) => (
              <li key={g.tag}>
                <i className="investment-plan-viz-swatch" style={{ backgroundColor: g.color }} aria-hidden="true" />
                <span>{g.tag}</span>
                <strong>{inr(g.total)}</strong>
                <em>{formatSharePct(g.total, totalPlanned)}%</em>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="investment-plan-viz-within-groups">
        <h3 className="investment-plan-viz-section-title">Within each group</h3>
        <div className="investment-plan-viz-group-charts">
          {groups.map((g) => (
            <GroupDetailChart key={g.tag} group={g} totalPlanned={totalPlanned} />
          ))}
        </div>
      </section>

      <section className="investment-plan-viz-details">
        <h3 className="investment-plan-viz-section-title">By group</h3>
        <div className="investment-plan-viz-groups">
          {groups.map((g) => (
            <article key={g.tag} className="investment-plan-viz-group" style={{ '--group-color': g.color }}>
              <header className="investment-plan-viz-group-head">
                <span className="investment-plan-viz-group-tag">{g.tag}</span>
                <span className="investment-plan-viz-group-amt">
                  {inr(g.total)}
                  <em>{formatSharePct(g.total, totalPlanned)}%</em>
                </span>
              </header>
              <ul className="investment-plan-viz-group-lines">
                {g.lines.map((line) => (
                  <li key={`${line.name}-${line.platform || ''}`}>
                    <span className="investment-plan-viz-line-name">{line.name}</span>
                    {(line.platform || '').trim() ? (
                      <span className="investment-plan-viz-line-platform">{(line.platform || '').trim()}</span>
                    ) : (
                      <span className="investment-plan-viz-line-platform investment-plan-viz-line-platform-empty" aria-hidden="true" />
                    )}
                    <span className="investment-plan-viz-line-amt">
                      {inr(line.amount)}
                      <em className="investment-plan-viz-line-pct">{formatSharePct(line.amount, totalPlanned)}%</em>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
