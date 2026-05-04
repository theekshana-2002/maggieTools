const express = require('express');
const router = express.Router();
const Vehicle = require('../models/Vehicle');
const Expense = require('../models/Expense');
const { authMiddleware, authorizeRoles } = require('../middleware/authMiddleware');

// Renewal logic for compliance documents
router.patch('/:id/renew', authMiddleware, authorizeRoles('Admin', 'Manager'), async (req, res) => {
  try {
    const { type, newExpirationDate, cost } = req.body;
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    // Update the relevant date based on type
    if (type === 'insurance') {
      vehicle.insuranceExpirationDate = newExpirationDate;
    } else if (type === 'license') {
      vehicle.licenseExpirationDate = newExpirationDate;
    } else if (type === 'safety') {
      vehicle.safetyExpirationDate = newExpirationDate;
    } else {
      return res.status(400).json({ message: 'Invalid renewal type' });
    }

    await vehicle.save();

    // Create an expense record if cost is provided
    if (cost > 0) {
      const expense = new Expense({
        date: new Date(),
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} Renewal - ${vehicle.number}`,
        amount: cost,
        category: 'Maintenance',
        vehicleId: vehicle._id,
        vehicleNumber: vehicle.number,
        note: `Auto-generated from renewal of ${type}`
      });
      await expense.save();
    }

    res.json({ message: 'Renewal successful', vehicle });
  } catch (err) {
    console.error('Renewal error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Get all vehicles with dynamic availability check
router.get('/', authMiddleware, async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ number: 1 });
    const Booking = require('../models/Booking');
    const now = new Date();

    const updatedVehicles = await Promise.all(vehicles.map(async (v) => {
      const activeBooking = await Booking.findOne({
        vehicle: v._id,
        status: { $in: ['Confirmed', 'Active'] },
        pickupDate: { $lte: now },
        returnDate: { $gte: now }
      });

      const vehicleObj = v.toObject();
      if (activeBooking) {
        vehicleObj.status = 'Booked';
        vehicleObj.currentBooking = activeBooking;
      }
      return vehicleObj;
    }));

    res.json(updatedVehicles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add new vehicle
router.post('/', authMiddleware, async (req, res) => {
  const vehicle = new Vehicle(req.body);
  try {
    const newVehicle = await vehicle.save();
    res.status(201).json(newVehicle);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update vehicle
router.put('/:id', authMiddleware, authorizeRoles('Admin', 'Manager'), async (req, res) => {
  try {
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedVehicle);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete vehicle
router.delete('/:id', authMiddleware, authorizeRoles('Admin', 'Manager'), async (req, res) => {
  try {
    await Vehicle.findByIdAndDelete(req.params.id);
    res.json({ message: 'Vehicle deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark / unmark a monthly lease payment
router.patch('/:id/lease-payment', authMiddleware, authorizeRoles('Admin', 'Manager'), async (req, res) => {
  try {
    const year  = Number(req.body.year);
    const month = Number(req.body.month);
    const paid  = Boolean(req.body.paid);

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    // Safely initialise the array if missing on older documents
    if (!Array.isArray(vehicle.leasePayments)) {
      vehicle.leasePayments = [];
    }

    // Find existing entry for this month/year (use Number coercion to be safe)
    const idx = vehicle.leasePayments.findIndex(
      lp => Number(lp.year) === year && Number(lp.month) === month
    );

    if (idx >= 0) {
      vehicle.leasePayments[idx].paid     = paid;
      vehicle.leasePayments[idx].paidDate = paid ? new Date() : null;
    } else {
      vehicle.leasePayments.push({ year, month, paid, paidDate: paid ? new Date() : null });
    }

    vehicle.markModified('leasePayments'); // ensure Mongoose detects nested array change
    await vehicle.save();
    res.json(vehicle);
  } catch (err) {
    console.error('Lease payment update error:', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
