import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { SkeletonLine } from './Skeleton';

import { useFormatMoney } from '../utils/formatMoney';

function RecurringBanner({ year, month, refreshKey = 0, onApplied }) {
  const toast = useToast();
  const { inr } = useFormatMoney();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/recurring/pending', { params: { year, month } });
      setPending(res.data.pending || []);
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const applyAll = async () => {
    if (pending.length === 0) return;
    setApplying(true);
    try {
      const res = await api.post('/recurring/apply', { year, month, dryRun: false });
      const count = res.data.created?.length || 0;
      toast.success(count ? `Added ${count} recurring ${count === 1 ? 'entry' : 'entries'}` : 'Nothing new to add');
      await load();
      onApplied?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply recurring rules');
    } finally {
      setApplying(false);
    }
  };

  const copyFromPrevious = async () => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      'Copy all entries from the previous calendar month into this month? New rows will be created (not linked to recurring rules).'
    );
    if (!ok) return;
    setApplying(true);
    try {
      const res = await api.post('/recurring/copy-from-previous', { year, month });
      const count = res.data.count || res.data.created?.length || 0;
      if (count === 0) {
        toast.info('No entries in the previous month to copy');
      } else {
        toast.success(`Copied ${count} ${count === 1 ? 'entry' : 'entries'} from previous month`);
        onApplied?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Copy failed');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="card recurring-banner recurring-banner-loading">
        <SkeletonLine width="60%" />
      </div>
    );
  }

  return (
    <div className="card recurring-banner">
      <div className="recurring-banner-header">
        <button
          type="button"
          className="section-header-toggle recurring-banner-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="section-header-chevron">{expanded ? '▾' : '▸'}</span>
          <h3>Recurring &amp; quick fill</h3>
          {pending.length > 0 && (
            <span className="pill recurring-pending-pill">{pending.length} pending</span>
          )}
        </button>
        <div className="recurring-banner-actions">
          {pending.length > 0 && (
            <button type="button" className="primary-btn small" onClick={applyAll} disabled={applying}>
              {applying ? 'Adding…' : `Add ${pending.length} recurring`}
            </button>
          )}
          <button type="button" className="ghost-btn small" onClick={copyFromPrevious} disabled={applying}>
            Copy last month
          </button>
        </div>
      </div>
      {expanded && (
        <div className="recurring-banner-body">
          {pending.length === 0 ? (
            <p className="muted small">All active recurring rules are already applied this month, or none are set up.</p>
          ) : (
            <ul className="recurring-pending-list">
              {pending.map((p) => (
                <li key={p.ruleId} className="recurring-pending-row">
                  <span>{p.name}</span>
                  <span className="muted small">
                    {p.type} · {inr(p.amount)} · {p.category}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small recurring-banner-hint">
            Rules skip months where they were already added. Edit rules via Manage recurring in the header.
          </p>
        </div>
      )}
    </div>
  );
}

export default RecurringBanner;
