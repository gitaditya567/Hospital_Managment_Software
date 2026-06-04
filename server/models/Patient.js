import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  patientNo: { type: String },
  phone: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, default: 'Male' },
  doctorName: { type: String, required: true },
  tokenNumber: { type: String, required: true },
  timeRegistered: { type: String, default: 'Just now' },
  status: { 
    type: String, 
    enum: ['Waiting', 'In Consultation', 'Completed'], 
    default: 'Waiting' 
  },
  waitTime: { type: String, default: '0m' },
  vitals: [
    {
      name: { type: String },
      value: { type: String }
    }
  ],
  pastDiagnoses: { type: String, default: '' },
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const Patient = mongoose.model('Patient', patientSchema);
