import { useEffect, useState } from 'react';
import { useChartsExpand } from '../context/ChartsExpandContext';

export default function CollapsibleChartCard({
  title,
  chartTitle,
  defaultExpanded = false,
  wide = false,
  children,
}) {
  const { expandAll, expandAllGeneration } = useChartsExpand();
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const [collapsedInExpandAll, setCollapsedInExpandAll] = useState(false);

  useEffect(() => {
    if (!expandAll) {
      setLocalExpanded(false);
      setCollapsedInExpandAll(false);
    }
  }, [expandAll]);

  useEffect(() => {
    setCollapsedInExpandAll(false);
  }, [expandAllGeneration]);

  const expanded = expandAll ? !collapsedInExpandAll : localExpanded;

  const handleToggle = () => {
    if (expandAll) {
      setCollapsedInExpandAll((v) => !v);
    } else {
      setLocalExpanded((v) => !v);
    }
  };

  return (
    <div
      className={`card chart-card collapsible-chart-card${wide ? ' chart-card-wide' : ''}`}
      data-chart-title={chartTitle}
    >
      <button
        type="button"
        className="section-header-toggle chart-card-toggle"
        onClick={handleToggle}
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
