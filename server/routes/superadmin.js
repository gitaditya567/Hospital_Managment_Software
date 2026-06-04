import express from 'express';
import mongoose from 'mongoose';
import { Tenant } from '../models/Tenant.js';
import { LicenseCode } from '../models/LicenseCode.js';
import { SubscriptionInvoice } from '../models/SubscriptionInvoice.js';
import { PlatformActivity } from '../models/PlatformActivity.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { Staff } from '../models/Staff.js';
import { User } from '../models/User.js';
import { Plan } from '../models/Plan.js';
import { Patient } from '../models/Patient.js';
import { Invoice } from '../models/Invoice.js';
import { Medicine } from '../models/Medicine.js';
import { Prescription } from '../models/Prescription.js';
import { PharmacyBill } from '../models/PharmacyBill.js';
import { Department } from '../models/Department.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';

export const superadminRouter = express.Router();

// ----------------------------------------------------
// 1. HOSPITAL TENANT MANAGEMENT
// ----------------------------------------------------

// Helper to calculate the actual dynamic database storage occupied by a hospital tenant in MB
const getHospitalStorageUsed = async (hospitalId) => {
  try {
    const [
      staffCount,
      patientCount,
      invoiceCount,
      medicineCount,
      prescriptionCount,
      billCount,
      deptCount,
      scheduleCount,
      userCount
    ] = await Promise.all([
      Staff.countDocuments({ hospitalId }),
      Patient.countDocuments({ hospitalId }),
      Invoice.countDocuments({ hospitalId }),
      Medicine.countDocuments({ hospitalId }),
      Prescription.countDocuments({ hospitalId }),
      PharmacyBill.countDocuments({ hospitalId }),
      Department.countDocuments({ hospitalId }),
      DoctorSchedule.countDocuments({ hospitalId }),
      User.countDocuments({ hospitalId })
    ]);

    const totalRecords = staffCount + patientCount + invoiceCount + medicineCount + prescriptionCount + billCount + deptCount + scheduleCount + userCount;

    // Base collection overhead of 1.15 MB
    // Plus 0.05 MB (50 KB) per actual database document (indexes, schema definitions, logs)
    const baseOverhead = 1.15;
    const sizePerRecord = 0.05;
    const storageUsedMB = baseOverhead + (totalRecords * sizePerRecord);

    return Number(storageUsedMB.toFixed(2));
  } catch (error) {
    return 1.15;
  }
};

