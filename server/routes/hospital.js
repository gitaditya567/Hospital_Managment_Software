import express from 'express';
import crypto from 'crypto';
import { requireRole } from '../middleware/auth.js';
import { getHospitalStorageUsed, isObjectId, escapeRegex } from '../utils/storage.js';
import { Staff } from '../models/Staff.js';
import { Department } from '../models/Department.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { Patient } from '../models/Patient.js';
import { Invoice } from '../models/Invoice.js';
import { Appointment } from '../models/Appointment.js';
import { Tenant } from '../models/Tenant.js';
import { LicenseCode } from '../models/LicenseCode.js';
import { User } from '../models/User.js';
import { Plan } from '../models/Plan.js';
import { SubscriptionInvoice } from '../models/SubscriptionInvoice.js';
import { PlatformActivity } from '../models/PlatformActivity.js';
import { Prescription } from '../models/Prescription.js';
import { PharmacyBill } from '../models/PharmacyBill.js';
import { Medicine } from '../models/Medicine.js';

export const hospitalRouter = express.Router();

const adminOnly = requireRole('HOSPITAL_ADMIN');
// Matches a document by id only inside the caller's own hospital
const scoped = (req, id) => ({ _id: isObjectId(id) ? id : null, hospitalId: req.hospitalId });

// Doctor names are compared without the "Dr." title, spacing or case
const normName = (n) => String(n || '').toLowerCase().replace(/^\s*dr(\.\s*|\s+)/, '').replace(/\s+/g, ' ').trim();

// Keep the doctor's queue, bookings, schedule and prescriptions attached after a rename
const cascadeDoctorRename = async (hospitalId, oldName, newName) => {
  if (!oldName || !newName || oldName === newName) return;
  await Promise.all([
    Patient.updateMany({ hospitalId, doctorName: oldName }, { doctorName: newName }),
    Appointment.updateMany({ hospitalId, doctorName: oldName }, { doctorName: newName }),
    DoctorSchedule.updateMany({ hospitalId, doctorName: oldName }, { doctorName: newName }),
    Invoice.updateMany({ hospitalId, doctorName: oldName }, { doctorName: newName }),
    Prescription.updateMany({ hospitalId, doctorName: oldName }, { doctorName: newName })
  ]);
};

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
    const previousName = oldStaff.name;
    oldStaff.name = name || oldStaff.name;
    oldStaff.department = department !== undefined ? department : oldStaff.department;
    oldStaff.contact = contact || oldStaff.contact;
    oldStaff.email = email || oldStaff.email;
    if (personalEmail !== undefined) oldStaff.personalEmail = personalEmail;
    if (req.body.status) oldStaff.status = req.body.status;

    await oldStaff.save();
    if (oldStaff.role === 'Doctor') await cascadeDoctorRename(oldStaff.hospitalId, previousName, oldStaff.name);

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

const invoiceDateString = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const PAYMENT_MODES = ['Cash', 'UPI', 'Card'];
const cleanPaymentMode = (mode) => (PAYMENT_MODES.includes(mode) ? mode : '');

// Same phone + same name (case-insensitive) is the same person; family members sharing a phone get their own number
const findPatientNo = async (hospitalId, phone, name) => {
  const existing = await Patient.findOne({
    hospitalId,
    phone,
    name: { $regex: new RegExp(`^\\s*${escapeRegex(String(name).trim())}\\s*$`, 'i') },
    patientNo: { $exists: true, $ne: null }
  }).sort({ createdAt: -1 });
  if (existing && existing.patientNo) return existing.patientNo;

  const numbered = await Patient.find({ hospitalId, patientNo: { $regex: /^PAT-\d+$/ } }).select('patientNo').lean();
  const highest = numbered.reduce((max, p) => Math.max(max, parseInt(p.patientNo.slice(4), 10) || 0), 1000);
  return `PAT-${highest + 1}`;
};

const nextTokenNumber = async (hospitalId, doctorName) => {
  // Tokens restart every day for each doctor
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = await Patient.countDocuments({ hospitalId, doctorName, createdAt: { $gte: startOfDay } });
  return `OPD-${101 + todayCount}`;
};

