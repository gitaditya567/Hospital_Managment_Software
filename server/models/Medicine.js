import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  batchNo: { type: String, required: true },
  location: { type: String, required: true },
  stock: { type: Number, required: true },
  minThreshold: { type: Number, default: 20 },
  expiryDate: { type: String, required: true },
  price: { type: Number, required: true },
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const Medicine = mongoose.model('Medicine', medicineSchema);
