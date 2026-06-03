const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, sparse: true },
  // Link to the generated invoice (used in booking list UI)
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  invoiceNo: { type: String, default: '' },
  clientName: { type: String, required: true },
  clientPhone: { type: String },
  clientNic: { type: String },
  customerIdFront: { type: String },
  customerIdBack: { type: String },
  operatorName: { type: String },
  helperName: { type: String },
  tool: { type: mongoose.Schema.Types.ObjectId, ref: 'Tool' }, // Legacy support
  items: [{
    tool: { type: mongoose.Schema.Types.ObjectId, ref: 'Tool' },
    toolNumber: String,
    model: String,
    dailyRate: Number,
    quantity: { type: Number, default: 1 },
    returnedQuantity: { type: Number, default: 0 },
    returnDates: [{ quantity: Number, date: Date }]
  }],
  pickupDate: { type: Date, required: true },
  returnDate: { type: Date, required: true },
  pickupLocation: { type: String },
  returnLocation: { type: String },
  securityDeposit: { type: Number, default: 0 },
  conditionOnPickup: { type: String }, // e.g. "Good", "Needs Cleaning"
  
  // Pricing
  dailyRate: { type: Number, default: 0 },
  totalDays: { type: Number, default: 1 },
  
  baseAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  advancePayment: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  actualReturnDate: { type: Date },
  earlyReturnDays: { type: Number, default: 0 },
  extraCharges: { type: Number, default: 0 },
  transportCharge: { type: Number, default: 0 },
  totalAfterExtra: { type: Number },
  paymentMethod: { type: String, default: 'Cash' },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  
  status: { 
    type: String, 
    enum: ['Confirmed', 'Active', 'Completed', 'Cancelled', 'Returned'], 
    default: 'Confirmed' 
  },
  bookingType: {
    type: String,
    enum: ['General', 'Project', 'Site'],
    default: 'General'
  },
  accessories: [{
    accessory: { type: mongoose.Schema.Types.ObjectId, ref: 'Accessory' },
    number: String,
    name: String,
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    returnedQuantity: { type: Number, default: 0 },
    returnDates: [{ quantity: Number, date: Date }]
  }],
  notes: { type: String },
  followupSent: { type: Boolean, default: false },
  followupSentAt: { type: Date },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
