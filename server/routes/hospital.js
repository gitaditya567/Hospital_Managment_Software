import express from 'express';
import { Staff } from '../models/Staff.js';
import { Department } from '../models/Department.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { Patient } from '../models/Patient.js';
import { Invoice } from '../models/Invoice.js';
import { Tenant } from '../models/Tenant.js';
import { LicenseCode } from '../models/LicenseCode.js';
import { User } from '../models/User.js';

export const hospitalRouter = express.Router();

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
    const staffList = await Staff.find({ hospitalId });
    res.json(staffList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a staff member (with subscription tier license validation!)
hospitalRouter.post('/staff', async (req, res) => {
  const { name, role, department, contact, email, hospitalId } = req.body;
  try {
    // Subscription limits check
    const tenant = await Tenant.findById(hospitalId);
    if (!tenant) {
      return res.status(404).json({ message: 'Central Tenant Registration not found.' });
    }

    // Determine plan limits
    let maxDoc = -1;
    let maxRecep = -1;
    let maxPharm = -1;
    const plan = tenant.planId;
    
    if (plan === 'plan-basic') {
      maxDoc = 2; maxRecep = 1; maxPharm = 1;
    } else if (plan === 'plan-pro') {
      maxDoc = 10; maxRecep = 5; maxPharm = 3;
    } // plan-enterprise has unlimited (-1)

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

    const newStaff = new Staff({ name, role, department, contact, email, hospitalId, status: 'Active' });
    await newStaff.save();

    // Dynamically generate credentials in User collection
    const userRole = mapStaffRoleToUserRole(role);
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      const newUser = new User({
        name,
        email,
        password: req.body.password || 'demo1234',
        role: userRole,
        hospitalId,
        isActivated: true // pre-activated under hospital license
      });
      await newUser.save();
    }

    res.status(201).json(newStaff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update staff member
hospitalRouter.put('/staff/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, department, contact, email, password } = req.body;
  try {
    const oldStaff = await Staff.findById(id);
    if (!oldStaff) return res.status(404).json({ message: 'Staff member not found.' });

    const oldEmail = oldStaff.email;

    // Update staff fields
    oldStaff.name = name || oldStaff.name;
    oldStaff.role = role || oldStaff.role;
    oldStaff.department = department !== undefined ? department : oldStaff.department;
    oldStaff.contact = contact || oldStaff.contact;
    oldStaff.email = email || oldStaff.email;
    if (req.body.status) oldStaff.status = req.body.status;

    await oldStaff.save();

    // Sync credentials to corresponding User account
    const userRole = mapStaffRoleToUserRole(oldStaff.role);
    const userAccount = await User.findOne({ email: oldEmail });

    if (userAccount) {
      userAccount.name = oldStaff.name;
      userAccount.email = oldStaff.email;
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
        password: password || 'demo1234',
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
hospitalRouter.delete('/staff/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Staff.findById(id);
    if (!deleted) return res.status(404).json({ message: 'Staff member not found.' });

    const staffEmail = deleted.email;
    await Staff.findByIdAndDelete(id);

    // Securely remove their login credentials
    await User.deleteMany({ email: staffEmail });

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

hospitalRouter.post('/departments', async (req, res) => {
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

hospitalRouter.put('/departments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await Department.findByIdAndUpdate(id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.delete('/departments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Department.findByIdAndDelete(id);
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

hospitalRouter.post('/schedules', async (req, res) => {
  const { doctorId, doctorName, roomNumber, availability, days, hospitalId } = req.body;
  try {
    const newSched = new DoctorSchedule({ doctorId, doctorName, roomNumber, availability, days, hospitalId });
    await newSched.save();
    res.status(201).json(newSched);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.put('/schedules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await DoctorSchedule.findByIdAndUpdate(id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.delete('/schedules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await DoctorSchedule.findByIdAndDelete(id);
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
  const { name, phone, age, gender, doctorName, hospitalId, vitals, pastDiagnoses } = req.body;
  try {
    // Generate token number: count patients under this doctor today
    const doctorPatientsCount = await Patient.countDocuments({ hospitalId, doctorName });
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
      let isUnique = false;
      while (!isUnique) {
        const candidate = `PAT-${Math.floor(10000 + Math.random() * 90000)}`;
        const duplicate = await Patient.findOne({ hospitalId, patientNo: candidate });
        if (!duplicate) {
          patientNo = candidate;
          isUnique = true;
        }
      }
    }

    const newPatient = new Patient({
      name,
      patientNo,
      phone,
      age: Number(age),
      gender: gender || 'Male',
      doctorName,
      tokenNumber,
      timeRegistered: 'Just now',
      status: 'Waiting',
      waitTime: '0m',
      vitals: vitals || [],
      pastDiagnoses: pastDiagnoses || '',
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
    const updated = await Patient.findByIdAndUpdate(id, { status }, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.delete('/patients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Patient.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 5. BILLING & INVOICES OPERATIONS
// ----------------------------------------------------

hospitalRouter.get('/invoices', async (req, res) => {
  const { hospitalId } = req.query;
  try {
    const query = hospitalId ? { hospitalId } : {};
    const list = await Invoice.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

hospitalRouter.post('/invoices', async (req, res) => {
  const { patientName, patientPhone, amount, doctorName, feeType, hospitalId, status } = req.body;
  try {
    const dateString = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const newInvoice = new Invoice({
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
    res.status(201).json(newInvoice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.put('/invoices/:id/collect', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await Invoice.findByIdAndUpdate(id, { status: 'Paid' }, { new: true });
    res.json(updated);
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

hospitalRouter.put('/fees', async (req, res) => {
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

// GET hospital tenant profile
hospitalRouter.get('/profile', async (req, res) => {
  const { hospitalId } = req.query;
  if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
  try {
    const tenant = await Tenant.findById(hospitalId);
    if (!tenant) {
      return res.json({ id: hospitalId, hospitalName: 'City Care Hospital' });
    }
    res.json({
      id: tenant._id.toString(),
      hospitalName: tenant.hospitalName,
      adminEmail: tenant.adminEmail,
      adminPhone: tenant.adminPhone || '',
      address: tenant.address,
      licenseCodeUsed: tenant.licenseCodeUsed,
      subscriptionExpiryDate: tenant.subscriptionExpiryDate,
      planId: tenant.planId,
      status: tenant.status
    });
  } catch (error) {
    // If ObjectId format invalid or tenant not found, fallback gracefully
    res.json({ id: hospitalId, hospitalName: 'City Care Hospital' });
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
    const userAcc = await User.findOne({ email });
    if (userAcc) {
      userAcc.name = staff.name;
      await userAcc.save();
    }

    res.json(staff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

