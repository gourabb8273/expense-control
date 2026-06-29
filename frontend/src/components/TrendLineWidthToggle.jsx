import { useChartsExpand } from '../context/ChartsExpandContext';

export default function TrendLineWidthToggle() {
  const { lineChartFullWidth, setLineChartFullWidth } = useChartsExpand();

  return (
    <div className="chart-width-toggle trend-line-width-toggle" role="group" aria-label="Trend line width">
      <button
        type="button"
        className={!lineChartFullWidth ? 'primary-btn small' : 'ghost-btn small'}
        onClick={() => setLineChartFullWidth(false)}
        aria-pressed={!lineChartFullWidth}
      >
        Fit screen
      </button>
      <button
        type="button"
        className={lineChartFullWidth ? 'primary-btn small' : 'ghost-btn small'}
        onClick={() => setLineChartFullWidth(true)}
        aria-pressed={lineChartFullWidth}
      >
        Full width
      </button>
    </div>
  );
}
