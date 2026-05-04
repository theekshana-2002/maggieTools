const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://[::1]:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://[::1]:3000',
  'https://krishantransports.netlify.app',
  'https://krishan-transport-frontend.vercel.app',
  'https://raxwo-rent-a-car.netlify.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Log origin for final fix
    if (origin) console.log('DEBUG: Incoming Request from Origin:', origin);
    
    // In development, we allow all to unblock login issues
    return callback(null, true);
  },
  credentials: true
}));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.use(express.json());

// Database Connection & Index Sync
if (!process.env.MONGODB_URI) {
  console.error("⚠️ MONGODB_URI is not set! Missing environment variable.");
} else {
  mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
      console.log('✅ MongoDB Connected');
      // Safer index sync - only attempt if we can get the collection
      try {
        const collections = await mongoose.connection.db.listCollections({ name: 'employees' }).toArray();
        if (collections.length > 0) {
          const employeeCollection = mongoose.connection.collection('employees');
          const indexes = await employeeCollection.indexes();
          if (indexes.some(i => i.name === 'username_1')) {
            console.log('🔄 Cleaning up stale indexes...');
            await employeeCollection.dropIndex('username_1').catch(e => console.log('Index drop non-critical error'));
          }
        }
      } catch (err) {
        console.log('ℹ️ Startup maintenance skipped.');
      }
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// Routes
app.use('/api/diesel', require('./routes/diesel'));
app.use('/api/hires', require('./routes/hires'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/salaries', require('./routes/salaries'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/advances', require('./routes/advances'));
app.use('/api/extra-income', require('./routes/extraIncome'));
app.use('/api/expenses', require('./routes/expenses'));

app.get('/', (req, res) => {
  res.send('RAXWO Rent A Car API is running...');
});

// Start server for Node hosts (Render/local), but avoid starting inside Vercel serverless runtime.
const isVercelRuntime = process.env.VERCEL === '1';
if (!isVercelRuntime) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

module.exports = app;
