import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { shiftMonth } from '../utils/insights';

/**
 * Read-only: transactions for the `count` months before (year, month), newest first.
 * Each entry is { year, month, transactions }.
 */
export default function useMonthHistory(year, month, count = 6) {
  const key = `${year}-${month}-${count}`;
  const [state, setState] = useState({ key: null, history: [] });

  useEffect(() => {
    let cancelled = false;
    const periods = Array.from({ length: count }).map((_, i) => shiftMonth(year, month, -(i + 1)));
    Promise.all(
      periods.map((p) =>
        api
          .get('/transactions', { params: { month: p.month, year: p.year } })
          .then((res) => ({ ...p, transactions: res.data?.transactions || [] }))
          .catch(() => ({ ...p, transactions: [] }))
      )
    ).then((rows) => {
      if (cancelled) return;
      setState({ key: `${year}-${month}-${count}`, history: rows });
    });
    return () => {
      cancelled = true;
    };
  }, [year, month, count]);

  const loading = state.key !== key;
  return { history: loading ? [] : state.history, loading };
}
