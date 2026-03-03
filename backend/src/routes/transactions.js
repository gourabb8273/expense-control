const express = require('express');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { userId: req.user.id };

    if (month && year) {
      const m = parseInt(month, 10) - 1;
      const y = parseInt(year, 10);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);
      filter.date = { $gte: start, $lt: end };
    }

    const transactions = await Transaction.find(filter).sort({ date: -1 });
    return res.json({ transactions });
  } catch (err) {
    console.error('List transactions error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;
    if (!type || !amount || !category || !date) {
      return res.status(400).json({ message: 'type, amount, category, and date are required' });
    }

    const tx = await Transaction.create({
      userId: req.user.id,
      type,
      amount,
      category,
      description: description || '',
      date: new Date(date),
    });

    return res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error('Create transaction error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, description, date } = req.body;

    if (!type || !amount || !category || !date) {
      return res.status(400).json({ message: 'type, amount, category, and date are required' });
    }

    const updated = await Transaction.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      {
        type,
        amount,
        category,
        description: description || '',
        date: new Date(date),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    return res.json({ transaction: updated });
  } catch (err) {
    console.error('Update transaction error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await Transaction.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!tx) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete transaction error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

