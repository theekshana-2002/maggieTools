const mongoose = require('mongoose');
require('dotenv').config();

async function debugData() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/krishan_transport');
  
  const Vehicle = mongoose.model('Vehicle', new mongoose.Schema({}, { strict: false }));
  const Payment = mongoose.model('Payment', new mongoose.Schema({}, { strict: false }));
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));

  console.log('--- VEHICLES ---');
  const vehicles = await Vehicle.find().limit(5);
  console.log(JSON.stringify(vehicles, null, 2));

  console.log('--- PAYMENTS ---');
  const payments = await Payment.find().limit(5);
  console.log(JSON.stringify(payments, null, 2));

  console.log('--- BOOKINGS ---');
  const bookings = await Booking.find().limit(5);
  console.log(JSON.stringify(bookings, null, 2));

  await mongoose.disconnect();
}

debugData();
