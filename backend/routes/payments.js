const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const { authMiddleware, authorizeRoles } = require('../middleware/authMiddleware');

// Helper to sync back to source
async function syncBackToSource(payment) {
    if (payment.bookingId) {
        await Booking.findByIdAndUpdate(payment.bookingId, {
            advancePayment: payment.takenAmount,
            balanceAmount: payment.hireAmount - payment.takenAmount
        });
    }
    if (payment.invoiceId) {
        await Invoice.findByIdAndUpdate(payment.invoiceId, {
            advancePayment: payment.takenAmount
        });
    }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const records = await Payment.find().sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authMiddleware, authorizeRoles('Admin', 'Manager'), async (req, res) => {
  const record = new Payment(req.body);
  try {
    const newRecord = await record.save();
    await syncBackToSource(newRecord);
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', authMiddleware, authorizeRoles('Admin', 'Manager'), async (req, res) => {
  try {
    const updated = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (updated) await syncBackToSource(updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authMiddleware, authorizeRoles('Admin', 'Manager'), async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
