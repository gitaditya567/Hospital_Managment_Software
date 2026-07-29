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
    // Clear all existing collections (Removes all dummy data)
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

    console.log('Tables cleared. Seeding clean production configurations...');

    // 1. Seed Subscription Plans
    await Plan.insertMany([
      { id: 'plan-basic', name: 'Basic Plan', price: 9999, maxDoctors: 2, maxReceptionists: 1, maxPharmacists: 1, maxStorage: 10, durationMonths: 12 },
      { id: 'plan-pro', name: 'Pro Plan', price: 24999, maxDoctors: 10, maxReceptionists: 5, maxPharmacists: 3, maxStorage: 100, durationMonths: 12 },
      { id: 'plan-enterprise', name: 'Enterprise Plan', price: 59999, maxDoctors: -1, maxReceptionists: -1, maxPharmacists: -1, maxStorage: 500, durationMonths: 12 },
    ]);
    console.log('✓ Central Subscription Plans seeded.');

    // 2. Create central operator license codes (Unused)
    await LicenseCode.insertMany([
      { code: 'HMS-2026-001-R4#1%P', planId: 'plan-enterprise', validityMonths: 12, status: 'Unused', isUsed: false },
      { code: 'HMS-2026-002-X7@4!Q', planId: 'plan-pro', validityMonths: 6, status: 'Unused', isUsed: false },
      { code: 'HMS-2026-003-8B$9*M', planId: 'plan-basic', validityMonths: 12, status: 'Unused', isUsed: false }
    ]);
    console.log('✓ Cryptographic SaaS Licenses seeded.');

    // 3. Create default Super Admin user
    const superAdmin = new User({
      name: 'Super Operator',
      email: process.env.ADMIN_EMAIL || 'admin@smarthospital.com',
      password: process.env.ADMIN_PASSWORD || 'demo1234',
      role: 'SUPER_ADMIN',
      hospitalId: null,
      isActivated: true
    });
    await superAdmin.save();
    console.log(`✓ Default Super Admin user seeded (${superAdmin.email}).`);

    // 4. Create Global System Settings
    const defaultSetting = new SystemSetting({
      platformName: 'Smart Hospital Management Software - Central Operator',
      maintenanceMode: false,
      supportEmail: 'support@twinscloud.com',
      allowManualOnboarding: true,
      stripeEnabled: true,
      razorpayEnabled: true,
      taxRate: 18
    });
    await defaultSetting.save();
    console.log('✓ Global System settings configuration seeded.');

    // 5. Create Platform Activity Log
    await PlatformActivity.insertMany([
      { description: 'Smart Hospital Management Software initialization completed. Ready for hospital onboarding.', type: 'system', timestamp: new Date().toISOString() }
    ]);
    console.log('✓ Platform audit logs initialized.');

    console.log('\n======================================================');
    console.log('🎉 Clean production database initialized successfully!');
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
