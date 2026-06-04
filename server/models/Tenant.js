import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  hospitalName: { type: String, required: true },
  adminEmail: { type: String, required: true },
  address: { type: String, required: true },
  licenseCodeUsed: { type: String, required: true, unique: true },
  subscriptionExpiryDate: { type: String, required: true },
  planId: { type: String, required: true },
  opdFee: { type: Number, default: 500 },
  emergencyFee: { type: Number, default: 1200 },
  bedChargePerDay: { type: Number, default: 2500 },
  adminPhone: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Active', 'Suspended', 'Past Due'], 
    default: 'Active' 
  }
}, { timestamps: true });

export const Tenant = mongoose.model('Tenant', tenantSchema);
