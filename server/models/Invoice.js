import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Paid', 'Pending'], 
    default: 'Pending' 
  },
  doctorName: { type: String, required: true },
  feeType: { type: String, required: true },
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
