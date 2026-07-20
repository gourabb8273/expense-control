/** Premium palette for allocation-level charts (jewel / fintech tones). */
export const PREMIUM_ITEM_COLORS = [
  '#6366F1',
  '#14B8A6',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#10B981',
  '#F97316',
  '#3B82F6',
  '#A855F7',
  '#EAB308',
  '#64748B',
];

/** Softer group-level accents for bars and tags. */
export const PREMIUM_GROUP_COLORS = [
  '#818CF8',
  '#2DD4BF',
  '#FBBF24',
  '#F472B6',
  '#A78BFA',
  '#38BDF8',
  '#4ADE80',
  '#FB923C',
];

export function itemColor(index) {
  return PREMIUM_ITEM_COLORS[index % PREMIUM_ITEM_COLORS.length];
}

export function groupColor(index) {
  return PREMIUM_GROUP_COLORS[index % PREMIUM_GROUP_COLORS.length];
}
