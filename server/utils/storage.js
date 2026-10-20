import mongoose from 'mongoose';
import { Staff } from '../models/Staff.js';
import { Patient } from '../models/Patient.js';
import { Invoice } from '../models/Invoice.js';
import { Medicine } from '../models/Medicine.js';
import { Prescription } from '../models/Prescription.js';
import { PharmacyBill } from '../models/PharmacyBill.js';
import { Department } from '../models/Department.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { User } from '../models/User.js';
import { Appointment } from '../models/Appointment.js';
import { Tenant } from '../models/Tenant.js';

// Every collection that stores rows owned by a hospital tenant (via hospitalId)
export const TENANT_SCOPED_MODELS = [Staff, Patient, Invoice, Medicine, Prescription, PharmacyBill, Department, DoctorSchedule, User, Appointment];

// Calculate the actual database storage occupied by a hospital tenant in MB
export const getHospitalStorageUsed = async (hospitalId) => {
  try {
    const collections = [
      ...TENANT_SCOPED_MODELS.map(model => ({ model, isTenant: false })),
      { model: Tenant, isTenant: true }
    ];

    let totalBytes = 0;

    await Promise.all(collections.map(async (col) => {
      const matchQuery = col.isTenant
        ? { _id: mongoose.Types.ObjectId.isValid(hospitalId) ? new mongoose.Types.ObjectId(hospitalId) : null }
        : { hospitalId };

      const result = await col.model.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, totalSize: { $sum: { $bsonSize: "$$ROOT" } } } }
      ]);

      if (result && result[0]) {
        totalBytes += result[0].totalSize;
      }
    }));

    const totalMB = totalBytes / (1024 * 1024);
    return Number(totalMB.toFixed(6));
  } catch (error) {
    console.error("Error in getHospitalStorageUsed BSON calculation:", error);
    return 0;
  }
};

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value) && /^[0-9a-fA-F]{24}$/.test(String(value));
