import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Doctor', 'Receptionist', 'Pharmacy'], 
    required: true 
  },
  department: { type: String, default: '' },
  contact: { type: String, required: true },
  email: { type: String, required: true },
  personalEmail: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'On Leave'], 
    default: 'Active' 
  },
  hospitalId: { type: String, required: true },
  consultationFee: { type: Number, default: 500 },
  licenseNo: { type: String, default: '' },
  signature: { type: String, default: '' },
  roleHistory: [
    {
      previousRole: { type: String, required: true },
      newRole: { type: String, required: true },
      updatedAt: { type: String, default: () => new Date().toISOString() }
    }
  ]
}, { timestamps: true });

export const Staff = mongoose.model('Staff', staffSchema);
