const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
require('dotenv').config();

async function check() {
  if (!process.env.MONGODB_URI) { console.error('No URI'); process.exit(); }
  await mongoose.connect(process.env.MONGODB_URI);
  const count = await Invoice.countDocuments();
  console.log(`Total Invoices: ${count}`);
  const latest = await Invoice.findOne().sort({ createdAt: -1 });
  console.log('Latest Invoice:', JSON.stringify(latest, null, 2));
  process.exit();
}
check();
