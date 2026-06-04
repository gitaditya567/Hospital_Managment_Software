import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Doctor', 'Receptionist', 'Pharmacy', 'Lab Technician'], 
    required: true 
  },
  department: { type: String, default: '' },
  contact: { type: String, required: true },
  email: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'On Leave'], 
    default: 'Active' 
  },
  hospitalId: { type: String, required: true },
  consultationFee: { type: Number, default: 500 },
  licenseNo: { type: String, default: '' },
  signature: { type: String, default: '' }
}, { timestamps: true });

export const Staff = mongoose.model('Staff', staffSchema);
