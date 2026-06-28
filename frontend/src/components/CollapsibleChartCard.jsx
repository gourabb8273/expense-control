import { useState } from 'react';

export default function CollapsibleChartCard({
  title,
  chartTitle,
  defaultExpanded = false,
  wide = false,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`card chart-card collapsible-chart-card${wide ? ' chart-card-wide' : ''}`}
      data-chart-title={chartTitle}
    >
      <button
        type="button"
        className="section-header-toggle chart-card-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="section-header-chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        <h3>{title}</h3>
      </button>
      {expanded && children}
    </div>
  );
}
