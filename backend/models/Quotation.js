const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
  quotationNo: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  clientName: { type: String, required: true },
  clientAddress: { type: String },
  
  // Specifications
  vehicleType: { type: String },
  vehicleNo: { type: String },
  maxHeight: { type: String },
  maxWeight: { type: String },
  
  // Charges
  mandatoryCharge: { type: Number, default: 0 },
  transportCharge: { type: Number, default: 0 },
  extraHourRate: { type: Number, default: 0 },
  
  // Terms
  validityDays: { type: Number, default: 30 },
  termsAndConditions: { type: String },
  
  estimatedTotal: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Cancelled'], default: 'Draft' }
}, { timestamps: true });

module.exports = mongoose.model('Quotation', QuotationSchema);
