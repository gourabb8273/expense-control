const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Cashflow = require('../models/Cashflow');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = { sub: user._id.toString(), email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', {
      expiresIn: '365d',
    });

    const lastKnownSalary = await Cashflow.getLastKnownSalary(user._id);
    const defaultMonthlySalary = user.defaultMonthlySalary || 0;

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        defaultMonthlySalary,
        suggestedDefaultSalary: defaultMonthlySalary || lastKnownSalary || 0,
        lastKnownSalary,
      },
    });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/seed-demo-user', async (req, res) => {
  try {
    const email = process.env.DEMO_USER_EMAIL;
    const password = process.env.DEMO_USER_PASSWORD;

    if (!email || !password) {
      return res.status(400).json({ message: 'DEMO_USER_EMAIL and DEMO_USER_PASSWORD must be set in env' });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({
        email: email.toLowerCase().trim(),
        passwordHash,
        name: 'Demo User',
      });
    }

    return res.json({
      message: 'Demo user ready',
      email: user.email,
    });
  } catch (err) {
    console.error('Seed demo user error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Creates a second demo user: username "demo", password "demo". Safe to call multiple times (idempotent).
router.post('/seed-demo2-user', async (req, res) => {
  try {
    const email = 'demo';
    const password = 'demo';

    let user = await User.findOne({ email });
    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({
        email,
        passwordHash,
        name: 'Demo',
      });
    }

    return res.json({
      message: 'Demo2 user ready',
      email: user.email,
    });
  } catch (err) {
    console.error('Seed demo2 user error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const [user, lastKnownSalary] = await Promise.all([
      User.findById(req.user.id).select('-passwordHash'),
      Cashflow.getLastKnownSalary(userId),
    ]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const defaultMonthlySalary = user.defaultMonthlySalary || 0;
    return res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        defaultMonthlySalary,
        suggestedDefaultSalary: defaultMonthlySalary || lastKnownSalary || 0,
        lastKnownSalary,
      },
    });
  } catch (err) {
    console.error('Get profile error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/me', auth, async (req, res) => {
  try {
    const { defaultMonthlySalary } = req.body;
    if (defaultMonthlySalary == null) {
      return res.status(400).json({ message: 'defaultMonthlySalary is required' });
    }
    const val = Number(defaultMonthlySalary);
    if (Number.isNaN(val) || val < 0) {
      return res.status(400).json({ message: 'Invalid defaultMonthlySalary' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { defaultMonthlySalary: val },
      { new: true }
    ).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        defaultMonthlySalary: user.defaultMonthlySalary || 0,
      },
    });
  } catch (err) {
    console.error('Update profile error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

