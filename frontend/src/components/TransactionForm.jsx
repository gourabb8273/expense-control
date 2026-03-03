import { useState } from 'react';

function TransactionForm({ onCreated }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      await onCreated({
        type,
        amount: Number(amount),
        category,
        description,
        date,
      });
      setType('expense');
      setAmount('');
      setCategory('');
      setDescription('');
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
          <select value={type} onChange={(e) => setType(e.target.value)}>
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
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Gym, Trip, RD, FD, Housekeeping"
          />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short note for yourself"
          />
        </label>
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

