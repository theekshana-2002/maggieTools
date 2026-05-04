const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Check for Hardcoded Admin (Emergency/Initial Setup)
    if (username === 'admin' && password === 'admin@123') {
      const token = jwt.sign(
        { id: 'admin_id', username: 'admin', role: 'Admin', name: 'Master Admin' },
        process.env.JWT_SECRET || 'supersecretkey123',
        { expiresIn: '1d' }
      );
      return res.json({ 
        success: true, 
        token, 
        user: { username: 'admin', role: 'Admin', name: 'Master Admin' } 
      });
    }

    // 2. Check Database for Employee/Manager/Admin
    const user = await Employee.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'supersecretkey123',
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        role: user.role,
        name: user.name
      }
    });

  } catch (err) {
    console.error('Login Failure:', err);
    res.status(500).json({ 
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
});

module.exports = router;
