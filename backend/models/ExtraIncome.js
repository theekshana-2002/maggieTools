const mongoose = require('mongoose');

const ExtraIncomeSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String },
  note: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ExtraIncome', ExtraIncomeSchema);
