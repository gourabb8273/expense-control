const express = require('express');
const mongoose = require('mongoose');
const StaticCategory = require('../models/StaticCategory');
const BalanceSheet = require('../models/BalanceSheet');
const Transaction = require('../models/Transaction');
const RecurringRule = require('../models/RecurringRule');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

async function cascadeTagRename(userId, type, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;

  const uid = new mongoose.Types.ObjectId(userId);

  if (type === 'asset') {
    await BalanceSheet.updateMany(
      { userId: uid, 'assets.tag': oldName },
      { $set: { 'assets.$[elem].tag': newName } },
      { arrayFilters: [{ 'elem.tag': oldName }] }
    );
  } else if (type === 'debt') {
    await BalanceSheet.updateMany(
      { userId: uid, 'debts.tag': oldName },
      { $set: { 'debts.$[elem].tag': newName } },
      { arrayFilters: [{ 'elem.tag': oldName }] }
    );
  } else if (type === 'investment' || type === 'expense') {
    await Transaction.updateMany(
      { userId: uid, type, tag: oldName },
      { $set: { tag: newName } }
    );
    await RecurringRule.updateMany(
      { userId: uid, type, tag: oldName },
      { $set: { tag: newName } }
    );
  }
}

router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { userId: req.user.id };
    if (type === 'investment' || type === 'expense' || type === 'asset' || type === 'debt') {
      filter.type = type;
    }

    const list = await StaticCategory.find(filter).sort({ type: 1, order: 1, name: 1 });
    return res.json({ categories: list });
  } catch (err) {
    console.error('List categories error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { type, name } = req.body;
    if (!type || !name || !name.trim()) {
      return res.status(400).json({ message: 'type and name are required' });
    }
    if (!['investment', 'expense', 'asset', 'debt'].includes(type)) {
      return res.status(400).json({
        message: 'type must be investment, expense, asset, or debt',
      });
    }

    const category = await StaticCategory.create({
      userId: req.user.id,
      type,
      name: name.trim(),
    });
    return res.status(201).json({ category });
  } catch (err) {
    console.error('Create category error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    const existing = await StaticCategory.findOne({ _id: id, userId: req.user.id });
    if (!existing) return res.status(404).json({ message: 'Category not found' });

    const oldName = existing.name;
    const trimmed = name.trim();

    const category = await StaticCategory.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { name: trimmed },
      { new: true }
    );

    await cascadeTagRename(req.user.id, existing.type, oldName, trimmed);

    return res.json({ category, renamedFrom: oldName !== trimmed ? oldName : undefined });
  } catch (err) {
    console.error('Update category error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await StaticCategory.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete category error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