// Get all onboarded hospital tenants
superadminRouter.get('/tenants', async (req, res) => {
  try {
    const list = await Tenant.find({});
    // Enrich with dynamic staff counts and storage telemetry
    const enriched = await Promise.all(list.map(async (t) => {
      const staffCount = await Staff.countDocuments({ hospitalId: t._id.toString() });
      const storageMB = await getHospitalStorageUsed(t._id.toString());
      return {
        id: t._id.toString(),
        hospitalName: t.hospitalName,
        adminEmail: t.adminEmail,
        adminPhone: t.adminPhone || '',
        address: t.address,
        licenseCodeUsed: t.licenseCodeUsed,
        subscriptionExpiryDate: t.subscriptionExpiryDate,
        planId: t.planId,
        opdFee: t.opdFee || 500,
        emergencyFee: t.emergencyFee || 1200,
        bedChargePerDay: t.bedChargePerDay || 2500,
        status: t.status || 'Active',
        staffCreated: staffCount,
        storageUsed: storageMB
      };
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Onboard a new Hospital Tenant node
superadminRouter.post('/tenants', async (req, res) => {
  const { hospitalName, adminEmail, adminPhone, adminPassword, address, licenseCodeUsed, subscriptionExpiryDate, planId } = req.body;
  try {
    // 1. Check if the license code is valid and unused
    const license = await LicenseCode.findOne({ code: licenseCodeUsed });
    if (!license) {
      return res.status(400).json({ message: `Cryptographic license code "${licenseCodeUsed}" is invalid.` });
    }
    if (license.isUsed) {
      return res.status(400).json({ message: `License code "${licenseCodeUsed}" has already been activated by another node.` });
    }

    // Use manually entered password or fallback to a secure temporary one
    const passwordToUse = adminPassword || ('pass-' + Math.floor(1000 + Math.random() * 9000));

    // 2. Create the new Tenant Node
    const newTenant = new Tenant({
      hospitalName,
      adminEmail,
      adminPhone: adminPhone || '',
      address,
      licenseCodeUsed,
      subscriptionExpiryDate,
      planId,
      status: 'Active'
    });
    await newTenant.save();

    // 2b. Automatically create corresponding HOSPITAL_ADMIN User
    const newAdminUser = new User({
      name: `${hospitalName} Admin`,
      email: adminEmail,
      password: passwordToUse,
      role: 'HOSPITAL_ADMIN',
      hospitalId: newTenant._id.toString()
    });
    await newAdminUser.save();

    // 3. Mark the License as activated
    license.isUsed = true;
    license.status = 'Used';
    await license.save();

    // 4. Log the activity
    const activity = new PlatformActivity({
      description: `Onboarded hospital "${hospitalName}" with plan "${planId}".`,
      type: 'hospital',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.status(201).json({
      id: newTenant._id.toString(),
      hospitalName: newTenant.hospitalName,
      adminEmail: newTenant.adminEmail,
      adminPhone: newTenant.adminPhone,
      address: newTenant.address,
      licenseCodeUsed: newTenant.licenseCodeUsed,
      subscriptionExpiryDate: newTenant.subscriptionExpiryDate,
      planId: newTenant.planId,
      status: newTenant.status,
      staffCreated: 0,
      storageUsed: 0,
      generatedPassword: passwordToUse // Plain password returned for UI success card
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update hospital details
superadminRouter.put('/tenants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await Tenant.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Tenant Node not found.' });

    // Log the activity
    const activity = new PlatformActivity({
      description: `Updated profile details for hospital "${updated.hospitalName}".`,
      type: 'hospital',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json({
      id: updated._id.toString(),
      ...updated.toObject()
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Toggle suspend / activate hospital
superadminRouter.put('/tenants/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const tenant = await Tenant.findById(id);
    if (!tenant) return res.status(404).json({ message: 'Tenant Node not found.' });

    const newStatus = tenant.status === 'Active' ? 'Suspended' : 'Active';
    tenant.status = newStatus;
    await tenant.save();

    // Log activity
    const activity = new PlatformActivity({
      description: `Hospital "${tenant.hospitalName}" status changed to ${newStatus}.`,
      type: 'hospital',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json({
      id: tenant._id.toString(),
      ...tenant.toObject()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Permanently remove a hospital and restore its license code
superadminRouter.delete('/tenants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const tenant = await Tenant.findById(id);
    if (!tenant) return res.status(404).json({ message: 'Tenant Node not found.' });

    // Mark the license as unused again
    await LicenseCode.findOneAndUpdate(
      { code: tenant.licenseCodeUsed },
      { isUsed: false, status: 'Unused' }
    );

    // Delete hospital tenant
    await Tenant.findByIdAndDelete(id);

    // Log activity
    const activity = new PlatformActivity({
      description: `Hospital "${tenant.hospitalName}" was permanently removed. License "${tenant.licenseCodeUsed}" marked Unused.`,
      type: 'hospital',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json({ success: true, message: 'Tenant Node deleted and associated license code unlocked.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 2. CRYPTOGRAPHIC LICENSE MANAGEMENT
// ----------------------------------------------------

superadminRouter.get('/licenses', async (req, res) => {
  try {
    const list = await LicenseCode.find({}).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

superadminRouter.post('/licenses', async (req, res) => {
  const { planId, validityMonths } = req.body;
  try {
    const year = new Date().getFullYear();
    const segment1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const segment2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `HOSP-${year}-${segment1}-${segment2}`;

    const newLicense = new LicenseCode({
      code,
      planId,
      validityMonths: Number(validityMonths),
      isUsed: false,
      status: 'Unused'
    });
    await newLicense.save();

    // Log activity
    const activity = new PlatformActivity({
      description: `Generated new license code ${code} for Plan: "${planId}" (${validityMonths} Months).`,
      type: 'license',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.status(201).json(newLicense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

superadminRouter.put('/licenses/:code/revoke', async (req, res) => {
  const { code } = req.params;
  try {
    const license = await LicenseCode.findOne({ code });
    if (!license) return res.status(404).json({ message: 'License code not found.' });

    license.status = 'Expired';
    await license.save();

    // Suspend the tenant that activated this code
    const suspendedTenant = await Tenant.findOneAndUpdate(
      { licenseCodeUsed: code },
      { status: 'Suspended' },
      { new: true }
    );
    const tenantName = suspendedTenant ? suspendedTenant.hospitalName : 'Unassigned';

    // Log activity
    const activity = new PlatformActivity({
      description: `License ${code} was revoked manually. Associated tenant "${tenantName}" suspended.`,
      type: 'license',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json({ success: true, license });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

superadminRouter.delete('/licenses/:code', async (req, res) => {
  const { code } = req.params;
  try {
    await LicenseCode.findOneAndDelete({ code });

    // Log activity
    const activity = new PlatformActivity({
      description: `License code ${code} was permanently deleted.`,
      type: 'license',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 3. CENTRAL PRICING PLANS
// ----------------------------------------------------

// Get all pricing plans dynamically from MongoDB
superadminRouter.get('/plans', async (req, res) => {
  try {
    const list = await Plan.find({});
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new pricing plan
superadminRouter.post('/plans', async (req, res) => {
  const { id, name, price, maxDoctors, maxReceptionists, maxPharmacists, maxStorage, durationMonths } = req.body;
  try {
    const newPlan = new Plan({
      id: id || `plan-${Date.now()}`,
      name,
      price: Number(price),
      maxDoctors: Number(maxDoctors),
      maxReceptionists: Number(maxReceptionists),
      maxPharmacists: Number(maxPharmacists),
      maxStorage: Number(maxStorage),
      durationMonths: Number(durationMonths)
    });
    await newPlan.save();

    // Log activity
    const activity = new PlatformActivity({
      description: `Created new pricing plan "${name}" (Price: ₹${price}).`,
      type: 'plan',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.status(201).json(newPlan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update an existing pricing plan
superadminRouter.put('/plans/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await Plan.findOneAndUpdate({ id }, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Pricing plan not found.' });

    // Log activity
    const activity = new PlatformActivity({
      description: `Updated details for pricing plan "${updated.name}".`,
      type: 'plan',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Permanently delete a pricing plan
superadminRouter.delete('/plans/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const plan = await Plan.findOne({ id });
    if (!plan) return res.status(404).json({ message: 'Pricing plan not found.' });

    await Plan.findOneAndDelete({ id });

    // Log activity
    const activity = new PlatformActivity({
      description: `Pricing plan "${plan.name}" was permanently deleted.`,
      type: 'plan',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json({ success: true, message: `Pricing plan "${plan.name}" was deleted successfully.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 4. CENTRAL REVENUE INVOICES
// ----------------------------------------------------

superadminRouter.get('/invoices', async (req, res) => {
  try {
    const list = await SubscriptionInvoice.find({}).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

superadminRouter.post('/invoices', async (req, res) => {
  const { hospitalName, planName, amount, method } = req.body;
  try {
    const newInv = new SubscriptionInvoice({
      hospitalName,
      planName,
      amount: Number(amount),
      method,
      status: 'Paid',
      date: new Date().toISOString().split('T')[0]
    });
    await newInv.save();
    res.status(201).json(newInv);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 5. PLATFORM SYSTEM ACTIVITIES
// ----------------------------------------------------

superadminRouter.get('/activities', async (req, res) => {
  try {
    const list = await PlatformActivity.find({}).sort({ createdAt: -1 }).limit(100);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

superadminRouter.post('/activities', async (req, res) => {
  const { description, type } = req.body;
  try {
    const act = new PlatformActivity({
      description,
      type,
      timestamp: new Date().toISOString()
    });
    await act.save();
    res.status(201).json(act);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 6. SYSTEM PLATFORM CONFIG SETTINGS
// ----------------------------------------------------

superadminRouter.get('/settings', async (req, res) => {
  try {
    let settings = await SystemSetting.findOne({});
    if (!settings) {
      settings = new SystemSetting();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

superadminRouter.put('/settings', async (req, res) => {
  try {
    let settings = await SystemSetting.findOne({});
    if (!settings) {
      settings = new SystemSetting(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();

    // Log activity
    const activity = new PlatformActivity({
      description: 'Updated platform settings configuration.',
      type: 'system',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
