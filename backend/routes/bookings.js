const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Tool = require('../models/Tool');
const Accessory = require('../models/Accessory');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Setting = require('../models/Setting');
const { sendSMS } = require('../utils/smsService');
const Account = require('../models/Account');
const { authMiddleware } = require('../middleware/authMiddleware');

// Helper: Build SMS from template with placeholder replacement
async function buildSMSMessage(templateField, bookingData) {
  try {
    const settings = await Setting.findOne();
    const template = settings?.[templateField] || {detailedBill};

    const itemsList = Array.isArray(bookingData.items) ? bookingData.items : [];
    const toolNo = itemsList.map(it => it.toolNumber).join(' / ') || 'Tool';

    const accList = Array.isArray(bookingData.accessories) ? bookingData.accessories : [];
    const accStr = accList.map(a => `${a.name} (x${a.quantity})`).join(', ');

    const detailedBill = `
--- MAGGI TOOLS BOOKING BILL ---
Customer: ${bookingData.clientName || 'Customer'}
Phone: ${bookingData.clientPhone || 'N/A'}
NIC: ${bookingData.clientNic || 'N/A'}
Location: ${bookingData.pickupLocation || 'N/A'}
Date: ${new Date(bookingData.pickupDate).toLocaleDateString()} to ${new Date(bookingData.returnDate).toLocaleDateString()}

Items Booked:
${toolNo}
${accStr ? 'Accessories: ' + accStr : ''}

Total Price: LKR ${(bookingData.totalAmount || 0).toLocaleString()}
Advance Paid: LKR ${(bookingData.advancePayment || 0).toLocaleString()}
Balance Due: LKR ${(bookingData.balanceAmount || 0).toLocaleString()}

Terms & Conditions apply.
Thank you for choosing ${settings?.companyName || 'MAGGI TOOLS RENTALS'}!
    `.trim();

    // If template has {detailedBill}, use it. Else append it.
    if (template.includes('{detailedBill}')) {
      return template.replace(/\{detailedBill\}/g, detailedBill);
    }
    
    return detailedBill;
  } catch (err) {
    console.error('Failed to build SMS from template:', err.message);
    return null;
  }
}

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
    const toolDoc = await Tool.findById(tool);
    if (!toolDoc) {
      return res.status(404).json({ message: 'Tool not found' });
    }

    // Instead of strict overlapping, check if the requested tool stock is enough
    const requestedQty = (req.body.items && req.body.items.length > 0) ? (req.body.items[0].quantity || 1) : 1;
    if (toolDoc.stock < requestedQty && toolDoc.status !== 'Available') {
      return res.status(400).json({ message: 'Not enough stock available for this tool.' });
    }

    const bookingSeq = await getNextSequence('bookingId');
    const bookingId = `BK-${bookingSeq.toString().padStart(4, '0')}`;

    const booking = new Booking(req.body);
    booking.bookingId = bookingId;
    
    // Ensure tool IDs are strings, not objects (fixes BSON errors during population)
    if (req.body.items && req.body.items.length > 0) {
      const firstTool = req.body.items[0].tool;
      booking.tool = typeof firstTool === 'object' ? firstTool._id : firstTool;
      
      booking.items = req.body.items.map(it => ({
        ...it,
        tool: typeof it.tool === 'object' ? it.tool._id : it.tool
      }));
    }

    booking.updatedBy = req.user.id;
    booking.updatedByName = req.user.name;

    const newBooking = await booking.save();
    console.log(`✅ Booking Saved: ${newBooking._id}`);

    // 1. Update Tool Stock & Status
    if (newBooking.items && newBooking.items.length > 0) {
      for (const item of newBooking.items) {
        try {
          const qty = Number(item.quantity) || 1;
          const updatedTool = await Tool.findByIdAndUpdate(item.tool, { $inc: { stock: -qty } }, { new: true });
          if (updatedTool && updatedTool.stock <= 0) {
            await Tool.findByIdAndUpdate(item.tool, { status: 'Booked' });
          }
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
    
    const sideEffects = await processBookingSideEffects(newBooking.toObject());
    const responseObj = newBooking.toObject();
    responseObj.generatedSms = sideEffects?.generatedSms;
    res.status(201).json(responseObj);

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
        clientPhone: newBooking.clientPhone || '',
        clientNic: newBooking.clientNic || '',
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
          number: a.number,
          name: a.name, 
          quantity: a.quantity, 
          price: a.price 
        })),
        updatedBy: newBooking.updatedBy,
        updatedByName: newBooking.updatedByName,
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

    // 3. Auto-sync to Payment Book
    try {
      const advAmt = parseFloat(newBooking.advancePayment) || 0;
      const totalAmt = parseFloat(newBooking.totalAmount) || 0;
      const balAmt = totalAmt - advAmt;
      const payStatus = advAmt >= totalAmt ? 'Paid' : advAmt > 0 ? 'Partial' : 'Pending';

      const itemsList = Array.isArray(newBooking.items) ? newBooking.items : [];
      const tNo = itemsList.map(it => it.toolNumber).join(' / ') || 'Tool';

      const paymentData = {
        date: newBooking.pickupDate || new Date(),
        client: newBooking.clientName,
        tool: tNo,
        days: newBooking.totalDays || 1,
        takenAmount: advAmt,
        hireAmount: totalAmt,
        transportCharge: newBooking.transportCharge || 0,
        otherCharges: newBooking.extraCharges || 0,
        balance: balAmt,
        status: payStatus,
        paymentMethod: newBooking.paymentMethod || 'Cash',
        address: newBooking.notes || 'Rental',
        city: newBooking.pickupLocation || 'Rental',
        bookingId: newBooking._id
      };
      await Payment.findOneAndUpdate(
        { bookingId: newBooking._id },
        { ...paymentData, accountId: newBooking.accountId || undefined },
        { upsert: true, new: true }
      );
      
      // UPDATE BALANCE IF BANK TRANSFER
      if (newBooking.paymentMethod === 'Bank Transfer' && newBooking.accountId) {
        await Account.findByIdAndUpdate(newBooking.accountId, { $inc: { balance: advAmt } });
      }
      
      console.log('DEBUG: Payment record synced for booking:', newBooking.bookingId);
      // 4. Accessory Stock update now handled explicitly in routes (POST/PUT)
      // 5. Send Confirmation SMS using customizable template
      
      
      let generatedSms = '';
      if (newBooking.clientPhone) {
        generatedSms = await buildSMSMessage('smsBookingTemplate', newBooking);
      }
      return { generatedSms };


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
        
        // Harden IDs and add audit fields
        if (bData.items && bData.items.length > 0) {
          const firstTool = bData.items[0].tool;
          booking.tool = typeof firstTool === 'object' ? firstTool._id : firstTool;
          booking.items = bData.items.map(it => ({
            ...it,
            tool: typeof it.tool === 'object' ? it.tool._id : it.tool
          }));
        }
        
        booking.updatedBy = req.user.id;
        booking.updatedByName = req.user.name;

        const saved = await booking.save();
        console.log(`[BULK] Saved item ${i+1}/${bookings.length}: ${booking.bookingId}`);
        
        // Process side effects (invoice, client, payment, stock)
        // We await this to ensure sequential processing
        
        const sideEffects = await processBookingSideEffects(saved.toObject());
        const obj = saved.toObject();
        obj.generatedSms = sideEffects?.generatedSms;
        results.push(obj);

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

    // Harden IDs in items array if present
    if (req.body.items && Array.isArray(req.body.items)) {
      req.body.items = req.body.items.map(it => ({
        ...it,
        tool: typeof it.tool === 'object' ? it.tool._id : it.tool
      }));
      
      // Sync top-level tool for legacy support
      if (req.body.items.length > 0) {
        const firstTool = req.body.items[0].tool;
        req.body.tool = typeof firstTool === 'object' ? firstTool._id : firstTool;
      }
    } else if (req.body.tool) {
      req.body.tool = typeof req.body.tool === 'object' ? req.body.tool._id : req.body.tool;
    }

    // Sanitize accountId
    if (req.body.accountId === '') req.body.accountId = null;

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.id, updatedByName: req.user.name },
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

    // 2. Delete linked Payment
    try {
      await Payment.findOneAndDelete({ bookingId: bookingId });
      console.log(`[DELETE] Deleted linked payment for booking: ${bookingId}`);
    } catch (payErr) {
      console.error('Failed to delete linked payment:', payErr.message);
    }

    // 3. Delete the Booking record
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

