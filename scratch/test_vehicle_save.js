const mongoose = require('mongoose');
require('dotenv').config();
const Vehicle = require('./backend/models/Vehicle');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  const testNumber = 'TEST-' + Date.now();
  const vehicle = new Vehicle({
    number: testNumber,
    model: 'Test Model',
    type: 'Truck',
    fuelType: 'Petrol',
    status: 'Active'
  });

  try {
    const saved = await vehicle.save();
    console.log('Saved successfully:', saved);
    
    const found = await Vehicle.findOne({ number: testNumber });
    console.log('Found in DB:', found);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.connection.close();
  }
}

test();
