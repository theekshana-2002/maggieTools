const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact: { type: String },
  totalHires: { type: Number, default: 0 },
  outstanding: { type: Number, default: 0 },
  status: { type: String, default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Client', ClientSchema);
