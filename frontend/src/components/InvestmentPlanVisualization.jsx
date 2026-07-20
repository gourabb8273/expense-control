import { useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import { formatSharePct } from '../utils/formatSharePct';

const GROUP_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#eab308', '#0ea5e9', '#14b8a6'];

function groupColor(index) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

function lineOpacity(index, total) {
  if (total <= 1) return 1;
  return Math.max(0.45, 1 - index * (0.45 / (total - 1)));
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

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    datalabels: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.raw || 0;
          const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
          const pct = formatSharePct(v, total);
          return `₹${Number(v).toLocaleString('en-IN')} (${pct}%)`;
        },
      },
    },
  },
};

const miniPieOptions = {
  ...pieOptions,
  plugins: {
    ...pieOptions.plugins,
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.raw || 0;
          const total = ctx.dataset.data.reduce((s, x) => s + x, 0);
          const pct = formatSharePct(v, total);
          const label = ctx.label || '';
          return `${label}: ₹${Number(v).toLocaleString('en-IN')} (${pct}% of group)`;
        },
      },
    },
  },
};

function NestedStackBar({ groups, totalPlanned }) {
  return (
    <div
      className="investment-plan-viz-bar investment-plan-viz-bar-nested"
      role="img"
      aria-label={`Plan split across ${groups.length} groups and individual allocations`}
    >
      {groups.map((g) => (
        <div
          key={g.tag}
          className="investment-plan-viz-bar-group"
          style={{ width: `${(g.total / totalPlanned) * 100}%` }}
          title={`${g.tag}: ₹${g.total.toLocaleString('en-IN')} (${formatSharePct(g.total, totalPlanned)}%)`}
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
              title={`${line.name}: ₹${(Number(line.amount) || 0).toLocaleString('en-IN')} (${formatSharePct(line.amount, g.total)}% of ${g.tag})`}
            />
          ))}
        </div>
      ))}
    </div>
  );
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
          title={`${line.name}: ${formatSharePct(line.amount, group.total)}% of ${group.tag}`}
        />
      ))}
    </div>
  );
}

function GroupDetailChart({ group, totalPlanned }) {
  const pieData = {
    labels: group.lines.map((l) => l.name),
    datasets: [{
      data: group.lines.map((l) => Number(l.amount) || 0),
      backgroundColor: group.lines.map((_, i) => hexToRgba(group.color, lineOpacity(i, group.lines.length))),
      borderWidth: 0,
    }],
  };

  return (
    <article className="investment-plan-viz-group-chart" style={{ '--group-color': group.color }}>
      <header className="investment-plan-viz-group-chart-head">
        <span className="investment-plan-viz-group-chart-tag">{group.tag}</span>
        <span className="investment-plan-viz-group-chart-meta">
          ₹{group.total.toLocaleString('en-IN')}
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
                <strong>₹{(Number(line.amount) || 0).toLocaleString('en-IN')}</strong>
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
            <strong>₹{(Number(group.lines[0]?.amount) || 0).toLocaleString('en-IN')}</strong>
          </p>
        </div>
      )}
    </article>
  );
}

export default function InvestmentPlanVisualization({ itemsWithAmount, notes, totalPlanned }) {
  const groups = useMemo(() => buildGroups(itemsWithAmount), [itemsWithAmount]);

  if (!itemsWithAmount.length || totalPlanned <= 0) return null;

  const pieData = {
    labels: groups.map((g) => g.tag),
    datasets: [{
      data: groups.map((g) => g.total),
      backgroundColor: groups.map((g) => g.color),
      borderWidth: 0,
    }],
  };

  return (
    <div className="investment-plan-viz">
      <div className="investment-plan-viz-hero">
        <div className="investment-plan-viz-total">
          <span className="investment-plan-viz-total-label">Portfolio plan</span>
          <strong className="investment-plan-viz-total-amt">
            ₹{totalPlanned.toLocaleString('en-IN')}
          </strong>
          <span className="investment-plan-viz-total-meta">
            {itemsWithAmount.length} allocations · {groups.length} groups
          </span>
        </div>
        {notes?.trim() && (
          <p className="investment-plan-viz-notes">{notes.trim()}</p>
        )}
      </div>

      <div className="investment-plan-viz-bar-wrap">
        <p className="investment-plan-viz-bar-caption">
          Full split — groups with fund-level detail inside each segment
        </p>
        <NestedStackBar groups={groups} totalPlanned={totalPlanned} />
        <ul className="investment-plan-viz-bar-legend">
          {groups.map((g) => (
            <li key={g.tag}>
              <i className="investment-plan-viz-swatch" style={{ backgroundColor: g.color }} aria-hidden="true" />
              <span>{g.tag}</span>
              <strong>₹{g.total.toLocaleString('en-IN')}</strong>
              <em>{formatSharePct(g.total, totalPlanned)}%</em>
              {g.lines.length > 1 && (
                <span className="investment-plan-viz-legend-sub">{g.lines.length} funds</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="investment-plan-viz-body">
        <div className="investment-plan-viz-groups">
          {groups.map((g) => (
            <section key={g.tag} className="investment-plan-viz-group" style={{ '--group-color': g.color }}>
              <header className="investment-plan-viz-group-head">
                <span className="investment-plan-viz-group-tag">{g.tag}</span>
                <span className="investment-plan-viz-group-amt">
                  ₹{g.total.toLocaleString('en-IN')}
                  <em>{formatSharePct(g.total, totalPlanned)}% of plan</em>
                </span>
              </header>
              {g.lines.length > 1 && <GroupMiniBar group={g} />}
              <ul className="investment-plan-viz-group-lines">
                {g.lines.map((line) => (
                  <li key={`${line.name}-${line.platform || ''}`}>
                    <span className="investment-plan-viz-line-name">{line.name}</span>
                    {(line.platform || '').trim() ? (
                      <span className="investment-plan-viz-line-platform">
                        {(line.platform || '').trim()}
                      </span>
                    ) : (
                      <span className="investment-plan-viz-line-platform investment-plan-viz-line-platform-empty" aria-hidden="true" />
                    )}
                    <span className="investment-plan-viz-line-amt">
                      ₹{(Number(line.amount) || 0).toLocaleString('en-IN')}
                      <em className="investment-plan-viz-line-pct">
                        {formatSharePct(line.amount, g.total)}% of {g.tag}
                      </em>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="investment-plan-viz-chart">
          <h3>Split by group</h3>
          <div className="investment-plan-viz-chart-wrap">
            <Pie data={pieData} options={pieOptions} />
          </div>
          <ul className="investment-plan-viz-bar-legend investment-plan-viz-pie-legend">
            {groups.map((g) => (
              <li key={g.tag}>
                <i className="investment-plan-viz-swatch" style={{ backgroundColor: g.color }} aria-hidden="true" />
                <span>{g.tag}</span>
                <strong>₹{g.total.toLocaleString('en-IN')}</strong>
                <em>{formatSharePct(g.total, totalPlanned)}%</em>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="investment-plan-viz-within-groups">
        <h3 className="investment-plan-viz-within-title">Within each group</h3>
        <p className="investment-plan-viz-within-sub muted small">
          How each group splits across individual allocations
        </p>
        <div className="investment-plan-viz-group-charts">
          {groups.map((g) => (
            <GroupDetailChart key={g.tag} group={g} totalPlanned={totalPlanned} />
          ))}
        </div>
      </section>
    </div>
  );
}
