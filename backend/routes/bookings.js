const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Tool = require('../models/Tool');
const Accessory = require('../models/Accessory');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const { sendSMS } = require('../utils/smsService');
const { authMiddleware } = require('../middleware/authMiddleware');

async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

// Get dashboard insights (Top tools, Top customers)
router.get('/insights', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find().populate('tool');
    
    // Top Tools
    const toolStats = {};
    bookings.forEach(b => {
      if (b.tool) {
        const id = b.tool._id.toString();
        if (!toolStats[id]) {
          toolStats[id] = { 
            name: `${b.tool.number} - ${b.tool.model}`, 
            count: 0, 
            revenue: 0,
            image: b.tool.images?.[0] || null
          };
        }
        toolStats[id].count += 1;
        toolStats[id].revenue += (b.totalAmount || 0);
      }
    });
    
    const topTools = Object.values(toolStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top Customers
    const customerStats = {};
    bookings.forEach(b => {
      const name = b.clientName || 'Unknown';
      if (!customerStats[name]) {
        customerStats[name] = { 
          name, 
          count: 0, 
          revenue: 0, 
          latestTool: b.tool ? b.tool.model : 'N/A' 
        };
      }
      customerStats[name].count += 1;
      customerStats[name].revenue += (b.totalAmount || 0);
      customerStats[name].latestTool = b.tool ? b.tool.model : customerStats[name].latestTool;
    });

    const topCustomers = Object.values(customerStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({ topTools, topCustomers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all bookings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find().populate('tool').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Check tool availability
router.get('/check-availability', authMiddleware, async (req, res) => {
  const { pickupDate, returnDate, toolId } = req.query;
  try {
    const start = new Date(pickupDate);
    const end = new Date(returnDate);

    const overlapping = await Booking.findOne({
      tool: toolId,
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

// Get available tools for a date range
router.get('/available-tools', authMiddleware, async (req, res) => {
  const { pickupDate, returnDate } = req.query;
  try {
    const start = new Date(pickupDate);
    const end = new Date(returnDate);

    // Get IDs of tools already booked in this range
    const bookedTools = await Booking.find({
      status: { $ne: 'Cancelled' },
      $or: [
        { pickupDate: { $lt: end }, returnDate: { $gt: start } }
      ]
    }).distinct('tool');

    // Find tools not in the booked list
    const availableTools = await Tool.find({
      _id: { $nin: bookedTools },
      status: 'Available'
    });

    res.json(availableTools);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new booking
router.post('/', authMiddleware, async (req, res) => {
  const { tool, pickupDate, returnDate } = req.body;
  
  try {
    // Double check availability
    const start = new Date(pickupDate);
    const end = new Date(returnDate);
    const overlapping = await Booking.findOne({
      tool,
      status: { $ne: 'Cancelled' },
      $or: [
        { pickupDate: { $lt: end }, returnDate: { $gt: start } }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ message: 'Tool is already booked for these dates' });
    }

    const bookingSeq = await getNextSequence('bookingId');
    const bookingId = `BK-${bookingSeq.toString().padStart(4, '0')}`;

    const booking = new Booking(req.body);
    booking.bookingId = bookingId;
    
    // Ensure the primary 'tool' field is set for backward compatibility
    if (req.body.items && req.body.items.length > 0) {
      booking.tool = req.body.items[0].tool;
    }

    const newBooking = await booking.save();

    // 1. Update Tool Status
    if (newBooking.items && newBooking.items.length > 0) {
      for (const item of newBooking.items) {
        try {
          await Tool.findByIdAndUpdate(item.tool, { status: 'Booked' });
        } catch (tErr) { console.error('Tool status update fail:', tErr.message); }
      }
    }

    // 2. Update Accessory Stock (Immediate & Explicit)
    if (req.body.accessories && Array.isArray(req.body.accessories)) {
      for (const accItem of req.body.accessories) {
        try {
          const id = accItem.accessory || accItem.accessoryId;
          if (!id) continue;
          
          const qty = Number(accItem.quantity) || 0;
          if (qty <= 0) continue;

          console.log(`EMERGENCY STOCK FIX: Subtracting ${qty} from Accessory ${id}`);
          const updated = await Accessory.findByIdAndUpdate(
            id,
            { $inc: { stock: -qty } },
            { new: true }
          );
          
          if (updated) {
            let status = 'In Stock';
            if (updated.stock <= 0) status = 'Out of Stock';
            else if (updated.stock < 5) status = 'Low Stock';
            await Accessory.findByIdAndUpdate(id, { status });
          }
        } catch (accErr) {
          console.error('Accessory stock decrement failed in POST:', accErr.message);
        }
      }
    }

    // 3. Handle Other Side Effects (Invoice, SMS, etc)
    await processBookingSideEffects(newBooking.toObject());

    res.status(201).json(newBooking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Helper for booking side effects
async function processBookingSideEffects(newBooking) {
    // 1. Auto-generate or Update invoice
    try {
      const existingInvoice = await Invoice.findOne({ bookingId: newBooking._id });
      
      const accList = Array.isArray(newBooking.accessories) ? newBooking.accessories : [];
      const accDesc = accList.map(a => `${a.name} (x${a.quantity})`).join(', ');

      const itemsList = Array.isArray(newBooking.items) ? newBooking.items : [];
      const toolsDesc = itemsList.map(it => `${it.toolNumber} (${it.model})`).join(', ');
      const toolsNo = itemsList.map(it => it.toolNumber).join(' / ');
      const tNo = toolsNo || 'Tool';

      const invoiceData = {
        date: new Date(),
        clientName: newBooking.clientName,
        toolNo: toolsNo || 'Tool',
        toolType: itemsList.length > 1 ? 'Multiple Tools' : (itemsList[0]?.category || 'Tool'),
        jobDescription: `Tool Rental: ${new Date(newBooking.pickupDate).toLocaleDateString()} - ${new Date(newBooking.returnDate).toLocaleDateString()}\nTools: ${toolsDesc}${accDesc ? `\nAccessories: ${accDesc}` : ''}`,
        totalUnits: newBooking.totalDays || 1,
        unitType: 'Days',
        ratePerUnit: itemsList.length === 1 ? itemsList[0].dailyRate : 0,
        subtotal: newBooking.totalAmount || 0,
        totalAmount: newBooking.totalAmount || 0,
        advancePayment: newBooking.advancePayment || 0,
        balanceAmount: newBooking.balanceAmount || 0,
        bookingId: newBooking._id,
        accessories: accList.map(a => ({ 
          name: a.name, 
          quantity: a.quantity, 
          price: a.price 
        })),
        remarks: `Auto-updated from booking ${newBooking.bookingId}`
      };

      if (existingInvoice) {
        await Invoice.findByIdAndUpdate(existingInvoice._id, invoiceData);
        console.log('DEBUG: Existing invoice updated:', existingInvoice.invoiceNo);
      } else {
        const seq = await getNextSequence('invoiceNo');
        const year = new Date().getFullYear().toString().slice(-2);
        invoiceData.invoiceNo = `INV-${year}-${seq.toString().padStart(4, '0')}`;
        invoiceData.status = 'Draft';
        const newInvoice = new Invoice(invoiceData);
        await newInvoice.save();
        console.log('DEBUG: New invoice created:', invoiceData.invoiceNo);
      }
    } catch (invErr) {
      console.error('Failed to sync invoice:', invErr);
    }

    // 2. Auto-save/update Client
    try {
      const targetName = (newBooking.clientName || '').trim();
      if (targetName) {
        const existingClient = await Client.findOne({
          name: { $regex: new RegExp(`^${targetName}$`, 'i') }
        });
        if (existingClient) {
          existingClient.totalHires = (existingClient.totalHires || 0) + 1;
          if (newBooking.clientPhone) existingClient.contact = newBooking.clientPhone;
          if (newBooking.customerIdFront) existingClient.customerIdFront = newBooking.customerIdFront;
          if (newBooking.customerIdBack) existingClient.customerIdBack = newBooking.customerIdBack;
          await existingClient.save();
        } else {
          const newClient = new Client({
            name: targetName,
            contact: newBooking.clientPhone || '',
            totalHires: 1,
            outstanding: newBooking.balanceAmount || 0,
            customerIdFront: newBooking.customerIdFront || '',
            customerIdBack: newBooking.customerIdBack || '',
            status: 'Active'
          });
          await newClient.save();
        }
      }
    } catch (clientErr) {
      console.error('Failed to auto-sync client:', clientErr.message);
    }

    // 3. Auto-create Payment record (advance)
    try {
      const advAmt = parseFloat(newBooking.advancePayment) || 0;
      const totalAmt = parseFloat(newBooking.totalAmount) || 0;
      const balAmt = totalAmt - advAmt;
      const payStatus = advAmt >= totalAmt ? 'Paid' : advAmt > 0 ? 'Partial' : 'Pending';

      const paymentData = {
        date: newBooking.pickupDate || new Date(),
        client: newBooking.clientName,
        tool: tNo,
        days: newBooking.totalDays || 1,
        takenAmount: advAmt,
        hireAmount: totalAmt,
        balance: balAmt,
        status: payStatus,
        address: newBooking.pickupLocation || 'Rental',
        city: newBooking.pickupLocation || 'Rental'
      };
      
      const newPayment = new Payment(paymentData);
      await newPayment.save();
      // 4. Accessory Stock update now handled explicitly in routes (POST/PUT)
      // 5. Send Confirmation SMS
      if (newBooking.clientPhone) {
        const msg = `Dear ${newBooking.clientName}, Thank you for choosing DVD Tool Rentals. You have rented ${tNo} from ${new Date(newBooking.pickupDate).toLocaleDateString()} to ${new Date(newBooking.returnDate).toLocaleDateString()}. Total: LKR ${(newBooking.totalAmount || 0).toLocaleString()}.`;
        await sendSMS(newBooking.clientPhone, msg);
      }
    } catch (payErr) {
      console.error('Failed to create payment record:', payErr.message);
    }
}

// Bulk create bookings (for multiple tools)
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { bookings } = req.body;
    if (!bookings || !Array.isArray(bookings)) {
      console.warn('[BULK BOOKING] Invalid data received:', req.body);
      return res.status(400).json({ message: 'Invalid bulk data' });
    }

    console.log(`[BULK BOOKING] Starting processing for ${bookings.length} items...`);

    const bookingSeq = await getNextSequence('bookingId');
    const commonId = `BK-${bookingSeq.toString().padStart(4, '0')}`;
    
    const results = [];
    for (let i = 0; i < bookings.length; i++) {
      try {
        const bData = bookings[i];
        const toolCode = bookings.length > 1 ? `-${String.fromCharCode(65 + i)}` : '';
        
        const booking = new Booking(bData);
        booking.bookingId = `${commonId}${toolCode}`;
        
        const saved = await booking.save();
        console.log(`[BULK] Saved item ${i+1}/${bookings.length}: ${booking.bookingId}`);
        
        // Process side effects (invoice, client, payment, stock)
        // We await this to ensure sequential processing
        await processBookingSideEffects(saved.toObject());
        
        results.push(saved);
      } catch (itemErr) {
        console.error(`[BULK] Failed at item ${i+1}:`, itemErr.message);
        // Continue with other items or throw if critical
      }
    }
    
    if (results.length === 0) {
      throw new Error('All booking items failed to save.');
    }

    res.status(201).json({ 
      message: `Successfully processed ${results.length} tools.`,
      bookings: results 
    });
  } catch (err) {
    console.error('CRITICAL BULK ERROR:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update booking
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (req.body.pickupDate || req.body.returnDate || req.body.tool) {
        const start = new Date(req.body.pickupDate || booking.pickupDate);
        const end = new Date(req.body.returnDate || booking.returnDate);
        const toolId = req.body.tool || booking.tool;

        const overlapping = await Booking.findOne({
            _id: { $ne: booking._id },
            tool: toolId,
            status: { $ne: 'Cancelled' },
            $or: [
                { pickupDate: { $lt: end }, returnDate: { $gt: start } }
            ]
        });

        if (overlapping) {
            return res.status(400).json({ message: 'Tool is already booked for these dates' });
        }
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    // Auto-update linked invoice and client
    await processBookingSideEffects(updatedBooking.toObject());
    
    res.json(updatedBooking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete booking
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    // 1. Delete associated Invoice
    try {
      await Invoice.deleteMany({ bookingId: bookingId });
      console.log(`[DELETE] Deleted linked invoices for booking: ${bookingId}`);
    } catch (invErr) {
      console.error('Failed to delete linked invoice:', invErr.message);
    }

    // 2. Delete the Booking record
    await Booking.findByIdAndDelete(bookingId);
    
    res.json({ message: 'Booking and linked invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get customer history by NIC
router.get('/customer/:nic', authMiddleware, async (req, res) => {
  try {
    const { nic } = req.params;
    const cleanNic = (nic || '').trim();
    
    const lastBooking = await Booking.findOne({ 
      clientNic: { $regex: new RegExp(`^${cleanNic}`, 'i') } 
    }).populate('tool').sort({ createdAt: -1 });

    // Also check Client collection for ID photos and details
    const clientRecord = await Client.findOne({
      nic: { $regex: new RegExp(`^${cleanNic}`, 'i') }
    });
    
    if (!lastBooking && !clientRecord) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const history = lastBooking ? await Booking.find({ clientNic: lastBooking.clientNic })
      .populate('tool')
      .sort({ createdAt: -1 })
      .limit(5) : [];
    
    res.json({
      details: {
        name: clientRecord?.name || lastBooking?.clientName,
        phone: clientRecord?.contact || lastBooking?.clientPhone,
        nic: clientRecord?.nic || lastBooking?.clientNic,
        customerIdFront: clientRecord?.customerIdFront || lastBooking?.customerIdFront,
        customerIdBack: clientRecord?.customerIdBack || lastBooking?.customerIdBack,
        conditionOnPickup: lastBooking?.conditionOnPickup
      },
      history: history.map(h => ({
        _id: h._id,
        date: h.pickupDate,
        tool: h.tool ? `${h.tool.number} - ${h.tool.model}` : 'Unknown',
        price: h.totalAmount,
        dailyRate: h.dailyRate,
        status: h.status
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send manual reminder SMS
router.post('/:id/remind', authMiddleware, async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id).populate('tool');
    if (!b) return res.status(404).json({ message: 'Booking not found' });
    
    if (b.clientPhone) {
      const msg = `Reminder from DVD Tool Rentals: Dear ${b.clientName}, your rental of ${b.tool ? b.tool.number : 'Tool'} is due on ${new Date(b.returnDate).toLocaleDateString()}. Please ensure timely return to avoid extra charges.`;
      const result = await sendSMS(b.clientPhone, msg);
      return res.json(result);
    }
    res.status(400).json({ message: 'No phone number found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
