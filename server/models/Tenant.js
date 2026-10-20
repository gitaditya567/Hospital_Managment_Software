import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  hospitalName: { type: String, required: true },
  adminEmail: { type: String, required: true },
  adminPersonalEmail: { type: String, default: '' },
  address: { type: String, required: true },
  licenseCodeUsed: { type: String, required: true, unique: true },
  subscriptionExpiryDate: { type: String, required: true },
  planId: { type: String, required: true },
  opdFee: { type: Number, default: 500 },
  emergencyFee: { type: Number, default: 1200 },
  bedChargePerDay: { type: Number, default: 2500 },
  adminPhone: { type: String, default: '' },
  hospitalLogo: { type: String, default: '' },
  isTrial: { type: Boolean, default: false },
  signupSource: { type: String, enum: ['operator', 'self-signup', 'license-activation'], default: 'operator' },
  status: { 
    type: String, 
    enum: ['Active', 'Suspended', 'Past Due'], 
    default: 'Active' 
  }
}, { timestamps: true });

export const Tenant = mongoose.model('Tenant', tenantSchema);
