import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema({
  platformName: { type: String, default: 'MediSaaS Central Control' },
  maintenanceMode: { type: Boolean, default: false },
  supportEmail: { type: String, default: 'superadmin.support@medisaas.com' },
  allowManualOnboarding: { type: Boolean, default: true },
  stripeEnabled: { type: Boolean, default: true },
  razorpayEnabled: { type: Boolean, default: true },
  taxRate: { type: Number, default: 18 }
}, { timestamps: true });

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
