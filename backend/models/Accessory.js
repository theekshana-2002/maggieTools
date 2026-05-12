const mongoose = require('mongoose');

const accessorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String }, // e.g. "Drill Bits", "Saw Blades"
  price: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  unit: { type: String, default: 'pcs' },
  description: { type: String },
  status: { type: String, enum: ['In Stock', 'Low Stock', 'Out of Stock'], default: 'In Stock' }
}, { timestamps: true });

module.exports = mongoose.model('Accessory', accessorySchema);