// Send manual reminder SMS (supports custom message from UI)
router.post('/:id/remind', authMiddleware, async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id).populate('tool');
    if (!b) return res.status(404).json({ message: 'Booking not found' });
    
    if (b.clientPhone) {
      // Use custom message from request body if provided, otherwise use follow-up template
      let msg = req.body.customMessage;
      if (!msg) {
        msg = await buildSMSMessage('smsFollowupTemplate', b.toObject());
      }
      if (!msg) {
        msg = `Reminder: Dear ${b.clientName}, your rental is due on ${new Date(b.returnDate).toLocaleDateString()}.`;
      }
      const result = await sendSMS(b.clientPhone, msg);
      return res.json(result);
    }
    res.status(400).json({ message: 'No phone number found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Process automatic follow-up SMS for overdue bookings
router.post('/process-followups', authMiddleware, async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const followupDays = settings?.followupDays || 14;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - followupDays);

    // Find active/confirmed bookings that started more than X days ago and haven't been followed up
    const overdueBookings = await Booking.find({
      status: { $in: ['Active', 'Confirmed'] },
      pickupDate: { $lte: cutoffDate },
      followupSent: { $ne: true },
      clientPhone: { $exists: true, $ne: '' }
    }).populate('tool');

    let sent = 0;
    let failed = 0;

    for (const booking of overdueBookings) {
      try {
        const msg = await buildSMSMessage('smsFollowupTemplate', booking.toObject());
        if (msg && booking.clientPhone) {
          await sendSMS(booking.clientPhone, msg);
          await Booking.findByIdAndUpdate(booking._id, {
            followupSent: true,
            followupSentAt: new Date()
          });
          sent++;
        }
      } catch (smsErr) {
        console.error(`Follow-up SMS failed for ${booking.bookingId}:`, smsErr.message);
        failed++;
      }
    }

    res.json({
      message: `Follow-up processing complete. Sent: ${sent}, Failed: ${failed}, Total eligible: ${overdueBookings.length}`,
      sent,
      failed,
      total: overdueBookings.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get full client details with all bookings and payments
router.get('/client-details/:clientName', authMiddleware, async (req, res) => {
  try {
    const { clientName } = req.params;
    const decodedName = decodeURIComponent(clientName).trim();

    // Find client record
    const client = await Client.findOne({
      name: { $regex: new RegExp(`^${decodedName}$`, 'i') }
    });

    // Find all bookings for this client
    const bookings = await Booking.find({
      clientName: { $regex: new RegExp(`^${decodedName}$`, 'i') }
    }).populate('tool').sort({ createdAt: -1 });

    // Find all payments for this client
    const payments = await Payment.find({
      client: { $regex: new RegExp(`^${decodedName}$`, 'i') }
    }).sort({ date: -1 });

    // Calculate totals
    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.takenAmount || 0), 0);
    const totalOutstanding = bookings.reduce((sum, b) => sum + Math.max(0, b.balanceAmount || 0), 0);
    const paidBookings = bookings.filter(b => (b.balanceAmount || 0) <= 0).length;
    const unpaidBookings = bookings.filter(b => (b.balanceAmount || 0) > 0).length;

    res.json({
      client: client || { name: decodedName },
      bookings: bookings.map(b => ({
        _id: b._id,
        bookingId: b.bookingId,
        tool: b.items?.map(it => it.toolNumber).join(', ') || (b.tool ? b.tool.number : '—'),
        pickupDate: b.pickupDate,
        returnDate: b.returnDate,
        totalAmount: b.totalAmount,
        balanceAmount: b.balanceAmount,
        advancePayment: b.advancePayment,
        status: b.status,
        paymentMethod: b.paymentMethod
      })),
      payments: payments.map(p => ({
        _id: p._id,
        date: p.date,
        tool: p.tool,
        takenAmount: p.takenAmount,
        hireAmount: p.hireAmount,
        balance: p.balance,
        status: p.status,
        paymentMethod: p.paymentMethod
      })),
      summary: {
        totalBookings,
        totalRevenue,
        totalPaid,
        totalOutstanding,
        paidBookings,
        unpaidBookings
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
