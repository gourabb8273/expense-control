import { useState, useMemo } from 'react';

function TransactionForm({ onCreated, staticCategories = [] }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseEssential, setExpenseEssential] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categoriesForType = useMemo(
    () => staticCategories.filter((c) => c.type === type).map((c) => c.name),
    [staticCategories, type]
  );
  const tagOptions = useMemo(
    () => staticCategories.filter((c) => c.type === type),
    [staticCategories, type]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!category) {
      setError('Please enter a category.');
      return;
    }
    if (!date) {
      setError('Please pick a date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        type,
        amount: Number(amount),
        category,
        tag: tag || undefined,
        description,
        date,
      };
      if (type === 'expense' && (expenseEssential === 'essential' || expenseEssential === 'nonessential')) {
        payload.expenseEssential = expenseEssential;
      }
      await onCreated(payload);
      setType('expense');
      setAmount('');
      setCategory('');
      setTag('');
      setDescription('');
      setExpenseEssential('');
      setDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      setError(err.message || 'Could not save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card transaction-form">
      <h2>Add entry</h2>
      <p className="muted">Fill and save in one go.</p>

      <div className="step">
        <label className="field inline">
          <span>Type</span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              if (e.target.value !== 'expense') setExpenseEssential('');
            }}
          >
            <option value="expense">Expense</option>
            <option value="investment">Investment</option>
          </select>
        </label>
        <label className="field">
          <span>Amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 2000"
          />
        </label>
        <label className="field">
          <span>Category</span>
          <input
            list={`category-list-${type}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={type === 'investment' ? 'e.g. RD, FD, ETF or type custom' : 'e.g. Loan, Rent, Gym or type custom'}
          />
          {categoriesForType.length > 0 && (
            <datalist id={`category-list-${type}`}>
              {categoriesForType.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
        </label>
        <label className="field">
          <span>Tag (optional)</span>
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">— None —</option>
            {tagOptions.map((c) => (
              <option key={c._id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <span className="field-hint">Pick a tag from Manage categories for pie charts by tag.</span>
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short note for yourself"
          />
        </label>
        {type === 'expense' && (
          <label className="field">
            <span>Essential? (optional)</span>
            <select
              value={expenseEssential}
              onChange={(e) => setExpenseEssential(e.target.value)}
            >
              <option value="">— Not set —</option>
              <option value="essential">Essential (e.g. rent, bills)</option>
              <option value="nonessential">Non-essential</option>
            </select>
            <span className="field-hint">Used for essential vs non-essential expense charts.</span>
          </label>
        )}
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="form-footer">
        <div className="actions">
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default TransactionForm;

