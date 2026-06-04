import mongoose from 'mongoose';

const licenseCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  planId: { type: String, required: true },
  validityMonths: { type: Number, default: 12 },
  status: { 
    type: String, 
    enum: ['Unused', 'Used', 'Expired'], 
    default: 'Unused' 
  },
  isUsed: { type: Boolean, default: false }
}, { timestamps: true });

export const LicenseCode = mongoose.model('LicenseCode', licenseCodeSchema);
