import { useMemo } from 'react';
import { usePrivacy } from '../context/PrivacyContext';

export const AMOUNT_MASK = '**';

export function formatInr(amount, hideAmounts, options = {}) {
  if (hideAmounts) return AMOUNT_MASK;
  const n = Number(amount) || 0;
  const abs = Math.abs(n).toLocaleString('en-IN');
  if (options.signed) {
    if (n === 0) return '₹0';
    return `${n >= 0 ? '+' : '-'}₹${abs}`;
  }
  if (options.noSymbol) return abs;
  return `₹${abs}`;
}

export function formatSignedInrDelta(amount, hideAmounts) {
  if (hideAmounts) return AMOUNT_MASK;
  const n = Number(amount) || 0;
  const arrow = n >= 0 ? '↑' : '↓';
  return `${arrow} ₹${Math.abs(n).toLocaleString('en-IN')}`;
}

export function formatCompactInr(value, hideAmounts) {
  if (hideAmounts) return AMOUNT_MASK;
  const n = Math.abs(Number(value) || 0);
  const sign = Number(value) < 0 ? '-' : '';
  if (n >= 1e7) return `${sign}₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${sign}₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${sign}₹${(n / 1e3).toFixed(0)}k`;
  if (n === 0) return '₹0';
  return `${sign}₹${Math.round(n)}`;
}

export function chartTooltipInr(value, hideAmounts, prefix = '') {
  if (hideAmounts) {
    const trimmed = prefix.trim();
    return trimmed ? `${trimmed} ${AMOUNT_MASK}` : AMOUNT_MASK;
  }
  return `${prefix}₹${Number(value).toLocaleString('en-IN')}`;
}

export function useFormatMoney() {
  const { hideAmounts } = usePrivacy();
  return useMemo(
    () => ({
      hideAmounts,
      mask: AMOUNT_MASK,
      inr: (amount, opts) => formatInr(amount, hideAmounts, opts),
      signed: (amount) => formatInr(amount, hideAmounts, { signed: true }),
      delta: (amount) => formatSignedInrDelta(amount, hideAmounts),
      compact: (value) => formatCompactInr(value, hideAmounts),
      chartLabel: (value, prefix = '') => chartTooltipInr(value, hideAmounts, prefix),
    }),
    [hideAmounts]
  );
}
