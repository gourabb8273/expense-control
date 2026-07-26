/**
 * Fuzzy matching between portfolio plan allocation names and transaction categories.
 * Also supports tag-bucket matching (e.g. JSW tagged "Stock" -> plan line "Stock").
 */

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'bank',
  'cap',
  'e',
  'eg',
  'etf',
  'etfs',
  'flexi',
  'fund',
  'funds',
  'g',
  'index',
  'india',
  'mf',
  'of',
  'opportunities',
  'or',
  'short',
  'term',
  'the',
  'us',
]);

const MIN_NAME_MATCH_SCORE = 0.42;
const TAG_BUCKET_MATCH_SCORE = 0.82;

export function normalizeAllocationKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[/_·,]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTag(tag) {
  return normalizeAllocationKey(tag);
}

function stripParentheticals(text) {
  const tickers = [];
  const cleaned = text.replace(/\([^)]*\)/g, (segment) => {
    segment
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .forEach((part) => {
        const t = part.replace(/[^a-z0-9]/gi, '').toLowerCase();
        if (t.length >= 2 && t.length <= 6 && /^[a-z0-9]+$/.test(t)) {
          tickers.push(t);
        }
      });
    return ' ';
  });
  return { cleaned, tickers };
}

function leadingTicker(text) {
  const m = text.match(/^([a-z0-9]{2,6})\b/i);
  return m ? m[1].toLowerCase() : null;
}

export function tokenizeAllocationName(name) {
  const normalized = normalizeAllocationKey(name);
  const { cleaned, tickers } = stripParentheticals(normalized);
  const head = leadingTicker(cleaned);
  if (head) tickers.push(head);

  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));

  return {
    normalized,
    compact: cleaned.replace(/\s+/g, ''),
    tokens: [...new Set(tokens)],
    tickers: [...new Set(tickers)],
  };
}

