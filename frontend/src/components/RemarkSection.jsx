import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function previewText(text, max = 72) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

function MonthRemarkSection({ year, month }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const skipSaveRef = useRef(false);
  const saveTimerRef = useRef(null);
  const userEditedRef = useRef(false);

  const monthLabel = MONTH_NAMES[month] || month;

  const persist = useCallback(
    async (value) => {
      try {
        await api.put('/remarks', { year, month, text: value });
      } catch (err) {
        console.error('Failed to save remark', err);
      }
    },
    [year, month]
  );

  const scheduleSave = useCallback(
    (value) => {
      if (!userEditedRef.current || skipSaveRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persist(value), 500);
    },
    [persist]
  );

  useEffect(() => {
    setExpanded(false);
  }, [year, month]);

  useEffect(() => {
    let cancelled = false;
    skipSaveRef.current = true;
    userEditedRef.current = false;
    setLoading(true);
    api
      .get('/remarks', { params: { year, month } })
      .then((res) => {
        if (!cancelled) setText(res.data?.text || '');
      })
      .catch(() => {
        if (!cancelled) setText('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        setTimeout(() => {
          skipSaveRef.current = false;
        }, 0);
      });
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [year, month]);

  const handleChange = (e) => {
    userEditedRef.current = true;
    const value = e.target.value;
    setText(value);
    scheduleSave(value);
  };

  const handleBlur = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (userEditedRef.current && !skipSaveRef.current) persist(text);
  };

  const trimmed = text.trim();
  const collapsedPreview = previewText(trimmed);

  return (
    <div className="card remark-section">
      <div className="remark-header">
        <button
          type="button"
          className="section-header-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="section-header-chevron" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          <h2>Remark · {monthLabel} {year}</h2>
          {!expanded && collapsedPreview && (
            <span className="remark-collapsed-preview" title={trimmed}>
              {collapsedPreview}
            </span>
          )}
        </button>
      </div>
      {expanded && (
        <>
          <p className="muted small remark-hint">
            Optional — jot down anything notable for this month (bonus, big purchase, goal, etc.).
          </p>
          {loading ? (
            <p className="muted small">Loading…</p>
          ) : (
            <textarea
              className="remark-textarea"
              rows={4}
              placeholder={`Remark for ${monthLabel} ${year}…`}
              value={text}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          )}
        </>
      )}
    </div>
  );
}

function YearRemarksSection({ year }) {
  const [yearText, setYearText] = useState('');
  const [monthTexts, setMonthTexts] = useState(() => Array(12).fill(''));
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [monthNotesExpanded, setMonthNotesExpanded] = useState(false);
  const skipSaveRef = useRef(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    setExpanded(false);
    setMonthNotesExpanded(false);
  }, [year]);

  const load = useCallback(async () => {
    skipSaveRef.current = true;
    setLoading(true);
    try {
      const res = await api.get('/remarks/year', { params: { year } });
      setYearText(res.data?.yearText || '');
      const months = Array.isArray(res.data?.months) ? res.data.months : [];
      setMonthTexts([...months, ...Array(12).fill('')].slice(0, 12));
    } catch {
      setYearText('');
      setMonthTexts(Array(12).fill(''));
    } finally {
      setLoading(false);
      setTimeout(() => {
        skipSaveRef.current = false;
      }, 0);
    }
  }, [year]);

  useEffect(() => {
    load();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [load]);

  const persistYear = async (text) => {
    try {
      await api.put('/remarks', { year, month: 0, text });
    } catch (err) {
      console.error('Failed to save remark', err);
    }
  };

  const scheduleYearSave = (text) => {
    if (skipSaveRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistYear(text), 500);
  };

  const handleYearChange = (e) => {
    const value = e.target.value;
    setYearText(value);
    scheduleYearSave(value);
  };

  const now = new Date();
  const endMonth = year > now.getFullYear() ? 0 : year < now.getFullYear() ? 12 : now.getMonth() + 1;
  const monthsWithNotes = monthTexts
    .map((t, idx) => ({ month: idx + 1, text: (t || '').trim() }))
    .filter((row) => row.month <= endMonth && row.text);

  const hasYearNote = Boolean(yearText.trim());
  const hasAny = hasYearNote || monthsWithNotes.length > 0;

  return (
    <div className="card remark-section">
      <div className="remark-header">
        <button
          type="button"
          className="section-header-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="section-header-chevron" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          <h2>Remarks · {year}</h2>
          {!expanded && hasAny && (
            <span className="pill section-header-summary">
              {monthsWithNotes.length + (hasYearNote ? 1 : 0)} note(s)
            </span>
          )}
        </button>
      </div>
      {expanded && (
        <>
          <p className="muted small remark-hint">
            Year summary saves here. Add or edit month notes in each month&apos;s view.
          </p>
          {loading ? (
            <p className="muted small">Loading…</p>
          ) : (
            <>
              <label className="remark-field-label">
                <span>Year remark</span>
                <textarea
                  className="remark-textarea"
                  rows={3}
                  placeholder={`Overall note for ${year}…`}
                  value={yearText}
                  onChange={handleYearChange}
                  onBlur={() => persistYear(yearText)}
                />
              </label>

              {monthsWithNotes.length > 0 && (
                <div className="remark-month-notes-block">
                  <button
                    type="button"
                    className="section-header-toggle remark-sub-toggle"
                    onClick={() => setMonthNotesExpanded((v) => !v)}
                    aria-expanded={monthNotesExpanded}
                  >
                    <span className="section-header-chevron" aria-hidden="true">
                      {monthNotesExpanded ? '▾' : '▸'}
                    </span>
                    <span className="remark-sub-toggle-label">
                      Month notes
                    </span>
                    <span className="pill section-header-summary">
                      {monthsWithNotes.length}
                    </span>
                  </button>
                  {monthNotesExpanded && (
                    <ul className="remark-month-notes">
                      {monthsWithNotes.map(({ month, text }) => (
                        <li key={month} className="remark-month-note">
                          <span className="remark-month-badge">{MONTH_NAMES[month]}</span>
                          <p className="remark-month-message">{text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export { MonthRemarkSection, YearRemarksSection };
