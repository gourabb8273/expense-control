import { aggregateByTag } from './aggregateByTag';
import {
  buildActualEntriesFromTransactions,
  matchPlanItemsToActuals,
  normalizeAllocationKey,
} from './allocationMatching';

const TOLERANCE_PCT = 0.02;
const TOLERANCE_ABS = 100;

export function diffStatus(planned, actual) {
  const p = Number(planned) || 0;
  const a = Number(actual) || 0;
  const diff = a - p;

  if (p <= 0 && a <= 0) return 'neutral';
  if (p <= 0 && a > 0) return 'over';

  const tolerance = Math.max(TOLERANCE_ABS, p * TOLERANCE_PCT);
  if (Math.abs(diff) <= tolerance) return 'on-track';
  if (diff < 0) return 'under';
  return 'over';
}

function tagKey(tag) {
  const t = String(tag || '').trim();
  return t || 'Untagged';
}

export function computePortfolioAlignment(planItems, monthSummary, transactions = []) {
  const items = (planItems || []).filter(
    (i) => (i.name || '').trim() && (Number(i.amount) || 0) > 0
  );

  const totalPlanned = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalActual = Number(monthSummary?.totalInvestment) || 0;
  const totalDiff = totalActual - totalPlanned;

  const actualEntries = buildActualEntriesFromTransactions(transactions);
  const actualByCategory = new Map();
  actualEntries.forEach((row) => {
    actualByCategory.set(row.key, row);
  });

  if (actualEntries.length === 0) {
    (monthSummary?.investmentCategories || []).forEach((row) => {
      const key = normalizeAllocationKey(row.category);
      if (!key) return;
      actualByCategory.set(key, {
        category: row.category,
        tag: '',
        total: Number(row.total) || 0,
        key,
      });
    });
  }

  const { planMatches, usedActualKeys } = matchPlanItemsToActuals(items, [
    ...actualByCategory.values(),
  ]);

  const byAllocation = items.map((item, planIndex) => {
    const planned = Number(item.amount) || 0;
    const match = planMatches.get(planIndex) || { total: 0, categories: [] };
    const actual = match.total || 0;

    return {
      name: item.name,
      tag: item.tag || '',
      platform: item.platform || '',
      planned,
      actual,
      diff: actual - planned,
      status: diffStatus(planned, actual),
      matchedCategories: match.categories,
    };
  });

  const unmappedActual = [];
  actualByCategory.forEach((row, key) => {
    if (usedActualKeys.has(key)) return;
    const actual = Number(row.total) || 0;
    if (actual <= 0) return;
    unmappedActual.push({
      name: row.category,
      actual,
      status: 'over',
    });
  });
  unmappedActual.sort((a, b) => b.actual - a.actual);

  const plannedByTag = aggregateByTag(
    items.map((i) => ({ name: i.name, tag: i.tag, value: i.amount }))
  );
  const plannedTagMap = new Map(plannedByTag.map((r) => [tagKey(r.tag), Number(r.value) || 0]));

  const actualTagMap = new Map();
  (monthSummary?.investmentByTag || []).forEach((row) => {
    const key = tagKey(row.tag);
    actualTagMap.set(key, (actualTagMap.get(key) || 0) + (Number(row.total) || 0));
  });

  const allTags = new Set([...plannedTagMap.keys(), ...actualTagMap.keys()]);
  const byTag = Array.from(allTags)
    .map((tag) => {
      const planned = plannedTagMap.get(tag) || 0;
      const actual = actualTagMap.get(tag) || 0;
      return {
        tag,
        planned,
        actual,
        diff: actual - planned,
        status: diffStatus(planned, actual),
      };
    })
    .filter((row) => row.planned > 0 || row.actual > 0)
    .sort((a, b) => Math.max(b.planned, b.actual) - Math.max(a.planned, a.actual));

  const pctOfPlan =
    totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 1000) / 10 : null;

  return {
    hasPlan: items.length > 0,
    totalPlanned,
    totalActual,
    totalDiff,
    pctOfPlan,
    overallStatus: diffStatus(totalPlanned, totalActual),
    byTag,
    byAllocation,
    unmappedActual,
  };
}

export function alignmentStatusLabel(status) {
  switch (status) {
    case 'on-track':
      return 'On track';
    case 'under':
      return 'Under plan';
    case 'over':
      return 'Over plan';
    default:
      return 'No data';
  }
}

export function formatAlignmentDiff(diff, signed) {
  const d = Number(diff) || 0;
  if (d === 0) return 'On plan';
  if (d < 0) return `${signed(Math.abs(d))} under`;
  return `${signed(d)} over`;
}
