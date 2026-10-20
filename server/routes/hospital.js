import express from 'express';
import crypto from 'crypto';
import { requireRole } from '../middleware/auth.js';
import { getHospitalStorageUsed, isObjectId } from '../utils/storage.js';
import { Staff } from '../models/Staff.js';
import { Department } from '../models/Department.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { Patient } from '../models/Patient.js';
import { Invoice } from '../models/Invoice.js';
import { Tenant } from '../models/Tenant.js';
import { LicenseCode } from '../models/LicenseCode.js';
import { User } from '../models/User.js';
import { Plan } from '../models/Plan.js';
import { SubscriptionInvoice } from '../models/SubscriptionInvoice.js';
import { PlatformActivity } from '../models/PlatformActivity.js';

export const hospitalRouter = express.Router();

const adminOnly = requireRole('HOSPITAL_ADMIN');
// Matches a document by id only inside the caller's own hospital
const scoped = (req, id) => ({ _id: isObjectId(id) ? id : null, hospitalId: req.hospitalId });

const findPlanForTenant = async (planId) => {
  if (!planId) return null;
  return await Plan.findOne({ $or: [{ id: planId }, { name: planId }] })
    || (isObjectId(planId) ? await Plan.findById(planId) : null);
};

const mapStaffRoleToUserRole = (staffRole) => {
  if (staffRole === 'Doctor') return 'DOCTOR';
  if (staffRole === 'Receptionist') return 'RECEPTIONIST';
  if (staffRole === 'Pharmacy') return 'PHARMACY';
  return 'DOCTOR'; // Default fallback
};

// ----------------------------------------------------
// 1. STAFF OPERATIONS
// ----------------------------------------------------