// Creates today's OPD visit and (optionally) its fee invoice in one step
const createOpdVisit = async (hospitalId, data) => {
  const { name, phone, age, gender, doctorName, vitals, pastDiagnoses, appointmentTime, appointmentDate, fee } = data;
  if (!name || !phone || age === undefined || age === '' || !doctorName) {
    const err = new Error('Patient name, phone, age and doctor are required.');
    err.status = 400;
    throw err;
  }

  const payNow = data.payNow !== false;
  const amount = fee && Number(fee.amount) >= 0 ? Number(fee.amount) : null;
  const patient = new Patient({
    name: String(name).trim(),
    patientNo: await findPatientNo(hospitalId, phone, name),
    phone: String(phone).trim(),
    age: Number(age),
    gender: gender || 'Male',
    doctorName,
    tokenNumber: await nextTokenNumber(hospitalId, doctorName),
    timeRegistered: appointmentTime ? `Appt ${appointmentTime}` : 'Walk-in',
    status: 'Waiting',
    waitTime: '0m',
    vitals: vitals || [],
    pastDiagnoses: pastDiagnoses || '',
    // Free visits (amount 0) are treated as paid so they go straight to the doctor
    paymentStatus: data.paymentStatus || (payNow || amount === 0 ? 'Paid' : 'Unpaid'),
    appointmentTime: appointmentTime || '',
    appointmentDate: appointmentDate || new Date().toDateString(),
    hospitalId
  });
  await patient.save();

  let invoice = null;
  if (amount !== null) {
    invoice = new Invoice({
      invoiceNo: await generateSequentialInvoiceNo(hospitalId),
      patientName: patient.name,
      patientPhone: patient.phone,
      patientId: patient._id.toString(),
      amount,
      doctorName,
      feeType: fee.feeType || 'OPD Consultation Fee',
      paymentMode: patient.paymentStatus === 'Paid' ? cleanPaymentMode(fee.paymentMode) : '',
      date: invoiceDateString(),
      status: patient.paymentStatus === 'Paid' ? 'Paid' : 'Pending',
      hospitalId
    });
    await invoice.save();
  }

  const result = patient.toObject();
  if (invoice) {
    result.invoice = { ...invoice.toObject(), id: invoice.invoiceNo };
  }
  return result;
};

