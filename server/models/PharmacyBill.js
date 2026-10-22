import mongoose from 'mongoose';

const pharmacyBillItemSchema = new mongoose.Schema({
  medicineId: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  price: { type: Number, required: true }
});

const pharmacyBillSchema = new mongoose.Schema({
  billNo: { type: String, default: '' },
  saleType: { type: String, enum: ['Prescription', 'Counter'], default: 'Prescription' },
  rxCode: { type: String, default: '' },
  patientNo: { type: String },
  patientName: { type: String, default: 'Walk-in customer' },
  patientPhone: { type: String, default: '' },
  doctorName: { type: String, default: '' },
  date: { type: String, required: true },
  items: [pharmacyBillItemSchema],
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMode: { 
    type: String, 
    enum: ['Cash', 'Card', 'UPI'], 
    required: true 
  },
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const PharmacyBill = mongoose.model('PharmacyBill', pharmacyBillSchema);
