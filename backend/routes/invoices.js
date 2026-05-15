const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Accessory = require('../models/Accessory');
const Payment = require('../models/Payment');
const Account = require('../models/Account');
const { authMiddleware } = require('../middleware/authMiddleware');

async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

// Helper to sync invoice to payment book
async function syncToPaymentBook(invoice) {
    const paymentData = {
        date: invoice.date,
        client: invoice.clientName,
        tool: invoice.items?.[0]?.toolNumber || invoice.toolNo || 'Various',
        city: invoice.site || '',
        hireAmount: invoice.totalAmount,
        takenAmount: invoice.advancePayment || 0,
        balance: invoice.totalAmount - (invoice.advancePayment || 0),
        status: invoice.status === 'Paid' ? 'Paid' : 'Pending',
        paymentMethod: invoice.paymentMethod || 'Cash',
        accountId: invoice.accountId,
        invoiceId: invoice._id
    };

    await Payment.findOneAndUpdate(
        { invoiceId: invoice._id },
        paymentData,
        { upsert: true, new: true }
    );
}

// Get all invoices
router.get('/', authMiddleware, async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create invoice
router.post('/', async (req, res) => {
  try {
    // Auto-generate invoice number if not provided
    if (!req.body.invoiceNo || req.body.invoiceNo === '') {
      const seq = await getNextSequence('invoiceNo');
      const year = new Date().getFullYear().toString().slice(-2);
      req.body.invoiceNo = `RT-INV-${year}-${seq.toString().padStart(4, '0')}`;
    }

    const newInvoice = new Invoice({
      ...req.body,
      updatedBy: req.user.id,
      updatedByName: req.user.name
    });
    const saved = await newInvoice.save();

    // Sync to Payment Book
    await syncToPaymentBook(saved);

    // Deduct stock for accessories
    if (req.body.accessories && Array.isArray(req.body.accessories)) {
        for (const item of req.body.accessories) {
            await Accessory.findOneAndUpdate(
                { name: item.name },
                { $inc: { stock: -item.quantity } }
            );
        }
    }

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user.id,
      updatedByName: req.user.name
    };
    const updated = await Invoice.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (updated) await syncToPaymentBook(updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Mark invoice as Paid
router.post('/:id/pay', authMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const totalToPay = invoice.totalAmount - (invoice.advancePayment || 0);
    
    invoice.advancePayment = invoice.totalAmount;
    invoice.balanceAmount = 0;
    invoice.status = 'Paid';
    invoice.updatedBy = req.user.id;
    invoice.updatedByName = req.user.name;

    const saved = await invoice.save();
    await syncToPaymentBook(saved);

    // Update bank balance if Bank Transfer
    if (saved.paymentMethod === 'Bank Transfer' && saved.accountId && totalToPay > 0) {
        await Account.findByIdAndUpdate(saved.accountId, { $inc: { balance: totalToPay } });
    }

    res.json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete invoice
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      await Invoice.findByIdAndDelete(req.params.id);
      await Payment.findOneAndDelete({ invoiceId: req.params.id });
      res.json({ message: 'Invoice and linked payment deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

module.exports = router;