// Get all staff members for a hospital
hospitalRouter.get('/staff', async (req, res) => {
  const { hospitalId } = req.query;
  if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
  try {
    const staffList = await Staff.find({ hospitalId }).lean();
    const processed = staffList.map(s => {
      let history = s.roleHistory || [];
      if (!history || history.length === 0) {
        history = [{
          previousRole: 'Initial Assignment',
          newRole: s.role,
          updatedAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString()
        }];
      }
      return { ...s, roleHistory: history };
    });
    res.json(processed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a staff member (with subscription tier license validation!)
hospitalRouter.post('/staff', adminOnly, async (req, res) => {
  const { name, role, department, contact, personalEmail, hospitalId } = req.body;
  const email = String(req.body.email || '').trim();
  try {
    if (!name || !role || !email || !contact) {
      return res.status(400).json({ message: 'Name, role, email and contact number are required.' });
    }
    if (!['Doctor', 'Receptionist', 'Pharmacy'].includes(role)) {
      return res.status(400).json({ message: 'Role must be Doctor, Receptionist or Pharmacy.' });
    }
    if (!req.body.password || String(req.body.password).length < 6) {
      return res.status(400).json({ message: 'A login password of at least 6 characters is required for new staff.' });
    }
    if (await User.exists({ email: { $in: [email, email.toLowerCase()] } })) {
      return res.status(409).json({ message: `The login email "${email}" is already in use. Please choose a different email/username.` });
    }

    // Subscription limits check
    const tenant = await Tenant.findById(hospitalId);
    if (!tenant) {
      return res.status(404).json({ message: 'Central Tenant Registration not found.' });
    }

    // Query dynamic plan limits from MongoDB
    let maxDoc = -1;
    let maxRecep = -1;
    let maxPharm = -1;
    const planDoc = await findPlanForTenant(tenant.planId);
    if (planDoc) {
      maxDoc = planDoc.maxDoctors;
      maxRecep = planDoc.maxReceptionists;
      maxPharm = planDoc.maxPharmacists;
    }

    const currentCounts = await Staff.find({ hospitalId });
    
    if (role === 'Doctor' && maxDoc !== -1) {
      const activeDocs = currentCounts.filter(s => s.role === 'Doctor').length;
      if (activeDocs >= maxDoc) {
        return res.status(403).json({ 
          message: `CRITICAL LICENSE LIMIT: Your hospital's active plan limits you to maximum ${maxDoc} doctor accounts. Please contact Super Admin to upgrade.` 
        });
      }
    } else if (role === 'Receptionist' && maxRecep !== -1) {
      const activeReceps = currentCounts.filter(s => s.role === 'Receptionist').length;
      if (activeReceps >= maxRecep) {
        return res.status(403).json({ 
          message: `CRITICAL LICENSE LIMIT: Your hospital's active plan limits you to maximum ${maxRecep} receptionist accounts. Please contact Super Admin to upgrade.` 
        });
      }
    } else if (role === 'Pharmacy' && maxPharm !== -1) {
      const activePharms = currentCounts.filter(s => s.role === 'Pharmacy').length;
      if (activePharms >= maxPharm) {
        return res.status(403).json({ 
          message: `CRITICAL LICENSE LIMIT: Your hospital's active plan limits you to maximum ${maxPharm} pharmacist accounts. Please contact Super Admin to upgrade.` 
        });
      }
    }

    const initialHistory = [{
      previousRole: 'Initial Assignment',
      newRole: role,
      updatedAt: new Date().toISOString()
    }];

    const newStaff = new Staff({ name, role, department, contact, email, personalEmail: personalEmail || '', hospitalId, status: 'Active', roleHistory: initialHistory });
    await newStaff.save();

    // Dynamically generate credentials in User collection
    const userRole = mapStaffRoleToUserRole(role);
    try {
      const newUser = new User({
        name,
        email,
        personalEmail: personalEmail || email,
        password: String(req.body.password),
        role: userRole,
        hospitalId,
        isActivated: true // pre-activated under hospital license
      });
      await newUser.save();
    } catch (err) {
      await Staff.findByIdAndDelete(newStaff._id);
      throw err;
    }

    res.status(201).json(newStaff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update staff member
hospitalRouter.put('/staff/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, role, department, contact, email, personalEmail, password } = req.body;
  try {
    const oldStaff = await Staff.findOne(scoped(req, id));
    if (!oldStaff) return res.status(404).json({ message: 'Staff member not found.' });

    const oldEmail = oldStaff.email;
    if (email && email !== oldEmail && await User.exists({ email })) {
      return res.status(409).json({ message: `The login email "${email}" is already in use.` });
    }

    // Track role change history if role changed
    if (role && role !== oldStaff.role) {
      const currentRole = oldStaff.role;
      let history = Array.isArray(oldStaff.roleHistory) ? [...oldStaff.roleHistory] : [];

      if (history.length === 0) {
        history.push({
          previousRole: 'Initial Assignment',
          newRole: currentRole,
          updatedAt: oldStaff.createdAt ? new Date(oldStaff.createdAt).toISOString() : new Date().toISOString()
        });
      }

      history.push({
        previousRole: currentRole,
        newRole: role,
        updatedAt: new Date().toISOString()
      });

      oldStaff.roleHistory = history;
      oldStaff.markModified('roleHistory');
      oldStaff.role = role;
    }

    // Update staff fields
    oldStaff.name = name || oldStaff.name;
    oldStaff.department = department !== undefined ? department : oldStaff.department;
    oldStaff.contact = contact || oldStaff.contact;
    oldStaff.email = email || oldStaff.email;
    if (personalEmail !== undefined) oldStaff.personalEmail = personalEmail;
    if (req.body.status) oldStaff.status = req.body.status;

    await oldStaff.save();

    // Sync credentials to corresponding User account
    const userRole = mapStaffRoleToUserRole(oldStaff.role);
    const userAccount = await User.findOne({ email: oldEmail, hospitalId: oldStaff.hospitalId });

    if (userAccount) {
      userAccount.name = oldStaff.name;
      userAccount.email = oldStaff.email;
      if (personalEmail !== undefined) userAccount.personalEmail = personalEmail || oldStaff.email;
      userAccount.role = userRole;
      if (password && password.trim() !== '') {
        userAccount.password = password.trim();
      }
      await userAccount.save();
    } else {
      // Self-healing fallback if User profile was missing
      const newUser = new User({
        name: oldStaff.name,
        email: oldStaff.email,
        password: password || crypto.randomBytes(12).toString('hex'),
        role: userRole,
        hospitalId: oldStaff.hospitalId,
        isActivated: true
      });
      await newUser.save();
    }

    res.json(oldStaff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete staff member
hospitalRouter.delete('/staff/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Staff.findOne(scoped(req, id));
    if (!deleted) return res.status(404).json({ message: 'Staff member not found.' });

    const staffEmail = deleted.email;
    await Staff.findByIdAndDelete(id);

    // Securely remove their login credentials
    await User.deleteMany({ email: staffEmail, hospitalId: deleted.hospitalId, role: { $ne: 'HOSPITAL_ADMIN' } });

    res.json({ success: true, message: 'Staff member and associated login credentials removed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 2. DEPARTMENT OPERATIONS
// ----------------------------------------------------

hospitalRouter.get('/departments', async (req, res) => {
  const { hospitalId } = req.query;
  try {
    const query = hospitalId ? { hospitalId } : {};
    const list = await Department.find(query);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

hospitalRouter.post('/departments', adminOnly, async (req, res) => {
  const { name, head, rooms, status, beds, staffAssigned, hospitalId } = req.body;
  try {
    const newDept = new Department({
      name,
      head: head || 'Pending Assignment',
      rooms: rooms || '',
      staffCount: 0,
      beds: beds || '',
      staffAssigned: staffAssigned || '',
      status: head && head !== 'Pending Assignment' ? 'Active' : 'Setup Required',
      hospitalId
    });
    await newDept.save();
    res.status(201).json(newDept);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.put('/departments/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await Department.findOneAndUpdate(scoped(req, id), req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Department not found.' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.delete('/departments/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await Department.findOneAndDelete(scoped(req, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 3. SCHEDULE OPERATIONS
// ----------------------------------------------------

hospitalRouter.get('/schedules', async (req, res) => {
  const { hospitalId } = req.query;
  try {
    const query = hospitalId ? { hospitalId } : {};
    const list = await DoctorSchedule.find(query);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

hospitalRouter.post('/schedules', adminOnly, async (req, res) => {
  const { doctorId, doctorName, roomNumber, availability, days, hospitalId } = req.body;
  try {
    const newSched = new DoctorSchedule({ doctorId, doctorName, roomNumber, availability, days, hospitalId });
    await newSched.save();
    res.status(201).json(newSched);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.put('/schedules/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await DoctorSchedule.findOneAndUpdate(scoped(req, id), req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Schedule not found.' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.delete('/schedules/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await DoctorSchedule.findOneAndDelete(scoped(req, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 4. PATIENT LIVE OPD QUEUE OPERATIONS
// ----------------------------------------------------

hospitalRouter.get('/patients', async (req, res) => {
  const { hospitalId } = req.query;
  try {
    const query = hospitalId ? { hospitalId } : {};
    const list = await Patient.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

hospitalRouter.post('/patients', async (req, res) => {
  const { name, phone, age, gender, doctorName, hospitalId, vitals, pastDiagnoses, paymentStatus, payNow, appointmentTime, appointmentDate } = req.body;
  try {
    if (!name || !phone || age === undefined || age === '' || !doctorName) {
      return res.status(400).json({ message: 'Patient name, phone, age and doctor are required.' });
    }

    // Generate token number: count patients under this doctor today (tokens restart every day)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const doctorPatientsCount = await Patient.countDocuments({ hospitalId, doctorName, createdAt: { $gte: startOfDay } });
    const tokenNumber = `OPD-${101 + doctorPatientsCount}`;

    // Lookup existing patient to reuse patientNo, or generate a new unique one
    let patientNo;
    if (phone) {
      const existingPatient = await Patient.findOne({ hospitalId, phone, patientNo: { $exists: true, $ne: null } });
      if (existingPatient && existingPatient.patientNo) {
        patientNo = existingPatient.patientNo;
      }
    }
    
    if (!patientNo) {
      // Find highest existing PAT-XXXX sequence number for this hospital
      const lastPatientWithNo = await Patient.findOne({ 
        hospitalId, 
        patientNo: { $regex: /^PAT-\d+$/ } 
      }).sort({ createdAt: -1 });

      let nextSeq = 1001;
      if (lastPatientWithNo && lastPatientWithNo.patientNo) {
        const numMatch = lastPatientWithNo.patientNo.match(/\d+/);
        if (numMatch) {
          const parsedNum = parseInt(numMatch[0], 10);
          if (!isNaN(parsedNum)) {
            nextSeq = parsedNum + 1;
          }
        }
      } else {
        const totalCount = await Patient.countDocuments({ hospitalId });
        nextSeq = 1001 + totalCount;
      }

      let isUnique = false;
      while (!isUnique) {
        const candidate = `PAT-${nextSeq}`;
        const duplicate = await Patient.findOne({ hospitalId, patientNo: candidate });
        if (!duplicate) {
          patientNo = candidate;
          isUnique = true;
        } else {
          nextSeq += 1;
        }
      }
    }

    let pStatus = paymentStatus || (payNow === false ? 'Unpaid' : 'Paid');

    const newPatient = new Patient({
      name,
      patientNo,
      phone,
      age: Number(age),
      gender: gender || 'Male',
      doctorName,
      tokenNumber,
      timeRegistered: appointmentTime ? `Appt ${appointmentTime}` : 'Just now',
      status: 'Waiting',
      waitTime: '0m',
      vitals: vitals || [],
      pastDiagnoses: pastDiagnoses || '',
      paymentStatus: pStatus,
      appointmentTime: appointmentTime || '',
      appointmentDate: appointmentDate || '',
      hospitalId
    });

    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.put('/patients/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    if (!['Waiting', 'In Consultation', 'Completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid patient status.' });
    }
    const updated = await Patient.findOneAndUpdate(scoped(req, id), { status }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Patient not found.' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.delete('/patients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Patient.findOneAndDelete(scoped(req, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 5. BILLING & INVOICES OPERATIONS
// ----------------------------------------------------

// Helper function to generate sequential Invoice ID (INV-1001, INV-1002...)
const generateSequentialInvoiceNo = async (hospitalId) => {
  const count = await Invoice.countDocuments({ hospitalId });
  let nextSeq = 1001 + count;
  
  // Double-check highest existing invoice number to prevent duplicate collision
  const lastInvoice = await Invoice.findOne({ hospitalId, invoiceNo: { $regex: /^INV-/ } }).sort({ createdAt: -1 });
  if (lastInvoice && lastInvoice.invoiceNo) {
    const parsedNum = parseInt(lastInvoice.invoiceNo.replace('INV-', ''));
    if (!isNaN(parsedNum) && parsedNum >= nextSeq) {
      nextSeq = parsedNum + 1;
    }
  }
  return `INV-${nextSeq}`;
};

hospitalRouter.get('/invoices', async (req, res) => {
  const { hospitalId } = req.query;
  try {
    const query = hospitalId ? { hospitalId } : {};
    let list = await Invoice.find(query).sort({ createdAt: -1 }).lean();
    
    // Auto-fix legacy invoices without invoiceNo
    let counter = 1001;
    const processed = list.map((inv) => {
      if (!inv.invoiceNo) {
        inv.invoiceNo = `INV-${counter++}`;
      }
      return {
        ...inv,
        id: inv.invoiceNo || inv._id
      };
    });
    res.json(processed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

hospitalRouter.post('/invoices', async (req, res) => {
  const { patientName, patientPhone, amount, doctorName, feeType, hospitalId, status } = req.body;
  try {
    const dateString = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const invoiceNo = await generateSequentialInvoiceNo(hospitalId);
    
    const newInvoice = new Invoice({
      invoiceNo,
      patientName,
      patientPhone,
      amount: Number(amount),
      doctorName,
      feeType,
      date: dateString,
      status: status || 'Pending',
      hospitalId
    });
    await newInvoice.save();
    
    const responseObj = newInvoice.toObject();
    responseObj.id = invoiceNo;
    res.status(201).json(responseObj);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.put('/invoices/:id/collect', async (req, res) => {
  const { id } = req.params;
  try {
    // Support matching by _id OR invoiceNo
    const updated = await Invoice.findOneAndUpdate(
      { $or: [{ _id: isObjectId(id) ? id : null }, { invoiceNo: id }], hospitalId: req.hospitalId },
      { status: 'Paid' },
      { new: true }
    );
    if (updated) {
      await Patient.updateMany(
        { hospitalId: updated.hospitalId, phone: updated.patientPhone, paymentStatus: { $ne: 'Paid' } },
        { paymentStatus: 'Paid' }
      );
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.put('/patients/:id/collect-fee', async (req, res) => {
  const { id } = req.params;
  const { amount, feeType } = req.body;
  try {
    const patient = await Patient.findOne(scoped(req, id));
    if (!patient) return res.status(404).json({ message: 'Patient profile not found.' });

    patient.paymentStatus = 'Paid';
    await patient.save();

    // Sync or create invoice
    const existingInvoice = await Invoice.findOne({
      hospitalId: patient.hospitalId,
      patientPhone: patient.phone,
      status: 'Pending'
    });

    if (existingInvoice) {
      existingInvoice.status = 'Paid';
      await existingInvoice.save();
    } else {
      const dateString = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const invoiceNo = await generateSequentialInvoiceNo(patient.hospitalId);
      
      const newInvoice = new Invoice({
        invoiceNo,
        patientName: patient.name,
        patientPhone: patient.phone,
        amount: Number(amount) || 500,
        doctorName: patient.doctorName,
        feeType: feeType || 'OPD Consultation Fee',
        date: dateString,
        status: 'Paid',
        hospitalId: patient.hospitalId
      });
      await newInvoice.save();
    }

    res.json({ message: 'Consultation fee collected. Patient activated into Doctor Queue.', patient });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 6. STANDARD FEES CONFIG OPERATIONS
// ----------------------------------------------------

hospitalRouter.get('/fees', async (req, res) => {
  const { hospitalId } = req.query;
  try {
    const tenant = await Tenant.findById(hospitalId);
    if (!tenant) {
      // Return defaults if no tenant found
      return res.json({ opdFee: 500, emergencyFee: 1200, bedChargePerDay: 2500 });
    }
    
    // Check if the tenant document already has fee settings, otherwise return default config
    const fees = {
      opdFee: tenant.opdFee || 500,
      emergencyFee: tenant.emergencyFee || 1200,
      bedChargePerDay: tenant.bedChargePerDay || 2500
    };
    res.json(fees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

hospitalRouter.put('/fees', adminOnly, async (req, res) => {
  const { hospitalId, opdFee, emergencyFee, bedChargePerDay } = req.body;
  try {
    const updatedTenant = await Tenant.findByIdAndUpdate(
      hospitalId, 
      { opdFee, emergencyFee, bedChargePerDay },
      { new: true }
    );
    if (!updatedTenant) return res.status(404).json({ message: 'Hospital Tenant not found.' });
    
    res.json({
      opdFee: updatedTenant.opdFee || 500,
      emergencyFee: updatedTenant.emergencyFee || 1200,
      bedChargePerDay: updatedTenant.bedChargePerDay || 2500
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET staff profile by email (Doctor profile)
hospitalRouter.get('/staff/profile/details', async (req, res) => {
  const { email, hospitalId } = req.query;
  if (!email) return res.status(400).json({ message: 'email is required' });
  try {
    const staff = await Staff.findOne({ email, hospitalId });
    if (!staff) {
      return res.status(404).json({ message: 'Staff member profile not found.' });
    }
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UPDATE staff profile by email (Doctor profile)
hospitalRouter.put('/staff/profile/details', async (req, res) => {
  const { email, hospitalId, name, department, contact, consultationFee, licenseNo, signature, status } = req.body;
  if (!email) return res.status(400).json({ message: 'email is required' });
  if (req.user.role !== 'HOSPITAL_ADMIN' && email !== req.user.email) {
    return res.status(403).json({ message: 'You can only update your own profile.' });
  }
  try {
    const staff = await Staff.findOne({ email, hospitalId });
    if (!staff) {
      return res.status(404).json({ message: 'Staff member profile not found.' });
    }

    staff.name = name || staff.name;
    staff.department = department !== undefined ? department : staff.department;
    staff.contact = contact || staff.contact;
    staff.consultationFee = consultationFee !== undefined ? Number(consultationFee) : staff.consultationFee;
    staff.licenseNo = licenseNo !== undefined ? licenseNo : staff.licenseNo;
    staff.signature = signature !== undefined ? signature : staff.signature;
    if (status !== undefined) staff.status = status;

    await staff.save();

    // Sync user collection name
    const userAcc = await User.findOne({ email, hospitalId });
    if (userAcc) {
      userAcc.name = staff.name;
      await userAcc.save();
    }

    res.json(staff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET Hospital Profile details by hospitalId
hospitalRouter.get('/profile', async (req, res) => {
  const { hospitalId } = req.query;
  if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
  try {
    const tenant = await Tenant.findById(hospitalId);
    if (!tenant) return res.status(404).json({ message: 'Hospital organization not found.' });

    const license = await LicenseCode.findOne({ code: tenant.licenseCodeUsed });
    const targetPlanId = (license && license.planId) || tenant.planId;

    let plan = await findPlanForTenant(targetPlanId);
    if (!plan && tenant.planId) {
      plan = await Plan.findOne({ $or: [{ id: tenant.planId }, { name: tenant.planId }] });
    }
    if (!plan) {
      plan = await Plan.findOne({ id: 'plan-basic' }) || await Plan.findOne({});
    }

    // Auto-heal data sync between license and tenant
    if (license && license.planId && tenant.planId !== license.planId) {
      tenant.planId = license.planId;
      await tenant.save();
    }

    res.json({
      id: tenant._id.toString(),
      hospitalName: tenant.hospitalName,
      adminEmail: tenant.adminEmail,
      adminPhone: tenant.adminPhone,
      address: tenant.address,
      hospitalLogo: tenant.hospitalLogo || '',
      licenseCodeUsed: tenant.licenseCodeUsed,
      subscriptionExpiryDate: tenant.subscriptionExpiryDate,
      status: tenant.status,
      planName: plan ? plan.name : 'Basic Plan',
      planId: tenant.planId,
      maxDoctors: plan ? plan.maxDoctors : 2,
      maxReceptionists: plan ? plan.maxReceptionists : 1,
      maxPharmacists: plan ? plan.maxPharmacists : 1,
      maxStorage: plan ? plan.maxStorage : 10,
      isTrial: !!tenant.isTrial,
      validityMonths: license ? license.validityMonths : 12,
      createdAt: tenant.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UPDATE Hospital Profile details
hospitalRouter.put('/profile', adminOnly, async (req, res) => {
  const { hospitalId, hospitalName, adminPhone, address, hospitalLogo } = req.body;
  if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
  try {
    const tenant = await Tenant.findById(hospitalId);
    if (!tenant) return res.status(404).json({ message: 'Hospital organization not found.' });

    if (hospitalName !== undefined) tenant.hospitalName = hospitalName;
    if (adminPhone !== undefined) tenant.adminPhone = adminPhone;
    if (address !== undefined) tenant.address = address;
    if (hospitalLogo !== undefined) tenant.hospitalLogo = hospitalLogo;

    await tenant.save();
    res.json({ success: true, message: 'Hospital profile updated successfully.', tenant });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Renew Hospital Subscription Plan using a License Code
hospitalRouter.post('/renew-subscription', adminOnly, async (req, res) => {
  const { hospitalId, licenseCode } = req.body;
  if (!hospitalId || !licenseCode) {
    return res.status(400).json({ message: 'Hospital ID and License Code are required.' });
  }

  try {
    const cleanCode = licenseCode.trim();
    const license = await LicenseCode.findOne({ code: cleanCode });
    if (!license) {
      return res.status(404).json({ message: `License Code "${cleanCode}" is invalid.` });
    }

    if (license.isUsed) {
      return res.status(400).json({ message: `License Code "${cleanCode}" has already been used.` });
    }

    if (license.status === 'Expired') {
      return res.status(400).json({ message: `License Code "${cleanCode}" has expired.` });
    }

    const tenant = await Tenant.findById(hospitalId);
    if (!tenant) {
      return res.status(404).json({ message: 'Hospital organization not found.' });
    }

    const targetPlan = await Plan.findOne({ id: license.planId }) || await Plan.findOne({ name: license.planId });
    const validityMonths = license.validityMonths || (targetPlan ? targetPlan.durationMonths : 12);

    let baseDate = new Date();
    if (tenant.subscriptionExpiryDate) {
      const currentExpiry = new Date(tenant.subscriptionExpiryDate);
      if (currentExpiry > baseDate) {
        baseDate = currentExpiry;
      }
    }
    baseDate.setMonth(baseDate.getMonth() + validityMonths);
    const newExpiryStr = baseDate.toISOString().split('T')[0];

    tenant.licenseCodeUsed = cleanCode;
    tenant.subscriptionExpiryDate = newExpiryStr;
    if (license.planId) {
      tenant.planId = license.planId;
    }
    tenant.status = 'Active';
    tenant.isTrial = false;
    await tenant.save();

    license.isUsed = true;
    license.status = 'Used';
    license.activatedByHospitalId = hospitalId;
    await license.save();

    const inv = new SubscriptionInvoice({
      hospitalName: tenant.hospitalName,
      hospitalId: tenant._id.toString(),
      planName: targetPlan ? targetPlan.name : 'Subscription Renewal',
      amount: targetPlan ? targetPlan.price : 0,
      method: 'Manual Invoice',
      status: 'Paid',
      date: new Date().toISOString().split('T')[0]
    });
    await inv.save();

    const activity = new PlatformActivity({
      description: `Hospital "${tenant.hospitalName}" renewed subscription using License "${cleanCode}". New expiry: ${newExpiryStr}.`,
      type: 'license',
      timestamp: new Date().toISOString()
    });
    await activity.save();

    res.json({
      success: true,
      message: `Subscription successfully renewed! Valid until ${newExpiryStr}.`,
      newExpiryDate: newExpiryStr,
      planName: targetPlan ? targetPlan.name : 'Active Plan',
      tenant
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});




// Subscription overview for the hospital billing & staff pages (own hospital only)
hospitalRouter.get('/subscription', async (req, res) => {
  try {
    const tenant = req.tenant;
    const [plans, staffCount, storageUsed] = await Promise.all([
      Plan.find({}).sort({ price: 1 }).lean(),
      Staff.countDocuments({ hospitalId: req.hospitalId }),
      getHospitalStorageUsed(req.hospitalId)
    ]);
    const invoices = req.user.role === 'HOSPITAL_ADMIN'
      ? await SubscriptionInvoice.find({
          $or: [{ hospitalId: req.hospitalId }, { hospitalId: null, hospitalName: tenant.hospitalName }]
        }).sort({ createdAt: -1 }).lean()
      : [];

    res.json({
      tenant: {
        id: tenant._id.toString(),
        hospitalName: tenant.hospitalName,
        adminEmail: tenant.adminEmail,
        adminPhone: tenant.adminPhone || '',
        address: tenant.address,
        status: tenant.status,
        licenseCodeUsed: tenant.licenseCodeUsed,
        subscriptionExpiryDate: tenant.subscriptionExpiryDate,
        planId: tenant.planId,
        isTrial: !!tenant.isTrial,
        staffCreated: staffCount,
        storageUsed,
        createdAt: tenant.createdAt
      },
      subscription: req.subscription,
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        maxDoctors: p.maxDoctors,
        maxReceptionists: p.maxReceptionists,
        maxPharmacists: p.maxPharmacists,
        maxStorage: p.maxStorage,
        durationMonths: p.durationMonths
      })),
      invoices: invoices.map(inv => ({
        id: inv._id.toString(),
        hospitalName: inv.hospitalName,
        planName: inv.planName,
        amount: inv.amount,
        status: inv.status,
        date: inv.date,
        method: inv.method
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
