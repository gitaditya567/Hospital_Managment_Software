import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  maxDoctors: { type: Number, required: true },
  maxReceptionists: { type: Number, required: true },
  maxPharmacists: { type: Number, required: true },
  maxStorage: { type: Number, required: true },
  durationMonths: { type: Number, required: true }
}, { timestamps: true });

export const Plan = mongoose.model('Plan', planSchema);
