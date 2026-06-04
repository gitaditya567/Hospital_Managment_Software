import mongoose from 'mongoose';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medisaas');
    console.log(`MongoDB Connected Successfully to: ${conn.connection.host} ✓`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message} ❌`);
    process.exit(1);
  }
}
