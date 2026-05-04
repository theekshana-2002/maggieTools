const mongoose = require('mongoose');
const Booking = require('./models/Booking');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const latest = await Booking.findOne().sort({ createdAt: -1 });
  console.log('Latest Booking:', JSON.stringify({
    _id: latest._id,
    clientName: latest.clientName,
    totalAmount: latest.totalAmount,
    balanceAmount: latest.balanceAmount
  }, null, 2));
  process.exit();
}
check();
