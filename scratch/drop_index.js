const mongoose = require('mongoose');
require('dotenv').config();

async function dropIndex() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const collection = mongoose.connection.collection('bookings');
    await collection.dropIndex('bookingId_1');
    console.log('✅ Index bookingId_1 dropped successfully.');
  } catch (err) {
    console.log('ℹ️ Index might not exist or already dropped:', err.message);
  }
  process.exit();
}
dropIndex();
