import { useFormatMoney } from '../utils/formatMoney';
import CollapsibleSection from './CollapsibleSection';

const COLORS = {
  inflow: '#818cf8',
  shortfall: '#f97316',
  investment: '#22c55e',
  expense: '#ef4444',
  leftover: '#6366f1',
};

const WIDTH = 720;
const NODE_W = 12;
const GAP = 12;
const MIN_NODE_H = 4;
const COLUMN_X = [8, 250, 470];

function topWithOther(rows, limit, otherLabel) {
  const sorted = rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  if (sorted.length <= limit + 1) return sorted;
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((s, r) => s + r.total, 0);
  return [...head, { category: otherLabel, total: rest }];
}

/** Lay out one column of stacked nodes; returns nodes with y/h. */
function layoutColumn(nodes, scale, top) {
  let y = top;
  return nodes.map((n) => {
    const h = Math.max(MIN_NODE_H, n.value * scale);
    const placed = { ...n, y, h };
    y += h + GAP;
    return placed;
  });
}

/**
 * Links between two adjacent columns: both columns are stacks of the same money, so a link
 * carries the overlap of a source's and a target's cumulative ranges. No crossings.
 */
function linkColumns(sources, targets) {
  const links = [];
  let sStart = 0;
  sources.forEach((s) => {
    const sEnd = sStart + s.value;
    let tStart = 0;
    targets.forEach((t) => {
      const tEnd = tStart + t.value;
      const overlap = Math.min(sEnd, tEnd) - Math.max(sStart, tStart);
      if (overlap > 0) links.push({ source: s, target: t, value: overlap });
      tStart = tEnd;
    });
    sStart = sEnd;
  });
  return links;
}

function bandPath(x0, y0, x1, y1, h0, h1) {
  const xm = (x0 + x1) / 2;
  return `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h1} C${xm},${y1 + h1} ${xm},${y0 + h0} ${x0},${y0 + h0} Z`;
}

/**
 * Inflow → investments / expenses / left over → top categories.
 * Categories are [{ category, total }].
 */
