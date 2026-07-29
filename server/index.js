import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, isDbConnected } from './config/db.js';
import { authRouter } from './routes/auth.js';
import { pharmacyRouter } from './routes/pharmacy.js';
import { hospitalRouter } from './routes/hospital.js';
import { superadminRouter } from './routes/superadmin.js';

dotenv.config();
// Server Hot-Reload Refresh: 2026-07-28 HMS License Generator Updated

// Global Exception & Rejection Handlers (Prevents Server Crash on Uncaught Runtime Errors)
process.on('uncaughtException', (err) => {
  console.error('\n💥 [SERVER RESILIENCE] UNCAUGHT EXCEPTION DETECTED:');
  console.error(err.stack || err.message || err);
  console.log('🛡️ Auto-Recovery Active: Express server uptime preserved.\n');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n⚠️ [SERVER RESILIENCE] UNHANDLED PROMISE REJECTION DETECTED:');
  console.error(reason);
  console.log('🛡️ Auto-Recovery Active: Express server uptime preserved.\n');
});

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB with auto-reconnect
connectDB();

// Express Middlewares with High-Capacity Body Parser Limit for High-Res Logos & Assets
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Routes mounting
app.use('/api/auth', authRouter);
app.use('/api/pharmacy', pharmacyRouter);
app.use('/api/hospital', hospitalRouter);
app.use('/api/superadmin', superadminRouter);

app.get('/', (req, res) => {
  res.json({
    status: 'Smart Hospital Management REST Server Online 🟢',
    db_status: isDbConnected() ? 'Connected 🟢' : 'Reconnecting 🟡',
    version: '1.0.0',
    copyright: 'Copyright © twinsCloud',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Smart Hospital Management REST Server running on Port: ${PORT}`);
  console.log(`🔗 API Endpoint: http://localhost:${PORT}`);
  console.log(`🛡️ Auto-Restart Supervisor & Auto-Reconnect Enabled`);
  console.log(`======================================================\n`);
});
