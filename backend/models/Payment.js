const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  // Basic Info
  date:           { type: Date, default: Date.now },
  client:         { type: String, required: true },
  vehicle:        { type: String },
  address:        { type: String },
  city:           { type: String },
  driverName:     { type: String },
  helperName:     { type: String },
  employee:       { type: String }, // Fallback
  
  // Usage Information
  days:           { type: Number, default: 1 },
  startKm:        { type: Number, default: 0 },
  endKm:          { type: Number, default: 0 },
  extraKmCharges: { type: Number, default: 0 },
  totalHours:     { type: Number, default: 0 }, // keep for legacy compatibility
  
  // Billing Breakdown
  minimumHours:   { type: Number, default: 0 },
  hoursInBill:    { type: Number, default: 0 },
  commission:     { type: Number, default: 0 },
  dayPayment:     { type: Number, default: 0 },
  takenAmount:    { type: Number, default: 0 },
  
  // Computed
  hireAmount:     { type: Number, default: 0 },
  paidAmount:     { type: Number, default: 0 },
  balance:        { type: Number, default: 0 },
  status:         { type: String, enum: ['Pending', 'Paid', 'Partial'], default: 'Pending' },
  hireId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Hire' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
