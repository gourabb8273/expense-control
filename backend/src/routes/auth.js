const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

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

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
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

module.exports = router;

