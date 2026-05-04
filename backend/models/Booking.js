const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, sparse: true },
  clientName: { type: String, required: true },
  clientPhone: { type: String },
  clientNic: { type: String },
  driverName: { type: String },
  helperName: { type: String },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  pickupDate: { type: Date, required: true },
  returnDate: { type: Date, required: true },
  pickupLocation: { type: String },
  returnLocation: { type: String },
  drivingLicenseNo: { type: String },
  securityDeposit: { type: Number, default: 0 },
  fuelLevel: { type: String }, // e.g. "Full", "Half", "Empty"
  
  // KM Tracking
  startKm: { type: Number, default: 0 },
  endKm: { type: Number, default: 0 },
  
  // Pricing
  dailyRate: { type: Number, default: 0 },
  totalDays: { type: Number, default: 1 },
  kmLimit: { type: Number, default: 0 },
  extraKmRate: { type: Number, default: 0 },
  
  baseAmount: { type: Number, default: 0 },
  hasDriver: { type: Boolean, default: false },
  driverFee: { type: Number, default: 0 },
  extraKmCharges: { type: Number, default: 0 },
  customerIdFront: { type: String }, // URL or Base64
  customerIdBack: { type: String },  // URL or Base64
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  advancePayment: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    enum: ['Confirmed', 'Active', 'Completed', 'Cancelled'], 
    default: 'Confirmed' 
  },
  bookingType: {
    type: String,
    enum: ['General', 'Wedding'],
    default: 'General'
  },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
