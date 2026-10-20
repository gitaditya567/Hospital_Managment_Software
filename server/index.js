import dotenv from 'dotenv';
dotenv.config();
// Hospital dates (daily OPD tokens, invoice dates) follow Indian Standard Time unless overridden
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const { connectDB } = await import('./config/db.js');
const { app } = await import('./app.js');

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

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set — using the insecure built-in fallback. Set JWT_SECRET in server/.env for production.');
}

const PORT = process.env.PORT || 5000;

// Connect to MongoDB with auto-reconnect
connectDB();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Smart Hospital Management REST Server running on Port: ${PORT}`);
  console.log(`🔗 API Endpoint: http://localhost:${PORT}`);
  console.log(`🛡️ Auto-Restart Supervisor & Auto-Reconnect Enabled`);
  console.log(`======================================================\n`);
});
