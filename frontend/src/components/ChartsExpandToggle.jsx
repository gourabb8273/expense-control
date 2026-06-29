import { useChartsExpand } from '../context/ChartsExpandContext';

export default function ChartsExpandToggle() {
  const { expandAll, setExpandAll } = useChartsExpand();

  return (
    <div className="charts-expand-row">
      <label className="charts-expand-toggle">
        <input
          type="checkbox"
          checked={expandAll}
          onChange={(e) => setExpandAll(e.target.checked)}
        />
        <span className="charts-expand-label">Expand all charts</span>
      </label>
      <span className="muted small charts-expand-hint">
        {expandAll
          ? 'All charts open — collapse any chart individually; re-check to reset all open'
          : 'Charts stay collapsed until you expand them'}
      </span>
    </div>
  );
}
