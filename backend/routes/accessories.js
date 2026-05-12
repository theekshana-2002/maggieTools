const express = require('express');
const router = express.Router();
const Accessory = require('../models/Accessory');
const { authMiddleware } = require('../middleware/authMiddleware');

// Get all accessories
router.get('/', authMiddleware, async (req, res) => {
  try {
    const accessories = await Accessory.find().sort({ name: 1 });
    res.json(accessories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add new accessory
router.post('/', authMiddleware, async (req, res) => {
  const accessory = new Accessory(req.body);
  try {
    console.log('POST /api/accessories - Body:', req.body);
    const newAccessory = await accessory.save();
    console.log('Accessory Saved:', newAccessory._id);
    res.status(201).json(newAccessory);
  } catch (err) {
    console.error('POST /api/accessories - Error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update accessory
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await Accessory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete accessory
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Accessory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Accessory deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
