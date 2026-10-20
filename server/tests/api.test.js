// End-to-end API tests against an isolated in-memory MongoDB replica set.
// Run with: npm test   (never touches the real database)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.TZ = 'Asia/Kolkata';
process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_PER_SEC = '10000';
delete process.env.SMTP_HOST; // never send real e-mail from tests

let replSet;
let server;
let base;
let mongoose;
let models;

const api = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
};

const login = async (email, password, role, code) => {
  const r = await api('POST', '/api/auth/login', { body: { email, password, role, code } });
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.data)}`);
  return r.data.token;
};

const ctx = {};

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri('medisaas_test');

  mongoose = (await import('mongoose')).default;
  await mongoose.connect(process.env.MONGODB_URI);
  const { app } = await import('../app.js');

  models = {
    User: (await import('../models/User.js')).User,
    Tenant: (await import('../models/Tenant.js')).Tenant,
    Plan: (await import('../models/Plan.js')).Plan,
    LicenseCode: (await import('../models/LicenseCode.js')).LicenseCode,
    SystemSetting: (await import('../models/SystemSetting.js')).SystemSetting,
    Medicine: (await import('../models/Medicine.js')).Medicine,
    Patient: (await import('../models/Patient.js')).Patient,
    Staff: (await import('../models/Staff.js')).Staff
  };

  await models.Plan.insertMany([
    { id: 'plan-basic', name: 'Basic Plan', price: 9999, maxDoctors: 2, maxReceptionists: 1, maxPharmacists: 1, maxStorage: 10, durationMonths: 12 },
    { id: 'plan-pro', name: 'Pro Plan', price: 24999, maxDoctors: 10, maxReceptionists: 5, maxPharmacists: 3, maxStorage: 100, durationMonths: 12 }
  ]);
  await models.SystemSetting.create({ platformName: 'Test Platform', trialDays: 14 });
  await new models.User({ name: 'Operator', email: 'root@platform.test', password: 'RootPass#123', role: 'SUPER_ADMIN', isActivated: true }).save();

  await new Promise(resolve => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose) {
    mongoose.connection.removeAllListeners('disconnected');
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
});

test('health endpoint and unknown API routes return JSON', async () => {
  const health = await api('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.match(health.data.db_status, /Connected/);
  const missing = await api('GET', '/api/does-not-exist');
  assert.equal(missing.status, 404);
});

test('public plans and config are available without login', async () => {
  const plans = await api('GET', '/api/public/plans');
  assert.equal(plans.status, 200);
  assert.deepEqual(plans.data.map(p => p.id), ['plan-basic', 'plan-pro']);
  const config = await api('GET', '/api/public/config');
  assert.equal(config.data.platformName, 'Test Platform');
  assert.equal(config.data.allowSelfSignup, true);
  assert.equal(config.data.trialDays, 14);
});

test('protected APIs reject anonymous and forged requests', async () => {
  for (const path of ['/api/superadmin/tenants', '/api/superadmin/backup', '/api/hospital/patients', '/api/pharmacy/inventory']) {
    const r = await api('GET', path);
    assert.equal(r.status, 401, path);
  }
  const forged = await api('GET', '/api/hospital/patients', { token: 'not-a-real-token' });
  assert.equal(forged.status, 401);
});

test('registration validates input', async () => {
  const bad = await api('POST', '/api/public/register', { body: { hospitalName: 'X', email: 'nope', password: '1' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.errors.length >= 3);
  const noTerms = await api('POST', '/api/public/register', {
    body: { hospitalName: 'No Terms Hospital', adminName: 'Admin', email: 'noterms@x.test', password: 'Password#1', phone: '9876543210', address: '1 Main Road' }
  });
  assert.equal(noTerms.status, 400);
  assert.match(noTerms.data.message, /Terms of Service/);
});

test('hospital self-registration starts a free trial and logs the admin in', async () => {
  const r = await api('POST', '/api/public/register', {
    body: {
      hospitalName: 'Alpha Care Hospital', adminName: 'Dr. Alpha', email: 'Admin@Alpha.test',
      password: 'AlphaPass#1', phone: '9876543210', address: '12 MG Road', city: 'Lucknow', planId: 'plan-basic', acceptTerms: true, termsVersion: '1.0'
    }
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.user.role, 'HOSPITAL_ADMIN');
  assert.equal(r.data.user.email, 'admin@alpha.test');
  assert.equal(r.data.subscription.isTrial, true);
  assert.ok(r.data.subscription.daysLeft >= 13 && r.data.subscription.daysLeft <= 15);
  assert.match(r.data.hospital.accessCode, /^TRIAL-/);
  const stored = await models.Tenant.findById(r.data.user.hospitalId);
  assert.ok(stored.termsAcceptedAt, 'terms acceptance timestamp stored');
  assert.equal(stored.termsVersion, '1.0');
  ctx.alphaAdmin = r.data.token;
  ctx.alphaId = r.data.user.hospitalId;

  const me = await api('GET', '/api/auth/me', { token: ctx.alphaAdmin });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.hospitalId, ctx.alphaId);

  const dup = await api('POST', '/api/public/register', {
    body: { hospitalName: 'Alpha Again', adminName: 'Someone', email: 'admin@alpha.test', password: 'AlphaPass#1', phone: '9876543210', address: '12 MG Road', acceptTerms: true }
  });
  assert.equal(dup.status, 409);

  // Mixed-case login works for the registered admin
  const token = await login('ADMIN@alpha.test', 'AlphaPass#1', 'HOSPITAL_ADMIN');
  assert.ok(token);
});

test('hospital admin manages staff within plan limits', async () => {
  const add = (body) => api('POST', '/api/hospital/staff', { token: ctx.alphaAdmin, body });
  const doc1 = await add({ name: 'Dr. One', role: 'Doctor', department: 'General', contact: '9000000001', email: 'doc1@alpha.test', password: 'DocPass#1' });
  assert.equal(doc1.status, 201, JSON.stringify(doc1.data));
  ctx.alphaDoctorStaffId = doc1.data._id;
  const doc2 = await add({ name: 'Dr. Two', role: 'Doctor', contact: '9000000002', email: 'doc2@alpha.test', password: 'DocPass#2' });
  assert.equal(doc2.status, 201);
  const doc3 = await add({ name: 'Dr. Three', role: 'Doctor', contact: '9000000003', email: 'doc3@alpha.test', password: 'DocPass#3' });
  assert.equal(doc3.status, 403, 'basic plan allows only 2 doctors');

  const noPassword = await add({ name: 'No Pass', role: 'Receptionist', contact: '9000000009', email: 'nopass@alpha.test' });
  assert.equal(noPassword.status, 400);

  const rec = await add({ name: 'Front Desk', role: 'Receptionist', contact: '9000000004', email: 'desk@alpha.test', password: 'DeskPass#1' });
  assert.equal(rec.status, 201);
  const pharm = await add({ name: 'Pharma', role: 'Pharmacy', contact: '9000000005', email: 'pharm@alpha.test', password: 'PharmPass#1' });
  assert.equal(pharm.status, 201);

  const dupEmail = await add({ name: 'Copy', role: 'Pharmacy', contact: '9000000006', email: 'desk@alpha.test', password: 'Whatever1' });
  assert.equal(dupEmail.status, 409);

  const list = await api('GET', '/api/hospital/staff', { token: ctx.alphaAdmin });
  assert.equal(list.data.length, 4);

  const dept = await api('POST', '/api/hospital/departments', { token: ctx.alphaAdmin, body: { name: 'Cardiology', head: 'Dr. One' } });
  assert.equal(dept.status, 201);
  assert.equal(dept.data.hospitalId, ctx.alphaId);

  ctx.doctor = await login('doc1@alpha.test', 'DocPass#1', 'DOCTOR');
  ctx.reception = await login('desk@alpha.test', 'DeskPass#1', 'RECEPTIONIST');
  ctx.pharmacy = await login('pharm@alpha.test', 'PharmPass#1', 'PHARMACY');
});

test('role permissions are enforced', async () => {
  const r1 = await api('POST', '/api/hospital/staff', { token: ctx.reception, body: { name: 'Hack', role: 'Doctor', contact: '1', email: 'h@x.test', password: 'xxxxxx' } });
  assert.equal(r1.status, 403);
  const r2 = await api('GET', '/api/superadmin/tenants', { token: ctx.alphaAdmin });
  assert.equal(r2.status, 403);
  const r3 = await api('PUT', '/api/hospital/fees', { token: ctx.doctor, body: { opdFee: 1 } });
  assert.equal(r3.status, 403);
  const r4 = await api('POST', '/api/pharmacy/inventory', { token: ctx.reception, body: {} });
  assert.equal(r4.status, 403);
  const r5 = await api('PUT', '/api/hospital/staff/profile/details', { token: ctx.doctor, body: { email: 'doc2@alpha.test', name: 'Renamed' } });
  assert.equal(r5.status, 403, 'doctor cannot edit another doctor');
  const r6 = await api('PUT', '/api/hospital/staff/profile/details', { token: ctx.doctor, body: { email: 'doc1@alpha.test', consultationFee: 700, licenseNo: 'MCI-1' } });
  assert.equal(r6.status, 200);
  assert.equal(r6.data.consultationFee, 700);
});

test('OPD flow: registration, daily tokens, fee collection, consultation', async () => {
  const reg = (name, phone, extra = {}) => api('POST', '/api/hospital/patients', {
    token: ctx.reception,
    body: { name, phone, age: 40, gender: 'Female', doctorName: 'Dr. One', ...extra }
  });
  const p1 = await reg('Patient One', '8000000001', { payNow: false });
  assert.equal(p1.status, 201, JSON.stringify(p1.data));
  assert.equal(p1.data.tokenNumber, 'OPD-101');
  assert.equal(p1.data.patientNo, 'PAT-1001');
  assert.equal(p1.data.paymentStatus, 'Unpaid');
  const p2 = await reg('Patient Two', '8000000002');
  assert.equal(p2.data.tokenNumber, 'OPD-102');
  assert.equal(p2.data.patientNo, 'PAT-1002');
  const revisit = await reg('Patient One', '8000000001');
  assert.equal(revisit.data.patientNo, 'PAT-1001', 'returning patient keeps the same patient number');

  // Yesterday's patients do not consume today's tokens
  await models.Patient.collection.updateMany({ hospitalId: ctx.alphaId }, { $set: { createdAt: new Date(Date.now() - 2 * 86400000) } });
  const today = await reg('Patient Three', '8000000003');
  assert.equal(today.data.tokenNumber, 'OPD-101');

  const missing = await api('POST', '/api/hospital/patients', { token: ctx.reception, body: { name: 'No phone' } });
  assert.equal(missing.status, 400);

  const fee = await api('PUT', `/api/hospital/patients/${p1.data._id}/collect-fee`, { token: ctx.reception, body: { amount: 500 } });
  assert.equal(fee.status, 200);
  assert.equal(fee.data.patient.paymentStatus, 'Paid');

  const inv = await api('POST', '/api/hospital/invoices', {
    token: ctx.reception,
    body: { patientName: 'Patient Two', patientPhone: '8000000002', amount: 1200, doctorName: 'Dr. One', feeType: 'Emergency' }
  });
  assert.equal(inv.status, 201);
  const invoices = await api('GET', '/api/hospital/invoices', { token: ctx.alphaAdmin });
  assert.deepEqual(invoices.data.map(i => i.invoiceNo).sort(), ['INV-1001', 'INV-1002']);
  const collect = await api('PUT', `/api/hospital/invoices/${inv.data.invoiceNo}/collect`, { token: ctx.reception });
  assert.equal(collect.data.status, 'Paid');

  const start = await api('PUT', `/api/hospital/patients/${p1.data._id}`, { token: ctx.doctor, body: { status: 'In Consultation' } });
  assert.equal(start.data.status, 'In Consultation');
  const bad = await api('PUT', `/api/hospital/patients/${p1.data._id}`, { token: ctx.doctor, body: { status: 'Hacked' } });
  assert.equal(bad.status, 400);
  const done = await api('PUT', `/api/hospital/patients/${p1.data._id}`, { token: ctx.doctor, body: { status: 'Completed' } });
  assert.equal(done.data.status, 'Completed');
  ctx.patientOne = p1.data;
});

test('reception: one-step visit + invoice, family numbering, cancel clears dues', async () => {
  const visit = await api('POST', '/api/hospital/patients', {
    token: ctx.reception,
    body: { name: 'Kiran Rao', phone: '8100000001', age: 34, gender: 'Female', doctorName: 'Dr. One', payNow: true, fee: { amount: 700, feeType: 'OPD Consultation Fee', paymentMode: 'UPI' } }
  });
  assert.equal(visit.status, 201, JSON.stringify(visit.data));
  assert.equal(visit.data.paymentStatus, 'Paid');
  assert.equal(visit.data.invoice.amount, 700);
  assert.equal(visit.data.invoice.status, 'Paid');
  assert.equal(visit.data.invoice.paymentMode, 'UPI');
  assert.equal(visit.data.invoice.patientId, visit.data._id);

  // Same phone, different person -> new patient number; same person again -> same number
  const child = await api('POST', '/api/hospital/patients', {
    token: ctx.reception,
    body: { name: 'Aarav Rao', phone: '8100000001', age: 6, gender: 'Male', doctorName: 'Dr. One', payNow: false, fee: { amount: 500 } }
  });
  assert.notEqual(child.data.patientNo, visit.data.patientNo);
  assert.equal(child.data.paymentStatus, 'Unpaid');
  assert.equal(child.data.invoice.status, 'Pending');
  const again = await api('POST', '/api/hospital/patients', {
    token: ctx.reception,
    body: { name: '  kiran rao ', phone: '8100000001', age: 34, doctorName: 'Dr. One', payNow: true, fee: { amount: 0 } }
  });
  assert.equal(again.data.patientNo, visit.data.patientNo);

  // Free visit counts as paid
  assert.equal(again.data.paymentStatus, 'Paid');

  // Cancelling an unpaid check-in removes its pending invoice
  const del = await api('DELETE', `/api/hospital/patients/${child.data._id}`, { token: ctx.reception });
  assert.equal(del.status, 200);
  const invs = await api('GET', '/api/hospital/invoices', { token: ctx.reception });
  assert.equal(invs.data.some(i => i.patientId === child.data._id), false, 'pending invoice of cancelled visit removed');

  // Collect-fee uses the visit's own invoice and records the payment mode
  const unpaid = await api('POST', '/api/hospital/patients', {
    token: ctx.reception,
    body: { name: 'Meena Das', phone: '8100000002', age: 50, doctorName: 'Dr. One', payNow: false, fee: { amount: 650 } }
  });
  const collected = await api('PUT', `/api/hospital/patients/${unpaid.data._id}/collect-fee`, { token: ctx.reception, body: { paymentMode: 'Card' } });
  assert.equal(collected.status, 200);
  assert.equal(collected.data.invoice.amount, 650);
  assert.equal(collected.data.invoice.paymentMode, 'Card');
  assert.equal(collected.data.invoice.invoiceNo, unpaid.data.invoice.invoiceNo, 'no duplicate invoice created');
});

test('appointments: book, clash, reschedule, check-in creates the visit once', async () => {
  const d = new Date();
  const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = ymd(d);
  const tomorrow = ymd(new Date(d.getTime() + 86400000));
  const yesterday = ymd(new Date(d.getTime() - 86400000));

  const past = await api('POST', '/api/hospital/appointments', { token: ctx.reception, body: { patientName: 'Old', phone: '8200000000', age: 30, doctorName: 'Dr. One', date: yesterday, time: '10:00 AM' } });
  assert.equal(past.status, 400);

  const before = (await api('GET', '/api/hospital/patients', { token: ctx.reception })).data.length;
  const future = await api('POST', '/api/hospital/appointments', { token: ctx.reception, body: { patientName: 'Future Patient', phone: '8200000001', age: 40, doctorName: 'Dr. One', date: tomorrow, time: '11:00 AM' } });
  assert.equal(future.status, 201);
  const after = (await api('GET', '/api/hospital/patients', { token: ctx.reception })).data.length;
  assert.equal(after, before, 'booking does not add anyone to today\'s queue');

  const clash = await api('POST', '/api/hospital/appointments', { token: ctx.reception, body: { patientName: 'Clash', phone: '8200000002', age: 22, doctorName: 'Dr. One', date: tomorrow, time: '11:00 AM' } });
  assert.equal(clash.status, 409);

  const early = await api('POST', `/api/hospital/appointments/${future.data.id}/check-in`, { token: ctx.reception, body: { payNow: true, fee: { amount: 500 } } });
  assert.equal(early.status, 400, 'future appointment cannot be checked in today');

  const moved = await api('PUT', `/api/hospital/appointments/${future.data.id}`, { token: ctx.reception, body: { date: today, time: '04:00 PM' } });
  assert.equal(moved.data.date, today);

  const checkIn = await api('POST', `/api/hospital/appointments/${future.data.id}/check-in`, { token: ctx.reception, body: { payNow: true, fee: { amount: 500, paymentMode: 'Cash' } } });
  assert.equal(checkIn.status, 201, JSON.stringify(checkIn.data));
  assert.match(checkIn.data.patient.tokenNumber, /^OPD-\d+$/);
  assert.equal(checkIn.data.appointment.status, 'Checked In');
  const twice = await api('POST', `/api/hospital/appointments/${future.data.id}/check-in`, { token: ctx.reception, body: { payNow: true, fee: { amount: 500 } } });
  assert.equal(twice.status, 400, 'cannot check in twice');

  const list = await api('GET', `/api/hospital/appointments?from=${today}&to=${tomorrow}`, { token: ctx.reception });
  assert.equal(list.data.length, 1);

  const other = await api('GET', '/api/hospital/appointments', { token: ctx.betaAdmin || ctx.alphaAdmin });
  assert.ok(Array.isArray(other.data));
});

test('pharmacy flow: inventory, prescription, transactional checkout', async () => {
  const med = await api('POST', '/api/pharmacy/inventory', {
    token: ctx.pharmacy,
    body: { code: 'MED-1', name: 'Paracetamol 500mg', category: 'Analgesic', batchNo: 'B1', location: 'Rack A', stock: 50, minThreshold: 10, expiryDate: '2028-01-01', price: 2 }
  });
  assert.equal(med.status, 201);
  ctx.medicineId = med.data._id;

  const rx = await api('POST', '/api/pharmacy/prescriptions', {
    token: ctx.doctor,
    body: {
      patientNo: ctx.patientOne.patientNo, patientName: 'Patient One', patientPhone: '8000000001', doctorName: 'Dr. One',
      items: [{ name: 'Paracetamol 500mg', qty: 10, price: 2, dosage: '1-0-1', duration: '5 days' }]
    }
  });
  assert.equal(rx.status, 201, JSON.stringify(rx.data));
  const rxCode = rx.data.code;

  const pharmacyCannotPrescribe = await api('POST', '/api/pharmacy/prescriptions', { token: ctx.pharmacy, body: {} });
  assert.equal(pharmacyCannotPrescribe.status, 403);

  const lookup = await api('GET', `/api/pharmacy/prescription/${ctx.patientOne.patientNo}`, { token: ctx.pharmacy });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.data.code, rxCode);

  const historyByNo = await api('GET', `/api/pharmacy/prescriptions/history?patientNo=${ctx.patientOne.patientNo}`, { token: ctx.doctor });
  assert.equal(historyByNo.status, 200);
  assert.equal(historyByNo.data.length, 1);

  const tooMuch = await api('POST', '/api/pharmacy/checkout', {
    token: ctx.pharmacy,
    body: { rxCode, patientName: 'Patient One', patientPhone: '8000000001', doctorName: 'Dr. One', items: [{ medicineId: ctx.medicineId, name: 'Paracetamol 500mg', qty: 999, price: 2 }], total: 1998, paymentMode: 'Cash' }
  });
  assert.equal(tooMuch.status, 400);
  const unchanged = await models.Medicine.findById(ctx.medicineId);
  assert.equal(unchanged.stock, 50, 'failed checkout must roll back');

  const checkout = await api('POST', '/api/pharmacy/checkout', {
    token: ctx.pharmacy,
    body: { rxCode, patientNo: ctx.patientOne.patientNo, patientName: 'Patient One', patientPhone: '8000000001', doctorName: 'Dr. One', items: [{ medicineId: ctx.medicineId, name: 'Paracetamol 500mg', qty: 10, price: 2 }], total: 20, paymentMode: 'UPI' }
  });
  assert.equal(checkout.status, 201, JSON.stringify(checkout.data));
  const after = await models.Medicine.findById(ctx.medicineId);
  assert.equal(after.stock, 40);
  const rxList = await api('GET', '/api/pharmacy/prescriptions', { token: ctx.pharmacy });
  assert.equal(rxList.data.find(r => r.code === rxCode).status, 'DISPENSED');
  const bills = await api('GET', '/api/pharmacy/bills', { token: ctx.alphaAdmin });
  assert.equal(bills.data.length, 1);

  const restock = await api('POST', '/api/pharmacy/restock', { token: ctx.pharmacy, body: { medicineName: 'paracetamol 500MG', batchNo: 'B2', expiryDate: '2029-01-01', qty: 60 } });
  assert.equal(restock.data.stock, 100);
  const regexAttack = await api('POST', '/api/pharmacy/restock', { token: ctx.pharmacy, body: { medicineName: '.*', batchNo: 'X', expiryDate: '2029-01-01', qty: 1 } });
  assert.notEqual(String(regexAttack.data._id), String(ctx.medicineId), 'regex input must not match existing medicine');
});

test('tenant isolation: one hospital cannot see or change another', async () => {
  const r = await api('POST', '/api/public/register', {
    body: { hospitalName: 'Beta Clinic', adminName: 'Beta Admin', email: 'admin@beta.test', password: 'BetaPass#1', phone: '9123456780', address: '5 Civil Lines', acceptTerms: true }
  });
  assert.equal(r.status, 201);
  ctx.betaAdmin = r.data.token;
  ctx.betaId = r.data.user.hospitalId;

  const patients = await api('GET', `/api/hospital/patients?hospitalId=${ctx.alphaId}`, { token: ctx.betaAdmin });
  assert.equal(patients.status, 200);
  assert.equal(patients.data.length, 0, 'hospitalId query param must be ignored');

  const staff = await api('GET', `/api/hospital/staff?hospitalId=${ctx.alphaId}`, { token: ctx.betaAdmin });
  assert.equal(staff.data.length, 0);

  const meds = await api('GET', `/api/pharmacy/inventory?hospitalId=${ctx.alphaId}`, { token: ctx.betaAdmin });
  assert.equal(meds.data.length, 0);

  const editStaff = await api('PUT', `/api/hospital/staff/${ctx.alphaDoctorStaffId}`, { token: ctx.betaAdmin, body: { name: 'Stolen', password: 'hijack123' } });
  assert.equal(editStaff.status, 404);
  const delPatient = await api('DELETE', `/api/hospital/patients/${ctx.patientOne._id}`, { token: ctx.betaAdmin });
  assert.equal(delPatient.status, 200);
  assert.ok(await models.Patient.findById(ctx.patientOne._id), 'patient of another hospital must survive');
  const editMed = await api('PUT', `/api/pharmacy/inventory/${ctx.medicineId}`, {
    token: ctx.betaAdmin,
    body: { name: 'x', category: 'x', batchNo: 'x', location: 'x', stock: 0, minThreshold: 0, expiryDate: '2020-01-01', price: 0 }
  });
  assert.equal(editMed.status, 404);
  assert.equal((await models.Medicine.findById(ctx.medicineId)).stock, 100, 'medicine of another hospital is untouched');

  const createdForOther = await api('POST', '/api/hospital/departments', { token: ctx.betaAdmin, body: { name: 'Injected', hospitalId: ctx.alphaId } });
  assert.equal(createdForOther.data.hospitalId, ctx.betaId, 'body hospitalId is overridden by the token');

  const profile = await api('PUT', '/api/hospital/profile', { token: ctx.betaAdmin, body: { hospitalId: ctx.alphaId, hospitalName: 'Hijacked' } });
  assert.equal(profile.status, 200);
  const alpha = await models.Tenant.findById(ctx.alphaId);
  assert.equal(alpha.hospitalName, 'Alpha Care Hospital');
});

test('hospital profile and subscription endpoints return own data', async () => {
  const upd = await api('PUT', '/api/hospital/profile', { token: ctx.alphaAdmin, body: { adminPhone: '9999911111', address: 'New Address 1', hospitalLogo: 'data:image/png;base64,AAA' } });
  assert.equal(upd.status, 200);
  const profile = await api('GET', '/api/hospital/profile', { token: ctx.reception });
  assert.equal(profile.data.hospitalName, 'Alpha Care Hospital');
  assert.equal(profile.data.hospitalLogo, 'data:image/png;base64,AAA');
  assert.equal(profile.data.planName, 'Basic Plan');
  assert.equal(profile.data.isTrial, true);

  const sub = await api('GET', '/api/hospital/subscription', { token: ctx.alphaAdmin });
  assert.equal(sub.status, 200);
  assert.equal(sub.data.tenant.id, ctx.alphaId);
  assert.equal(sub.data.plans.length, 2);
  assert.ok(sub.data.tenant.storageUsed > 0);
  const subRec = await api('GET', '/api/hospital/subscription', { token: ctx.reception });
  assert.deepEqual(subRec.data.invoices, [], 'non-admins do not see billing invoices');
});

test('super admin: tenants, licenses, renewal and suspension', async () => {
  ctx.root = await login('root@platform.test', 'RootPass#123', 'SUPER_ADMIN');
  const tenants = await api('GET', '/api/superadmin/tenants', { token: ctx.root });
  assert.equal(tenants.status, 200);
  const alpha = tenants.data.find(t => t.id === ctx.alphaId);
  assert.equal(alpha.isTrial, true);
  assert.equal(alpha.signupSource, 'self-signup');
  assert.equal(alpha.staffCreated, 4);

  const lic = await api('POST', '/api/superadmin/licenses', { token: ctx.root, body: { planId: 'plan-pro', validityMonths: 12 } });
  assert.equal(lic.status, 201);
  const renew = await api('POST', '/api/hospital/renew-subscription', { token: ctx.alphaAdmin, body: { licenseCode: lic.data.code } });
  assert.equal(renew.status, 200, JSON.stringify(renew.data));
  const renewed = await models.Tenant.findById(ctx.alphaId);
  assert.equal(renewed.isTrial, false);
  assert.equal(renewed.planId, 'plan-pro');
  const reuse = await api('POST', '/api/hospital/renew-subscription', { token: ctx.alphaAdmin, body: { licenseCode: lic.data.code } });
  assert.equal(reuse.status, 400);

  // Now on Pro: a 3rd doctor is allowed
  const doc3 = await api('POST', '/api/hospital/staff', { token: ctx.alphaAdmin, body: { name: 'Dr. Three', role: 'Doctor', contact: '9000000003', email: 'doc3@alpha.test', password: 'DocPass#3' } });
  assert.equal(doc3.status, 201);

  const toggle = await api('PUT', `/api/superadmin/tenants/${ctx.betaId}/toggle`, { token: ctx.root });
  assert.equal(toggle.data.status, 'Suspended');
  const blocked = await api('GET', '/api/hospital/patients', { token: ctx.betaAdmin });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'TENANT_SUSPENDED');
  const blockedLogin = await api('POST', '/api/auth/login', { body: { email: 'admin@beta.test', password: 'BetaPass#1', role: 'HOSPITAL_ADMIN' } });
  assert.equal(blockedLogin.status, 403);
  await api('PUT', `/api/superadmin/tenants/${ctx.betaId}/toggle`, { token: ctx.root });
  const unblocked = await api('GET', '/api/hospital/patients', { token: ctx.betaAdmin });
  assert.equal(unblocked.status, 200);

  const backup = await api('GET', '/api/superadmin/backup', { token: ctx.root });
  assert.equal(backup.status, 200);
  assert.ok(backup.data.tenants.length >= 2);
});

test('registration with a paid license code activates that plan', async () => {
  const lic = await api('POST', '/api/superadmin/licenses', { token: ctx.root, body: { planId: 'plan-pro', validityMonths: 6 } });
  const r = await api('POST', '/api/public/register', {
    body: { hospitalName: 'Gamma Hospital', adminName: 'Gamma Admin', email: 'admin@gamma.test', password: 'GammaPass#1', phone: '9000012345', address: '1 Hazratganj', licenseCode: lic.data.code, acceptTerms: true }
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.subscription.isTrial, false);
  assert.equal(r.data.hospital.planName, 'Pro Plan');
  assert.ok(r.data.subscription.daysLeft > 150);
  const used = await models.LicenseCode.findOne({ code: lic.data.code });
  assert.equal(used.isUsed, true);
  ctx.gammaId = r.data.user.hospitalId;
});

test('expired subscription locks staff out but lets the admin renew', async () => {
  await models.Tenant.findByIdAndUpdate(ctx.betaId, { subscriptionExpiryDate: '2020-01-01' });
  const staffAdd = await api('POST', '/api/hospital/staff', { token: ctx.betaAdmin, body: { name: 'Late', role: 'Doctor', contact: '1', email: 'late@beta.test', password: 'LatePass1' } });
  assert.equal(staffAdd.status, 402);
  assert.equal(staffAdd.data.code, 'SUBSCRIPTION_EXPIRED');
  const read = await api('GET', '/api/hospital/subscription', { token: ctx.betaAdmin });
  assert.equal(read.status, 200);
  assert.equal(read.data.subscription.expired, true);

  // Add a beta receptionist directly and verify login is refused while expired
  await new models.User({ name: 'Beta Desk', email: 'desk@beta.test', password: 'DeskPass#9', role: 'RECEPTIONIST', hospitalId: ctx.betaId, isActivated: true }).save();
  const recLogin = await api('POST', '/api/auth/login', { body: { email: 'desk@beta.test', password: 'DeskPass#9', role: 'RECEPTIONIST' } });
  assert.equal(recLogin.status, 402);
  const adminLogin = await api('POST', '/api/auth/login', { body: { email: 'admin@beta.test', password: 'BetaPass#1', role: 'HOSPITAL_ADMIN' } });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.data.subscription.expired, true);

  const lic = await api('POST', '/api/superadmin/licenses', { token: ctx.root, body: { planId: 'plan-basic', validityMonths: 12 } });
  const renew = await api('POST', '/api/hospital/renew-subscription', { token: ctx.betaAdmin, body: { licenseCode: lic.data.code } });
  assert.equal(renew.status, 200);
  const recLogin2 = await api('POST', '/api/auth/login', { body: { email: 'desk@beta.test', password: 'DeskPass#9', role: 'RECEPTIONIST' } });
  assert.equal(recLogin2.status, 200);
});

test('login security: wrong role, wrong password lockout', async () => {
  const wrongRole = await api('POST', '/api/auth/login', { body: { email: 'doc2@alpha.test', password: 'DocPass#2', role: 'PHARMACY' } });
  assert.equal(wrongRole.status, 403);
  for (let i = 0; i < 2; i++) {
    const r = await api('POST', '/api/auth/login', { body: { email: 'doc2@alpha.test', password: 'wrong', role: 'DOCTOR' } });
    assert.equal(r.status, i < 1 ? 401 : 429);
  }
  const locked = await api('POST', '/api/auth/login', { body: { email: 'doc2@alpha.test', password: 'DocPass#2', role: 'DOCTOR' } });
  assert.equal(locked.status, 429);
});

test('change password', async () => {
  const wrong = await api('POST', '/api/auth/change-password', { token: ctx.pharmacy, body: { currentPassword: 'nope', newPassword: 'NewPharm#2026' } });
  assert.equal(wrong.status, 401);
  const ok = await api('POST', '/api/auth/change-password', { token: ctx.pharmacy, body: { currentPassword: 'PharmPass#1', newPassword: 'NewPharm#2026' } });
  assert.equal(ok.status, 200);
  await login('pharm@alpha.test', 'NewPharm#2026', 'PHARMACY');
});

test('maintenance mode blocks hospital users but not the operator', async () => {
  await api('PUT', '/api/superadmin/settings', { token: ctx.root, body: { maintenanceMode: true } });
  const blocked = await api('GET', '/api/hospital/patients', { token: ctx.alphaAdmin });
  assert.equal(blocked.status, 503);
  const root = await api('GET', '/api/superadmin/tenants', { token: ctx.root });
  assert.equal(root.status, 200);
  await api('PUT', '/api/superadmin/settings', { token: ctx.root, body: { maintenanceMode: false } });
  const open = await api('GET', '/api/hospital/patients', { token: ctx.alphaAdmin });
  assert.equal(open.status, 200);
});

test('staff deletion revokes login; tenant deletion removes all its data', async () => {
  const staff = await models.Staff.findOne({ email: 'doc2@alpha.test' });
  const del = await api('DELETE', `/api/hospital/staff/${staff._id}`, { token: ctx.alphaAdmin });
  assert.equal(del.status, 200);
  assert.equal(await models.User.exists({ email: 'doc2@alpha.test' }), null);

  const gammaToken = await login('admin@gamma.test', 'GammaPass#1', 'HOSPITAL_ADMIN');
  const remove = await api('DELETE', `/api/superadmin/tenants/${ctx.gammaId}`, { token: ctx.root });
  assert.equal(remove.status, 200);
  assert.equal(await models.User.exists({ hospitalId: ctx.gammaId }), null);
  const afterDelete = await api('GET', '/api/hospital/patients', { token: gammaToken });
  assert.equal(afterDelete.status, 401, 'tokens of deleted hospitals stop working');
});
