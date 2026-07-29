import mongoose from 'mongoose';

let isConnecting = false;

const mongooseOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  family: 4 // Use IPv4 for network stability
};

// Event Listeners for Automatic Reconnection
mongoose.connection.on('connected', () => {
  console.log(`🟢 MongoDB Connection Active on host: ${mongoose.connection.host}`);
});

mongoose.connection.on('error', (err) => {
  console.error(`🔴 MongoDB Connection Error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB Connection Lost! Initiating automatic reconnection sequence...');
  connectDBWithRetry();
});

mongoose.connection.on('reconnected', () => {
  console.log('🎉 MongoDB Reconnected Successfully! Database operations restored.');
});

async function connectDBWithRetry() {
  if (isConnecting || mongoose.connection.readyState === 1) return;
  isConnecting = true;

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medisaas';
  
  try {
    const conn = await mongoose.connect(mongoURI, mongooseOptions);
    console.log(`MongoDB Connected Successfully to: ${conn.connection.host} ✓`);
    isConnecting = false;
  } catch (error) {
    console.error(`❌ MongoDB Initial Connection Failed: ${error.message}`);
    console.log('🔄 Retrying MongoDB connection in 5 seconds...');
    isConnecting = false;
    setTimeout(connectDBWithRetry, 5000);
  }
}

export async function connectDB() {
  await connectDBWithRetry();
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}
