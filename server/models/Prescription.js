import mongoose from 'mongoose';

const prescriptionItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  price: { type: Number, required: true },
  dosage: { type: String, default: '' },
  duration: { type: String, default: '' }
});

const prescriptionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  patientNo: { type: String },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  doctorName: { type: String, required: true },
  date: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'DISPENSED'], 
    default: 'PENDING' 
  },
  items: [prescriptionItemSchema],
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const Prescription = mongoose.model('Prescription', prescriptionSchema);