hospitalRouter.post('/patients', async (req, res) => {
  try {
    const visit = await createOpdVisit(req.hospitalId, req.body);
    res.status(201).json(visit);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

hospitalRouter.put('/patients/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    if (!['Waiting', 'In Consultation', 'Completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid patient status.' });
    }
    const patient = await Patient.findOne(scoped(req, id));
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });
    if (status !== 'Waiting' && (patient.paymentStatus === 'Unpaid' || patient.paymentStatus === 'Pending')) {
      return res.status(409).json({ code: 'FEE_PENDING', message: `${patient.name} has not paid the consultation fee yet. Please send them to the front desk.` });
    }
    if (status === 'In Consultation') {
      await Patient.updateMany(
        { hospitalId: req.hospitalId, doctorName: patient.doctorName, status: 'In Consultation', _id: { $ne: patient._id } },
        { status: 'Waiting' }
      );
    }
    patient.status = status;
    await patient.save();
    res.json(patient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cancelling a check-in also removes its unpaid invoice; collected fees stay in the ledger
hospitalRouter.delete('/patients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const patient = await Patient.findOneAndDelete(scoped(req, id));
    if (patient) {
      await Invoice.deleteMany({ hospitalId: req.hospitalId, patientId: patient._id.toString(), status: 'Pending' });
      await Appointment.updateMany({ hospitalId: req.hospitalId, patientId: patient._id.toString() }, { status: 'Booked', patientId: null });
    }
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
  const { patientName, patientPhone, patientId, amount, doctorName, feeType, hospitalId, status, paymentMode } = req.body;
  try {
    const invoiceNo = await generateSequentialInvoiceNo(hospitalId);
    const finalStatus = status === 'Paid' ? 'Paid' : 'Pending';

    const newInvoice = new Invoice({
      invoiceNo,
      patientName,
      patientPhone,
      patientId: patientId || null,
      amount: Number(amount),
      doctorName,
      feeType,
      paymentMode: finalStatus === 'Paid' ? cleanPaymentMode(paymentMode) : '',
      date: invoiceDateString(),
      status: finalStatus,
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
      { status: 'Paid', paymentMode: cleanPaymentMode(req.body && req.body.paymentMode) },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Invoice not found.' });

    const patientFilter = updated.patientId && isObjectId(updated.patientId)
      ? { _id: updated.patientId, hospitalId: updated.hospitalId }
      : { hospitalId: updated.hospitalId, phone: updated.patientPhone, paymentStatus: { $ne: 'Paid' } };
    await Patient.updateMany(patientFilter, { paymentStatus: 'Paid' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.put('/patients/:id/collect-fee', async (req, res) => {
  const { id } = req.params;
  const { amount, feeType, paymentMode } = req.body;
  try {
    const patient = await Patient.findOne(scoped(req, id));
    if (!patient) return res.status(404).json({ message: 'Patient profile not found.' });

    patient.paymentStatus = 'Paid';
    await patient.save();

    // Prefer the invoice raised for this visit; fall back to the legacy phone match
    const pending = await Invoice.findOne({ hospitalId: patient.hospitalId, patientId: patient._id.toString(), status: 'Pending' })
      || await Invoice.findOne({ hospitalId: patient.hospitalId, patientPhone: patient.phone, patientId: null, status: 'Pending' });

    let invoice;
    if (pending) {
      pending.status = 'Paid';
      pending.paymentMode = cleanPaymentMode(paymentMode);
      await pending.save();
      invoice = pending;
    } else {
      invoice = new Invoice({
        invoiceNo: await generateSequentialInvoiceNo(patient.hospitalId),
        patientName: patient.name,
        patientPhone: patient.phone,
        patientId: patient._id.toString(),
        amount: Number(amount) >= 0 && amount !== undefined ? Number(amount) : (req.tenant?.opdFee || 500),
        doctorName: patient.doctorName,
        feeType: feeType || 'OPD Consultation Fee',
        paymentMode: cleanPaymentMode(paymentMode),
        date: invoiceDateString(),
        status: 'Paid',
        hospitalId: patient.hospitalId
      });
      await invoice.save();
    }

    res.json({ message: 'Consultation fee collected. Patient activated into Doctor Queue.', patient, invoice: { ...invoice.toObject(), id: invoice.invoiceNo } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// ----------------------------------------------------
// 5b. APPOINTMENTS (future bookings → OPD queue at check-in)
// ----------------------------------------------------

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

hospitalRouter.get('/appointments', async (req, res) => {
  const { from, to } = req.query;
  try {
    const filter = { hospitalId: req.hospitalId };
    if (from || to) {
      filter.date = {};
      if (from && YMD.test(from)) filter.date.$gte = from;
      if (to && YMD.test(to)) filter.date.$lte = to;
    }
    const list = await Appointment.find(filter).sort({ date: 1, createdAt: 1 }).lean();
    res.json(list.map(a => ({ ...a, id: a._id.toString() })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

hospitalRouter.post('/appointments', async (req, res) => {
  const { patientName, phone, age, gender, doctorId, doctorName, date, time, notes } = req.body;
  try {
    if (!patientName || !phone || age === undefined || age === '' || !doctorName || !date || !time) {
      return res.status(400).json({ message: 'Patient name, phone, age, doctor, date and time are required.' });
    }
    if (!YMD.test(date) || date < todayYMD()) {
      return res.status(400).json({ message: 'Appointments can only be booked for today or a future date.' });
    }
    const clash = await Appointment.exists({ hospitalId: req.hospitalId, doctorName, date, time, status: 'Booked' });
    if (clash) {
      return res.status(409).json({ message: `${doctorName} already has an appointment at ${time} on this date. Please pick another slot.` });
    }
    const appt = await Appointment.create({
      patientName, phone: String(phone).trim(), age: Number(age), gender: gender || 'Male',
      doctorId: doctorId || '', doctorName, date, time, notes: notes || '', hospitalId: req.hospitalId
    });
    res.status(201).json({ ...appt.toObject(), id: appt._id.toString() });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Reschedule or change status (Cancelled / No Show / back to Booked)
hospitalRouter.put('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  const { status, date, time, doctorId, doctorName, notes } = req.body;
  try {
    const appt = await Appointment.findOne(scoped(req, id));
    if (!appt) return res.status(404).json({ message: 'Appointment not found.' });
    if (appt.status === 'Checked In') {
      return res.status(400).json({ message: 'This appointment is already checked in. Manage it from the OPD queue.' });
    }
    if (status !== undefined) {
      if (!['Booked', 'Cancelled', 'No Show'].includes(status)) return res.status(400).json({ message: 'Invalid appointment status.' });
      appt.status = status;
    }
    if (date !== undefined) {
      if (!YMD.test(date) || date < todayYMD()) return res.status(400).json({ message: 'Please choose today or a future date.' });
      appt.date = date;
    }
    if (time !== undefined) appt.time = time;
    if (doctorName !== undefined) { appt.doctorName = doctorName; appt.doctorId = doctorId || ''; }
    if (notes !== undefined) appt.notes = notes;
    await appt.save();
    res.json({ ...appt.toObject(), id: appt._id.toString() });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

hospitalRouter.delete('/appointments/:id', async (req, res) => {
  try {
    await Appointment.findOneAndDelete({ ...scoped(req, req.params.id), status: { $ne: 'Checked In' } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// The patient has arrived: create today's OPD visit (token + invoice) from the booking
hospitalRouter.post('/appointments/:id/check-in', async (req, res) => {
  const { payNow, fee, vitals, pastDiagnoses } = req.body;
  try {
    const appt = await Appointment.findOne(scoped(req, req.params.id));
    if (!appt) return res.status(404).json({ message: 'Appointment not found.' });
    if (appt.status === 'Checked In') return res.status(400).json({ message: 'This appointment is already checked in.' });
    if (appt.status === 'Cancelled') return res.status(400).json({ message: 'This appointment was cancelled.' });
    if (appt.date !== todayYMD()) return res.status(400).json({ message: 'Only today\'s appointments can be checked in.' });

    const visit = await createOpdVisit(req.hospitalId, {
      name: appt.patientName,
      phone: appt.phone,
      age: appt.age,
      gender: appt.gender,
      doctorName: appt.doctorName,
      vitals,
      pastDiagnoses,
      appointmentTime: appt.time,
      payNow,
      fee
    });
    appt.status = 'Checked In';
    appt.patientId = visit._id.toString();
    await appt.save();
    res.status(201).json({ appointment: { ...appt.toObject(), id: appt._id.toString() }, patient: visit });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});

// ----------------------------------------------------
// 5c. DOCTOR CONSULTATION & PATIENT HISTORY
// ----------------------------------------------------

const roundQty = (q) => Math.max(1, Math.min(999, Math.round(Number(q) || 1)));

// Saves the doctor's notes, sends the prescription to the pharmacy and closes the visit
hospitalRouter.put('/patients/:id/consultation', requireRole('DOCTOR', 'HOSPITAL_ADMIN'), async (req, res) => {
  const { complaints, diagnosis, advice, followUpDate, medicines, complete } = req.body || {};
  try {
    const patient = await Patient.findOne(scoped(req, req.params.id));
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });

    if (req.user.role === 'DOCTOR') {
      const me = await Staff.findOne({ hospitalId: req.hospitalId, email: req.user.email }).lean();
      if (!me || normName(me.name) !== normName(patient.doctorName)) {
        return res.status(403).json({ message: 'This patient is in another doctor\'s queue.' });
      }
    }
    if (patient.paymentStatus === 'Unpaid' || patient.paymentStatus === 'Pending') {
      return res.status(409).json({ code: 'FEE_PENDING', message: `${patient.name} has not paid the consultation fee yet.` });
    }
    if (followUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) {
      return res.status(400).json({ message: 'Follow-up date must be a valid date.' });
    }

    const items = Array.isArray(medicines) ? medicines.filter(m => m && String(m.name || '').trim()) : [];
    let prescription = null;

    if (items.length > 0) {
      // Price each line from this hospital's pharmacy stock when the medicine exists there
      const priced = await Promise.all(items.map(async (m) => {
        const name = String(m.name).trim();
        const stock = await Medicine.findOne({ hospitalId: req.hospitalId, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } }).lean();
        return {
          name: stock ? stock.name : name,
          qty: roundQty(m.qty),
          price: stock ? stock.price : 0,
          dosage: String(m.dosage || '').slice(0, 60),
          duration: String(m.duration || '').slice(0, 40),
          timing: String(m.timing || '').slice(0, 40)
        };
      }));

      // Re-saving replaces a still-pending prescription for this visit instead of duplicating it
      const existing = patient.rxCode ? await Prescription.findOne({ hospitalId: req.hospitalId, code: patient.rxCode }) : null;
      if (existing && existing.status === 'PENDING') {
        Object.assign(existing, { items: priced, diagnosis: diagnosis || '', advice: advice || '', followUpDate: followUpDate || '' });
        prescription = await existing.save();
      } else if (!existing) {
        let code;
        do {
          code = `RX-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
        } while (await Prescription.exists({ code }));
        prescription = await Prescription.create({
          code,
          patientNo: patient.patientNo,
          patientId: patient._id.toString(),
          patientName: patient.name,
          patientPhone: patient.phone,
          doctorName: patient.doctorName,
          date: new Date().toISOString().split('T')[0],
          items: priced,
          diagnosis: diagnosis || '',
          advice: advice || '',
          followUpDate: followUpDate || '',
          status: 'PENDING',
          hospitalId: req.hospitalId
        });
      } else {
        return res.status(409).json({ message: 'This prescription has already been dispensed by the pharmacy and cannot be changed.' });
      }
      patient.rxCode = prescription.code;
    }

    patient.complaints = String(complaints || '').slice(0, 2000);
    patient.diagnosis = String(diagnosis || '').slice(0, 500);
    patient.advice = String(advice || '').slice(0, 2000);
    patient.followUpDate = followUpDate || '';
    if (complete !== false) {
      patient.status = 'Completed';
      patient.consultedAt = new Date();
    }
    await patient.save();

    res.json({ patient, prescription });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// All visits of one person (by patient number), with their prescriptions and pharmacy bills
hospitalRouter.get('/patient-history', async (req, res) => {
  const { patientNo, phone, name } = req.query;
  try {
    let filter;
    if (patientNo) filter = { hospitalId: req.hospitalId, patientNo: String(patientNo) };
    else if (phone && name) filter = { hospitalId: req.hospitalId, phone: String(phone), name: { $regex: new RegExp(`^\\s*${escapeRegex(String(name).trim())}\\s*$`, 'i') } };
    else return res.status(400).json({ message: 'patientNo, or phone and name, is required.' });

    const visits = await Patient.find(filter).sort({ createdAt: -1 }).lean();
    const visitIds = visits.map(v => v._id.toString());
    const rxFilter = patientNo
      ? { hospitalId: req.hospitalId, $or: [{ patientNo: String(patientNo) }, { patientId: { $in: visitIds } }] }
      : { hospitalId: req.hospitalId, patientId: { $in: visitIds } };
    const [prescriptions, bills] = await Promise.all([
      Prescription.find(rxFilter).sort({ createdAt: -1 }).lean(),
      PharmacyBill.find(patientNo ? { hospitalId: req.hospitalId, patientNo: String(patientNo) } : { hospitalId: req.hospitalId, _id: null }).sort({ createdAt: -1 }).lean()
    ]);
    res.json({
      visits: visits.map(v => ({ ...v, id: v._id.toString() })),
      prescriptions: prescriptions.map(p => ({ ...p, id: p._id.toString() })),
      bills: bills.map(b => ({ ...b, id: b._id.toString() }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    const previousName = staff.name;
    staff.name = name || staff.name;
    staff.department = department !== undefined ? department : staff.department;
    staff.contact = contact || staff.contact;
    staff.consultationFee = consultationFee !== undefined ? Number(consultationFee) : staff.consultationFee;
    staff.licenseNo = licenseNo !== undefined ? licenseNo : staff.licenseNo;
    staff.signature = signature !== undefined ? signature : staff.signature;
    if (status !== undefined) {
      // Staff may only toggle their own availability; deactivation stays an admin decision
      if (req.user.role !== 'HOSPITAL_ADMIN') {
        if (!['Active', 'On Leave'].includes(status)) {
          return res.status(400).json({ message: 'You can only set yourself Available or On break.' });
        }
        if (staff.status === 'Inactive') {
          return res.status(403).json({ message: 'Your account was deactivated by the hospital admin.' });
        }
      }
      staff.status = status;
    }

    await staff.save();
    if (staff.role === 'Doctor') await cascadeDoctorRename(staff.hospitalId, previousName, staff.name);

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
