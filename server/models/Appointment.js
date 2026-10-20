import mongoose from 'mongoose';

// A booking for a future (or today's) OPD visit. It joins the live queue only when checked in.
const appointmentSchema = new mongoose.Schema({
  patientName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  age: { type: Number, required: true },
  gender: { type: String, default: 'Male' },
  doctorId: { type: String, default: '' },
  doctorName: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD (hospital local date)
  time: { type: String, required: true }, // e.g. "10:30 AM"
  notes: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Booked', 'Checked In', 'Cancelled', 'No Show'],
    default: 'Booked'
  },
  patientId: { type: String, default: null }, // OPD visit created at check-in
  hospitalId: { type: String, required: true }
}, { timestamps: true });

appointmentSchema.index({ hospitalId: 1, date: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
