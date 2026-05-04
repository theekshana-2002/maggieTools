const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const { authMiddleware } = require('../middleware/authMiddleware');

async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

// Get all bookings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find().populate('vehicle').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Check vehicle availability
router.get('/check-availability', authMiddleware, async (req, res) => {
  const { pickupDate, returnDate, vehicleId } = req.query;
  try {
    const start = new Date(pickupDate);
    const end = new Date(returnDate);

    const overlapping = await Booking.findOne({
      vehicle: vehicleId,
      status: { $ne: 'Cancelled' },
      $or: [
        { pickupDate: { $lt: end }, returnDate: { $gt: start } }
      ]
    });

    res.json({ available: !overlapping });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get available vehicles for a date range
router.get('/available-vehicles', authMiddleware, async (req, res) => {
  const { pickupDate, returnDate } = req.query;
  try {
    const start = new Date(pickupDate);
    const end = new Date(returnDate);

    // Get IDs of vehicles already booked in this range
    const bookedVehicles = await Booking.find({
      status: { $ne: 'Cancelled' },
      $or: [
        { pickupDate: { $lt: end }, returnDate: { $gt: start } }
      ]
    }).distinct('vehicle');

    // Find vehicles not in the booked list
    const availableVehicles = await Vehicle.find({
      _id: { $nin: bookedVehicles },
      status: 'Available'
    });

    res.json(availableVehicles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new booking
router.post('/', authMiddleware, async (req, res) => {
  const { vehicle, pickupDate, returnDate } = req.body;
  
  try {
    // Double check availability
    const start = new Date(pickupDate);
    const end = new Date(returnDate);
    const overlapping = await Booking.findOne({
      vehicle,
      status: { $ne: 'Cancelled' },
      $or: [
        { pickupDate: { $lt: end }, returnDate: { $gt: start } }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ message: 'Vehicle is already booked for these dates' });
    }

    const bookingSeq = await getNextSequence('bookingId');
    const bookingId = `BK-${bookingSeq.toString().padStart(4, '0')}`;

    const booking = new Booking(req.body);
    booking.bookingId = bookingId;
    console.log('RAXWO Debug: Attempting to save booking:', bookingId);
    const newBooking = await booking.save();
    console.log('✅ RAXWO Debug: Booking saved successfully:', newBooking._id);

    // Auto-generate invoice
    try {
      const seq = await getNextSequence('invoiceNo');
      const year = new Date().getFullYear().toString().slice(-2);
      const invoiceNo = `INV-${year}-${seq.toString().padStart(4, '0')}`;
      
      const v = await Vehicle.findById(vehicle);

      const invoiceData = {
        invoiceNo,
        date: new Date(),
        clientName: req.body.clientName,
        vehicleNo: v ? v.number : 'Unknown',
        vehicleType: v ? v.category : 'Car',
        jobDescription: `Vehicle Rental: ${new Date(pickupDate).toLocaleDateString()} - ${new Date(returnDate).toLocaleDateString()}`,
        totalUnits: req.body.totalDays || 1,
        unitType: 'Days',
        ratePerUnit: req.body.dailyRate || 0,
        subtotal: req.body.totalAmount || 0,
        totalAmount: req.body.totalAmount || 0,
        status: 'Draft',
        bookingId: newBooking._id,
        remarks: `Auto-generated from booking BK-${newBooking._id.toString().slice(-4).toUpperCase()}`
      };

      console.log('RAXWO Debug: Creating auto-invoice with data:', invoiceData);
      const newInvoice = new Invoice(invoiceData);
      await newInvoice.save();
      console.log('✅ RAXWO Debug: Auto-invoice created:', invoiceNo);
    } catch (invErr) {
      console.error('❌ RAXWO Debug: Failed to auto-generate invoice:', invErr);
    }

    // ─── Auto-save/update Client in Client List ───────────────────────────
    console.log('RAXWO Debug: Starting Client sync for:', newBooking.clientName);
    try {
      const targetName = (newBooking.clientName || '').trim();
      if (targetName) {
        const existingClient = await Client.findOne({
          name: { $regex: new RegExp(`^${targetName}$`, 'i') }
        });
        if (existingClient) {
          existingClient.totalHires = (existingClient.totalHires || 0) + 1;
          if (newBooking.clientPhone) existingClient.contact = newBooking.clientPhone;
          await existingClient.save();
          console.log('✅ RAXWO: Updated existing client:', existingClient.name);
        } else {
          const newClient = new Client({
            name: targetName,
            contact: newBooking.clientPhone || '',
            totalHires: 1,
            outstanding: newBooking.balanceAmount || 0,
            status: 'Active'
          });
          await newClient.save();
          console.log('✅ RAXWO: New client auto-saved:', newClient.name);
        }
      }
    } catch (clientErr) {
      console.error('❌ RAXWO: Failed to auto-save client:', clientErr.message);
    }

    // ─── Auto-create Payment record (advance) ────────────────────────────
    console.log('RAXWO Debug: Starting Payment sync. Advance:', newBooking.advancePayment);
    try {
      const advAmt = parseFloat(newBooking.advancePayment) || 0;
      const totalAmt = parseFloat(newBooking.totalAmount) || 0;
      const balAmt = totalAmt - advAmt;
      const payStatus = advAmt >= totalAmt ? 'Paid' : advAmt > 0 ? 'Partial' : 'Pending';

      // Resolve vehicle number for payment record
      let vNo = 'Fleet Vehicle';
      if (vehicle) {
        const vRec = await Vehicle.findById(vehicle);
        if (vRec) vNo = vRec.number;
      }

      const paymentData = {
        date: newBooking.pickupDate || new Date(),
        client: newBooking.clientName,
        vehicle: vNo,
        days: newBooking.totalDays || 1,
        startKm: newBooking.startKm || 0,
        endKm: newBooking.endKm || 0,
        extraKmCharges: newBooking.extraKmCharges || 0,
        takenAmount: advAmt,
        hireAmount: totalAmt,
        balance: balAmt,
        status: payStatus,
        address: newBooking.pickupLocation || 'Rental',
        city: newBooking.pickupLocation || 'Rental',
        driverName: newBooking.driverName || 'N/A'
      };
      
      console.log('RAXWO Debug: Creating Payment record:', paymentData);
      const newPayment = new Payment(paymentData);
      await newPayment.save();
      console.log('✅ RAXWO: Payment record created, status:', payStatus);
    } catch (payErr) {
      console.error('❌ RAXWO: Failed to create payment record:', payErr.message);
    }

    res.status(201).json(newBooking);
  } catch (err) {
    console.error('❌ RAXWO Debug: Booking Creation Failed:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update booking (including closing the booking with final KM)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // If dates changed, check availability again
    if (req.body.pickupDate || req.body.returnDate || req.body.vehicle) {
        const start = new Date(req.body.pickupDate || booking.pickupDate);
        const end = new Date(req.body.returnDate || booking.returnDate);
        const vehicleId = req.body.vehicle || booking.vehicle;

        const overlapping = await Booking.findOne({
            _id: { $ne: booking._id },
            vehicle: vehicleId,
            status: { $ne: 'Cancelled' },
            $or: [
                { pickupDate: { $lt: end }, returnDate: { $gt: start } }
            ]
        });

        if (overlapping) {
            return res.status(400).json({ message: 'Vehicle is already booked for these dates' });
        }
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedBooking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete booking
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