export default function MoneyFlowDiagram({ id = 'money-flow', title = 'Money flow', inflow, expenseCategories, investmentCategories }) {
  const { inr, hideAmounts } = useFormatMoney();
  const expCats = topWithOther(expenseCategories || [], 5, 'Other expenses');
  const invCats = topWithOther(investmentCategories || [], 4, 'Other investments');
  const expense = expCats.reduce((s, r) => s + r.total, 0);
  const investment = invCats.reduce((s, r) => s + r.total, 0);
  const outflow = expense + investment;
  const inflowAmt = Math.max(0, Number(inflow) || 0);

  if (inflowAmt <= 0 && outflow <= 0) {
    return (
      <CollapsibleSection id={id} title={title} className="money-flow-card" summary="Nothing to show yet">
        <p className="muted small">Add cash inflow or entries to see where your money goes.</p>
      </CollapsibleSection>
    );
  }

  const leftover = Math.max(0, inflowAmt - outflow);
  const shortfall = Math.max(0, outflow - inflowAmt);
  const total = Math.max(inflowAmt, outflow);

  const col0 = [
    inflowAmt > 0 && { id: 'inflow', label: 'Inflow', value: inflowAmt, color: COLORS.inflow },
    shortfall > 0 && { id: 'shortfall', label: 'Over inflow', value: shortfall, color: COLORS.shortfall },
  ].filter(Boolean);
  // Left over sits on top: it has no categories, so no bands cross it
  const col1 = [
    leftover > 0 && { id: 'leftover', label: 'Left over', value: leftover, color: COLORS.leftover },
    investment > 0 && { id: 'investment', label: 'Investments', value: investment, color: COLORS.investment },
    expense > 0 && { id: 'expense', label: 'Expenses', value: expense, color: COLORS.expense },
  ].filter(Boolean);
  const col2 = [
    ...invCats.map((c) => ({
      id: `i-${c.category}`, parent: 'investment', label: c.category, value: c.total, color: COLORS.investment,
    })),
    ...expCats.map((c) => ({
      id: `e-${c.category}`, parent: 'expense', label: c.category, value: c.total, color: COLORS.expense,
    })),
  ];

  const maxNodes = Math.max(col0.length, col1.length, col2.length);
  const baseHeight = Math.max(220, maxNodes * 30 + 20);
  const usable = baseHeight - 20 - GAP * (maxNodes - 1) - MIN_NODE_H * maxNodes;
  const scale = Math.max(0.0001, usable / total);

  const placed01 = [col0, col1].map((c) => layoutColumn(c, scale, 10));
  const firstParent = placed01[1].find((n) => n.id !== 'leftover');
  const cols = [...placed01, layoutColumn(col2, scale, firstParent ? firstParent.y : 10)];
  const height = Math.max(baseHeight, ...cols.flat().map((n) => n.y + n.h + 10));
  const byId = new Map(cols[1].map((n) => [n.id, n]));
  const linkSets = [
    linkColumns(cols[0], cols[1]),
    cols[2].map((t) => ({ source: byId.get(t.parent), target: t, value: t.value })),
  ];

  const paths = [];
  linkSets.forEach((links, ci) => {
    const offsets = new Map();
    links.forEach((l) => {
      const so = offsets.get(l.source.id) || 0;
      const to = offsets.get(`t-${l.target.id}`) || 0;
      const h0 = (l.value / l.source.value) * l.source.h;
      const h1 = (l.value / l.target.value) * l.target.h;
      offsets.set(l.source.id, so + h0);
      offsets.set(`t-${l.target.id}`, to + h1);
      paths.push({
        key: `${ci}-${l.source.id}-${l.target.id}`,
        d: bandPath(
          COLUMN_X[ci] + NODE_W,
          l.source.y + so,
          COLUMN_X[ci + 1],
          l.target.y + to,
          h0,
          h1
        ),
        color: ci === 0 ? l.target.color : l.source.color,
        title: `${l.source.label} → ${l.target.label}${hideAmounts ? '' : `: ${inr(Math.round(l.value))}`}`,
      });
    });
  });

  const pct = (v) => (inflowAmt > 0 ? ` · ${Math.round((v / inflowAmt) * 100)}%` : '');

  const summary =
    inflowAmt > 0
      ? `Invested ${Math.round((investment / inflowAmt) * 100)}% · spent ${Math.round((expense / inflowAmt) * 100)}%${
          leftover > 0 ? ` · ${Math.round((leftover / inflowAmt) * 100)}% left` : ''
        }`
      : `${inr(outflow)} out, no inflow entered`;

  return (
    <CollapsibleSection id={id} title={title} className="money-flow-card" summary={summary}>
      <div className="money-flow-scroll">
        <svg
          className="money-flow-svg"
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="img"
          aria-label={`${title}: inflow ${inr(inflowAmt)}, investments ${inr(investment)}, expenses ${inr(expense)}`}
        >
          {paths.map((p) => (
            <path key={p.key} d={p.d} fill={p.color} className="money-flow-link">
              <title>{p.title}</title>
            </path>
          ))}
          {cols.map((col, ci) =>
            col.map((n) => (
              <g key={n.id}>
                <rect x={COLUMN_X[ci]} y={n.y} width={NODE_W} height={n.h} rx="2" fill={n.color} />
                <text
                  x={COLUMN_X[ci] + NODE_W + 6}
                  y={n.y + n.h / 2}
                  dominantBaseline="middle"
                  className="money-flow-label"
                >
                  <tspan className="money-flow-name">{n.label}</tspan>
                  <tspan className="money-flow-amount" dx="6">
                    {inr(Math.round(n.value))}
                    {ci > 0 ? pct(n.value) : ''}
                  </tspan>
                </text>
              </g>
            ))
          )}
        </svg>
      </div>
    </CollapsibleSection>
  );
}
