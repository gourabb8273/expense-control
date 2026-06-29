import { useChartsExpand } from '../context/ChartsExpandContext';

export const LINE_CHART_PX_PER_MONTH = 52;

export function lineChartMinWidth(monthCount) {
  return Math.max(monthCount, 6) * LINE_CHART_PX_PER_MONTH;
}

export default function LineChartFrame({ monthCount, className = '', children }) {
  const { lineChartFullWidth } = useChartsExpand();

  return (
    <div
      className={`chart-line-scroll${lineChartFullWidth ? ' is-full-width' : ' is-fit-width'}`}
    >
      <div
        className={`chart-line-scroll-inner ${className}`.trim()}
        style={lineChartFullWidth ? { minWidth: lineChartMinWidth(monthCount) } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