function tokenMatches(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

function tokenOverlap(planTokens, actualTokens) {
  if (!planTokens.length || !actualTokens.length) return { score: 0, matched: 0 };

  let matched = 0;
  const matchedActual = new Set();

  planTokens.forEach((pt) => {
    actualTokens.forEach((at, idx) => {
      if (matchedActual.has(idx)) return;
      if (tokenMatches(pt, at)) {
        matched += 1;
        matchedActual.add(idx);
      }
    });
  });

  const union = new Set([...planTokens, ...actualTokens]).size;
  const jaccard = union > 0 ? matched / union : 0;
  const actualCoverage = matched / actualTokens.length;
  const planCoverage = matched / planTokens.length;

  let score = jaccard;
  if (actualCoverage === 1) {
    score = Math.max(score, 0.72 + Math.min(actualTokens.length, 3) * 0.06);
  }
  if (planCoverage >= 0.5 && actualCoverage >= 0.5) {
    score = Math.max(score, (planCoverage + actualCoverage) / 2);
  }

  return { score, matched };
}

export function computeAllocationMatchScore(planName, actualName, planTag = '', actualTag = '') {
  const plan = tokenizeAllocationName(planName);
  const actual = tokenizeAllocationName(actualName);

  if (!plan.normalized || !actual.normalized) return 0;

  if (plan.normalized === actual.normalized) return 1;

  if (plan.compact === actual.compact) return 0.98;

  if (plan.compact.includes(actual.compact) || actual.compact.includes(plan.compact)) {
    const shorter = Math.min(plan.compact.length, actual.compact.length);
    const longer = Math.max(plan.compact.length, actual.compact.length);
    if (shorter >= 3 && shorter / longer >= 0.35) {
      return 0.88;
    }
  }

  const sharedTicker = plan.tickers.find((t) => actual.tickers.includes(t));
  if (sharedTicker) return 0.95;

  if (plan.tickers.includes(actual.normalized) || actual.tickers.includes(plan.normalized)) {
    return 0.92;
  }

  const actualTagNorm = normalizeTag(actualTag);
  const planNameNorm = plan.normalized;
  if (actualTagNorm && actualTagNorm === planNameNorm) {
    return 0.86;
  }

  const { score: overlapScore } = tokenOverlap(plan.tokens, actual.tokens);
  let score = overlapScore;

  const pt = normalizeTag(planTag);
  if (pt && actualTagNorm && pt === actualTagNorm && score >= 0.25) {
    score = Math.min(1, score + 0.08);
  }

  return score;
}

export function buildActualEntriesFromTransactions(transactions) {
  const map = new Map();

  (transactions || [])
    .filter((tx) => tx.type === 'investment')
    .forEach((tx) => {
      const category = String(tx.category || '').trim();
      const key = normalizeAllocationKey(category);
      if (!key) return;

      const amount = Number(tx.amount) || 0;
      if (amount <= 0) return;

      if (!map.has(key)) {
        map.set(key, {
          category,
          tag: String(tx.tag || '').trim(),
          total: 0,
          key,
        });
      }

      const row = map.get(key);
      row.total += amount;
      if (tx.tag && !row.tag) row.tag = String(tx.tag).trim();
    });

  return Array.from(map.values()).filter((row) => row.total > 0);
}

function emptyPlanMatch() {
  return { total: 0, categories: [], matchScore: 0, matchType: null };
}

function addActualToPlanMatch(match, actual, matchType, score) {
  return {
    total: match.total + actual.total,
    categories: [...match.categories, { category: actual.category, total: actual.total }],
    matchScore: Math.max(match.matchScore, score),
    matchType: match.matchType || matchType,
  };
}

/**
 * Match plan lines to actual investments:
 * 1) fuzzy category name (one category per plan line)
 * 2) tag bucket — actual.tag matches plan.name (e.g. JSW #Stock -> plan "Stock")
 */
export function matchPlanItemsToActuals(planItems, actualEntries) {
  const actuals = (actualEntries || []).filter((row) => row.key && row.total > 0);

  const planMatches = new Map();
  planItems.forEach((_, planIndex) => {
    planMatches.set(planIndex, emptyPlanMatch());
  });

  const usedActualKeys = new Set();

  const nameCandidates = [];
  planItems.forEach((plan, planIndex) => {
    actuals.forEach((actual) => {
      const score = computeAllocationMatchScore(
        plan.name,
        actual.category,
        plan.tag,
        actual.tag
      );
      if (score >= MIN_NAME_MATCH_SCORE) {
        nameCandidates.push({ planIndex, actualKey: actual.key, score });
      }
    });
  });

  nameCandidates.sort((a, b) => b.score - a.score);

  nameCandidates.forEach(({ planIndex, actualKey, score }) => {
    if (usedActualKeys.has(actualKey)) return;
    const existing = planMatches.get(planIndex);
    if (existing.categories.length > 0) return;

    const actual = actuals.find((a) => a.key === actualKey);
    if (!actual) return;

    usedActualKeys.add(actualKey);
    planMatches.set(planIndex, addActualToPlanMatch(existing, actual, 'name', score));
  });

  const planIndexByName = new Map();
  planItems.forEach((plan, planIndex) => {
    const nameKey = normalizeAllocationKey(plan.name);
    if (nameKey) planIndexByName.set(nameKey, planIndex);
  });

  actuals.forEach((actual) => {
    if (usedActualKeys.has(actual.key)) return;

    const actualTag = normalizeTag(actual.tag);
    if (!actualTag) return;

    const planIndex = planIndexByName.get(actualTag);
    if (planIndex === undefined) return;

    const plan = planItems[planIndex];
    const planName = normalizeAllocationKey(plan.name);
    if (planName !== actualTag) return;

    usedActualKeys.add(actual.key);
    const existing = planMatches.get(planIndex);
    planMatches.set(
      planIndex,
      addActualToPlanMatch(existing, actual, 'tag', TAG_BUCKET_MATCH_SCORE)
    );
  });

  return { planMatches, usedActualKeys };
}

/** @deprecated use matchPlanItemsToActuals */
export function matchPlanItemsToCategories(planItems, investmentCategories) {
  const actualEntries = (investmentCategories || []).map((row) => ({
    category: row.category,
    tag: '',
    total: Number(row.total) || 0,
    key: normalizeAllocationKey(row.category),
  }));

  const { planMatches, usedActualKeys } = matchPlanItemsToActuals(planItems, actualEntries);

  const planToActual = new Map();
  planMatches.forEach((match, planIndex) => {
    if (match.categories.length === 0) return;
    const primary = match.categories[0];
    planToActual.set(planIndex, {
      category: primary.category,
      total: match.total,
      key: normalizeAllocationKey(primary.category),
      matchScore: match.matchScore,
    });
  });

  return { planToActual, usedActualKeys };
}
