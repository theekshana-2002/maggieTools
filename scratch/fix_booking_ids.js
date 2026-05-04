const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const Counter = require('./models/Counter');
require('dotenv').config();

async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const bookings = await Booking.find({ $or: [{ bookingId: null }, { bookingId: { $exists: false } }] });
  console.log(`Found ${bookings.length} bookings without ID.`);
  
  for (const b of bookings) {
    const seq = await getNextSequence('bookingId');
    b.bookingId = `BK-${seq.toString().padStart(4, '0')}`;
    await b.save();
    console.log(`Fixed booking ${b._id} -> ${b.bookingId}`);
  }
  process.exit();
}
fix();
