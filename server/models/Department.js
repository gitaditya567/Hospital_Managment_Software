import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  head: { type: String, default: 'Pending Assignment' },
  staffCount: { type: Number, default: 0 },
  staffAssigned: { type: String, default: '' },
  beds: { type: String, default: '' },
  rooms: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Active', 'Setup Required'], 
    default: 'Setup Required' 
  },
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const Department = mongoose.model('Department', departmentSchema);
