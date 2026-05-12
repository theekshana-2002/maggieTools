const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  companyName: { type: String, default: 'RAXWO TOOL RENTALS' },
  address: { type: String, default: 'No. 241, Rajamaha Vihara Rd, Mirihana, Kotte.' },
  phones: [{ type: String }],
  email: { type: String, default: 'info@raxwo.com' },
  regNo: { type: String, default: '73330' },
  logo: { type: String }, // Base64 or URL
  currency: { type: String, default: 'LKR' }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
