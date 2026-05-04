const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String },
  note: { type: String },
  hireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hire' },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  vehicleNumber: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Expense', ExpenseSchema);
