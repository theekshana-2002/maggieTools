const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  model: { type: String },
  category: { type: String, default: 'Economy' }, 
  fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Hybrid', 'Electric'], default: 'Petrol' },
  status: { type: String, enum: ['Available', 'Booked', 'Maintenance'], default: 'Available' },
  dailyRate: { type: Number, default: 0 },
  kmLimitPerDay: { type: Number, default: 0 },
  extraKmRate: { type: Number, default: 0 },

  // Compliance Dates
  insuranceExpirationDate: { type: Date },
  licenseExpirationDate: { type: Date },
  safetyExpirationDate: { type: Date },

  // Leasing & Finance
  hasLeasing: { type: Boolean, default: false },
  leasingCompany: { type: String },
  monthlyPremium: { type: Number, default: 0 },
  leaseDueDate: { type: Number }, // Day of month (1-31)
  leaseFinalDate: { type: Date },
  leasePayments: [{
    year: Number,
    month: Number,
    paid: { type: Boolean, default: false },
    paidDate: Date
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
