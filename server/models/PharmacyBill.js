import mongoose from 'mongoose';

const pharmacyBillItemSchema = new mongoose.Schema({
  medicineId: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  price: { type: Number, required: true }
});

const pharmacyBillSchema = new mongoose.Schema({
  rxCode: { type: String, required: true },
  patientNo: { type: String },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  doctorName: { type: String, required: true },
  date: { type: String, required: true },
  items: [pharmacyBillItemSchema],
  total: { type: Number, required: true },
  paymentMode: { 
    type: String, 
    enum: ['Cash', 'Card', 'UPI'], 
    required: true 
  },
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const PharmacyBill = mongoose.model('PharmacyBill', pharmacyBillSchema);
