import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Tenant } from './models/Tenant.js';
import { LicenseCode } from './models/LicenseCode.js';
import { Staff } from './models/Staff.js';
import { Patient } from './models/Patient.js';
import { Invoice } from './models/Invoice.js';
import { Medicine } from './models/Medicine.js';
import { Prescription } from './models/Prescription.js';
import { PharmacyBill } from './models/PharmacyBill.js';
import { Department } from './models/Department.js';
import { DoctorSchedule } from './models/DoctorSchedule.js';
import { PlatformActivity } from './models/PlatformActivity.js';
import { SubscriptionInvoice } from './models/SubscriptionInvoice.js';
import { SystemSetting } from './models/SystemSetting.js';
import { Plan } from './models/Plan.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const seedDatabase = async () => {
  try {
    // Clear all existing collections
    console.log('Clearing database tables...');
    await User.deleteMany({});
    await Tenant.deleteMany({});
    await LicenseCode.deleteMany({});
    await Staff.deleteMany({});
    await Patient.deleteMany({});
    await Invoice.deleteMany({});
    await Medicine.deleteMany({});
    await Prescription.deleteMany({});
    await PharmacyBill.deleteMany({});
    await Department.deleteMany({});
    await DoctorSchedule.deleteMany({});
    await PlatformActivity.deleteMany({});
    await SubscriptionInvoice.deleteMany({});
    await SystemSetting.deleteMany({});
    await Plan.deleteMany({});

    console.log('Tables cleared. Seeding default configurations...');

    // 0. Seed Subscription Plans
    await Plan.insertMany([
      { id: 'plan-basic', name: 'Basic Plan', price: 9999, maxDoctors: 2, maxReceptionists: 1, maxPharmacists: 1, maxStorage: 10, durationMonths: 12 },
      { id: 'plan-pro', name: 'Pro Plan', price: 24999, maxDoctors: 10, maxReceptionists: 5, maxPharmacists: 3, maxStorage: 100, durationMonths: 12 },
      { id: 'plan-enterprise', name: 'Enterprise Plan', price: 59999, maxDoctors: -1, maxReceptionists: -1, maxPharmacists: -1, maxStorage: 500, durationMonths: 12 },
    ]);
    console.log('✓ Central Subscription Plans seeded.');

    // 1. Create central operator license codes
    await LicenseCode.insertMany([
      { code: 'HOSP-2026-R4T1-OP90', planId: 'plan-enterprise', validityMonths: 12, status: 'Unused', isUsed: false },
      { code: 'HOSP-2026-PEND-7777', planId: 'plan-pro', validityMonths: 6, status: 'Unused', isUsed: false },
      { code: 'HOSP-2026-LITE-3011', planId: 'plan-basic', validityMonths: 12, status: 'Unused', isUsed: false }
    ]);
    console.log('✓ Cryptographic SaaS Licenses seeded.');

    // 2. Create Tenant Nodes (Apollo Main & City Care)
    await Tenant.insertMany([
      { 
        _id: new mongoose.Types.ObjectId('65f3d9b1c92d5a3f124a9001'), 
        hospitalName: 'City Care Hospital', 
        adminEmail: 'admin@citycare.com', 
        address: '102 Metro Road, Connaught Place, New Delhi',
        licenseCodeUsed: 'HOSP-2026-R4T1-OP90',
        subscriptionExpiryDate: '2027-05-23',
        planId: 'plan-enterprise',
        opdFee: 500,
        emergencyFee: 1200,
        bedChargePerDay: 2500,
        status: 'Active'
      }
    ]);
    console.log('✓ Hospital Tenant Nodes seeded.');

    // 3. Create default Super Admin user
    const superAdmin = new User({
      name: 'Super Operator',
      email: 'super@med.com',
      password: 'demo1234',
      role: 'SUPER_ADMIN',
      hospitalId: null,
      isActivated: true
    });
    await superAdmin.save();
    console.log('✓ Default Super Admin user seeded (super@med.com).');

    // 4. Create Staff Directory
    await Staff.insertMany([
      { name: 'Dr. Sarah Smith', role: 'Doctor', department: 'Cardiology', contact: '9876543210', email: 'sarah.smith@medisaas.com', hospitalId: '65f3d9b1c92d5a3f124a9001', status: 'Active' },
      { name: 'Dr. John Davis', role: 'Doctor', department: 'Orthopedics', contact: '9876543211', email: 'john.davis@medisaas.com', hospitalId: '65f3d9b1c92d5a3f124a9001', status: 'Active' },
      { name: 'Emily White', role: 'Receptionist', contact: '9876543212', email: 'emily.white@medisaas.com', hospitalId: '65f3d9b1c92d5a3f124a9001', status: 'Active' },
      { name: 'Michael Brown', role: 'Pharmacy', contact: '9876543213', email: 'michael.brown@medisaas.com', hospitalId: '65f3d9b1c92d5a3f124a9001', status: 'Active' }
    ]);
    console.log('✓ Staff Personnel directory seeded.');

    // 9. Create Default Departments
    await Department.insertMany([
      { name: 'Cardiology', head: 'Dr. Sarah Smith', staffCount: 1, rooms: 'Rooms 101-105', status: 'Active', hospitalId: '65f3d9b1c92d5a3f124a9001' },
      { name: 'Orthopedics', head: 'Dr. John Davis', staffCount: 1, rooms: 'Rooms 201-205', status: 'Active', hospitalId: '65f3d9b1c92d5a3f124a9001' }
    ]);
    console.log('✓ Clinical departments seeded.');

    // 10. Create Default Doctor Schedules
    await DoctorSchedule.insertMany([
      { doctorId: 'doc@med.com', doctorName: 'Dr. Sarah Smith', roomNumber: 'Room 101', availability: '09:00 AM - 01:00 PM', days: 'Mon, Wed, Fri', hospitalId: '65f3d9b1c92d5a3f124a9001' },
      { doctorId: 'doc@med.com', doctorName: 'Dr. John Davis', roomNumber: 'Room 201', availability: '10:00 AM - 02:00 PM', days: 'Tue, Thu', hospitalId: '65f3d9b1c92d5a3f124a9001' }
    ]);
    console.log('✓ Doctor Schedules seeded.');

    // 11. Create System Setting
    const defaultSetting = new SystemSetting({
      platformName: 'MediSaaS Central Control',
      maintenanceMode: false,
      supportEmail: 'superadmin.support@medisaas.com',
      allowManualOnboarding: true,
      stripeEnabled: true,
      razorpayEnabled: true,
      taxRate: 18
    });
    await defaultSetting.save();
    console.log('✓ Global System settings configuration seeded.');

    // 12. Create Subscription Invoice
    await SubscriptionInvoice.insertMany([
      { hospitalName: 'City Care Hospital', planName: 'Enterprise Plan', amount: 59999, status: 'Paid', date: new Date().toISOString().split('T')[0], method: 'Manual Invoice' }
    ]);
    console.log('✓ Subscription revenue invoices seeded.');

    // 13. Create Platform Activity Logs
    await PlatformActivity.insertMany([
      { description: 'Global MediSaaS Platform initialization sequence completed successfully.', type: 'system', timestamp: new Date().toISOString() },
      { description: 'Default hospital node City Care Hospital successfully activated.', type: 'hospital', timestamp: new Date().toISOString() }
    ]);
    console.log('✓ Platform audit logs seeded.');

    console.log('\n======================================================');
    console.log('🎉 Local MongoDB database populated successfully!');
    console.log('======================================================');
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Seeding failed: ${error.message}`);
    process.exit(1);
  }
};

// Wait for connection to open then run seeder
mongoose.connection.once('open', seedDatabase);
