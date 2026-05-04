const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  clientName: { type: String, required: true },
  site: { type: String },
  vehicleNo: { type: String, required: true },
  vehicleType: { type: String },
  jobDescription: { type: String },
  
  // Time tracking
  startTime: { type: String },
  endTime: { type: String },
  totalUnits: { type: Number, default: 0 }, // Hours or Days
  unitType: { type: String, enum: ['Hours', 'Days', 'Lumpsum', 'KM'], default: 'Hours' },
  ratePerUnit: { type: Number, default: 0 },
  
  // Additional Charges
  transportCharge: { type: Number, default: 0 },
  otherCharges: { type: Number, default: 0 },
  otherChargesDescription: { type: String },
  
  // Totals
  subtotal: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  
  status: { type: String, enum: ['Draft', 'Sent', 'Paid', 'Cancelled'], default: 'Draft' },
  remarks: { type: String },
  hireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hire' },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
