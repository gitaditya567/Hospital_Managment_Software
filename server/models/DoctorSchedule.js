import mongoose from 'mongoose';

const doctorScheduleSchema = new mongoose.Schema({
  doctorId: { type: String, required: true },
  doctorName: { type: String, required: true },
  roomNumber: { type: String, required: true },
  availability: { type: String, required: true },
  days: { type: String, required: true },
  hospitalId: { type: String, required: true }
}, { timestamps: true });

export const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);
