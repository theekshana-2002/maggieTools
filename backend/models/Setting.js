const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  companyName: { type: String, default: 'RAXWO TOOL RENTALS' },
  address: { type: String, default: 'No. 241, Rajamaha Vihara Rd, Mirihana, Kotte.' },
  phones: [{ type: String }],
  email: { type: String, default: 'info@raxwo.com' },
  regNo: { type: String, default: '73330' },
  logo: { type: String }, // Base64 or URL
  currency: { type: String, default: 'LKR' },
  // Full bill SMS sent on booking confirm — editable in Settings
  smsBookingTemplate: { type: String, default: '' },
  smsFollowupTemplate: {
    type: String,
    default: 'Dear {clientName}, This is a reminder from {companyName}. Your rental of {toolNo} was due on {returnDate}. Outstanding balance: LKR {balanceAmount}. Please arrange return/payment at your earliest convenience.'
  },
  followupDays: { type: Number, default: 14 } // Days after booking to send follow-up
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
