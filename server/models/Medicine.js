import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  batchNo: { type: String, required: true },
  location: { type: String, default: 'Main store' },
  stock: { type: Number, required: true },
  minThreshold: { type: Number, default: 20 },
  expiryDate: { type: String, required: true },
  price: { type: Number, required: true },
  // Every stock receipt, newest last (the medicine's expiryDate is the earliest batch still in stock)
  batches: [{
    batchNo: String,
    expiryDate: String,
    qty: Number,
    supplier: String,
    receivedAt: { type: Date, default: Date.now }
  }],
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const Medicine = mongoose.model('Medicine', medicineSchema);
