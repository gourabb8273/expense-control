/**
 * Format value as a share of total for breakdown lists and chart tooltips.
 * Whole numbers when >= 1%; one decimal when 0.1%–0.99%; "<0.1" when smaller but non-zero.
 */
export function formatSharePct(value, total) {
  const v = Number(value) || 0;
  const t = Number(total) || 0;
  if (!t || t <= 0 || v <= 0) return '0';
  const pct = (v / t) * 100;
  if (pct >= 1) return String(Math.round(pct));
  const oneDec = Math.round(pct * 10) / 10;
  if (oneDec >= 0.1) return oneDec.toFixed(1);
  return '<0.1';
}
