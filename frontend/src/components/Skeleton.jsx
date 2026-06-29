export function SkeletonLine({ width = '100%', height = '0.85rem', className = '' }) {
  return (
    <span
      className={`skeleton skeleton-line ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonBlock({ height = '120px', className = '' }) {
  return (
    <div
      className={`skeleton skeleton-block ${className}`.trim()}
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export function KpiSkeletonGrid({ count = 4 }) {
  return (
    <div className="skeleton-kpi-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-kpi-card">
          <SkeletonLine width="55%" height="0.7rem" />
          <SkeletonLine width="75%" height="1.1rem" className="skeleton-kpi-amt" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeletonRows({ rows = 4, cols = 5 }) {
  return (
    <div className="skeleton-table" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table-row">
          {Array.from({ length: cols }).map((__, c) => (
            <SkeletonLine key={c} width={c === 0 ? '40%' : '70%'} />
          ))}
        </div>
      ))}
    </div>
  );
}
