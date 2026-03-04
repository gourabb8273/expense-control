const express = require('express');
const mongoose = require('mongoose');
const StaticCategory = require('../models/StaticCategory');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { userId: req.user.id };
    if (type === 'investment' || type === 'expense') filter.type = type;

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
    if (type !== 'investment' && type !== 'expense') {
      return res.status(400).json({ message: 'type must be investment or expense' });
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

    const category = await StaticCategory.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { name: name.trim() },
      { new: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });
    return res.json({ category });
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
