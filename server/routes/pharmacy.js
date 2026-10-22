import express from 'express';
import { Medicine } from '../models/Medicine.js';
import { Prescription } from '../models/Prescription.js';
import { PharmacyBill } from '../models/PharmacyBill.js';
import { requireRole } from '../middleware/auth.js';
import { escapeRegex, isObjectId } from '../utils/storage.js';

export const pharmacyRouter = express.Router();

const pharmacyStaff = requireRole('PHARMACY', 'HOSPITAL_ADMIN');
const prescribers = requireRole('DOCTOR', 'HOSPITAL_ADMIN');

const randomRxCode = () => `RX-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;

// 1. GET Inventory Catalog
pharmacyRouter.get('/inventory', async (req, res) => {
  const hospitalId = req.query.hospitalId || 'HOSP-123';
  try {
    const meds = await Medicine.find({ hospitalId });
    res.json(meds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 1b. GET All Prescriptions
pharmacyRouter.get('/prescriptions', async (req, res) => {
  const hospitalId = req.query.hospitalId || 'HOSP-123';
  try {
    const list = await Prescription.find({ hospitalId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET all historical prescriptions for a patient by phone number
pharmacyRouter.get('/prescriptions/history', async (req, res) => {
  const { phone, patientNo, hospitalId } = req.query;
  if (!phone && !patientNo) return res.status(400).json({ message: 'phone or patientNo is required' });
  if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
  try {
    const filter = phone ? { patientPhone: phone, hospitalId } : { patientNo, hospitalId };
    const list = await Prescription.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new Prescription from Doctor
pharmacyRouter.post('/prescriptions', prescribers, async (req, res) => {
  const { code, patientNo, patientName, patientPhone, doctorName, date, items, hospitalId } = req.body;
  try {
    // Prescription codes are globally unique; regenerate on a collision instead of failing the doctor's save
    let rxCode = code || randomRxCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await Prescription.exists({ code: rxCode }))) break;
      rxCode = randomRxCode();
    }
    const newRx = new Prescription({
      code: rxCode,
      patientNo,
      patientName,
      patientPhone,
      doctorName,
      date: date || new Date().toISOString().split('T')[0],
      items,
      status: 'PENDING',
      hospitalId
    });
    await newRx.save();
    res.status(201).json(newRx);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 1c. GET All Pharmacy Bills
pharmacyRouter.get('/bills', async (req, res) => {
  const hospitalId = req.query.hospitalId || 'HOSP-123';
  const { phone, patientNo } = req.query;
  try {
    const filter = { hospitalId };
    if (phone) {
      filter.patientPhone = phone;
    }
    if (patientNo) {
      filter.patientNo = patientNo;
    }
    const list = await PharmacyBill.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. POST Add Medicine
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const findByExactName = (hospitalId, name) =>
  Medicine.findOne({ hospitalId, name: { $regex: new RegExp(`^\\s*${escapeRegex(String(name).trim())}\\s*$`, 'i') } });

const nextMedicineCode = async (hospitalId) => {
  const count = await Medicine.countDocuments({ hospitalId });
  let n = 1001 + count;
  while (await Medicine.exists({ hospitalId, code: `MED-${n}` })) n += 1;
  return `MED-${n}`;
};

pharmacyRouter.post('/inventory', pharmacyStaff, async (req, res) => {
  const { name, category, batchNo, location, stock, minThreshold, expiryDate, price, hospitalId } = req.body;
  try {
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Medicine name is required.' });
    if (!(Number(price) >= 0)) return res.status(400).json({ message: 'Enter a valid price.' });
    if (!(Number(stock) >= 0)) return res.status(400).json({ message: 'Enter a valid opening stock.' });
    if (!YMD_RE.test(expiryDate || '')) return res.status(400).json({ message: 'Expiry date is required.' });
    if (await findByExactName(hospitalId, name)) {
      return res.status(409).json({ message: `"${String(name).trim()}" is already in the catalogue. Use "Receive stock" to add more.` });
    }
    const newMed = new Medicine({
      code: req.body.code && !/^RX-/i.test(req.body.code) ? req.body.code : await nextMedicineCode(hospitalId),
      name: String(name).trim(),
      category: category || 'General',
      batchNo: batchNo || 'OPENING',
      location: location || 'Main store',
      stock: Number(stock),
      minThreshold: Number(minThreshold) >= 0 ? Number(minThreshold) : 20,
      expiryDate,
      price: Number(price),
      batches: Number(stock) > 0 ? [{ batchNo: batchNo || 'OPENING', expiryDate, qty: Number(stock), supplier: 'Opening stock' }] : [],
      hospitalId
    });
    await newMed.save();
    res.status(201).json(newMed);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 3. POST Receive a stock batch for a catalogued medicine
pharmacyRouter.post('/restock', pharmacyStaff, async (req, res) => {
  const { medicineId, medicineName, supplier, batchNo, expiryDate, qty, price, hospitalId } = req.body;
  try {
    const amount = Number(qty);
    if (!(amount > 0) || !Number.isInteger(amount)) return res.status(400).json({ message: 'Quantity received must be a whole number above zero.' });
    if (!YMD_RE.test(expiryDate || '')) return res.status(400).json({ message: 'Batch expiry date is required.' });
    if (expiryDate <= todayYMD()) return res.status(400).json({ message: 'This batch is already expired. Do not add it to stock.' });

    const med = (medicineId && isObjectId(medicineId) ? await Medicine.findOne({ _id: medicineId, hospitalId }) : null)
      || (medicineName ? await findByExactName(hospitalId, medicineName) : null);
    if (!med) {
      return res.status(404).json({ message: `"${medicineName || 'This medicine'}" is not in the catalogue. Add it as a new medicine first.` });
    }

    // While older stock remains, the medicine keeps the earliest expiry so alerts stay correct
    const hadStock = med.stock > 0;
    med.expiryDate = hadStock && med.expiryDate && med.expiryDate < expiryDate ? med.expiryDate : expiryDate;
    med.stock += amount;
    med.batchNo = batchNo || med.batchNo;
    if (Number(price) > 0) med.price = Number(price);
    med.batches.push({ batchNo: batchNo || '', expiryDate, qty: amount, supplier: supplier || '' });
    await med.save();
    res.json(med);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. GET Prescription Reference
pharmacyRouter.get('/prescription/:query', async (req, res) => {
  const { query } = req.params;
  const hospitalId = req.query.hospitalId;
  try {
    const rx = await Prescription.findOne({
      $or: [
        { code: query.toUpperCase() },
        { patientPhone: query },
        { patientNo: { $regex: new RegExp(`^${escapeRegex(query)}$`, 'i') } }
      ],
      hospitalId,
      status: 'PENDING'
    }).sort({ createdAt: -1 });
    if (!rx) {
      return res.status(404).json({ message: 'No active prescription found.' });
    }
    res.json(rx);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PAYMENT_MODES = ['Cash', 'Card', 'UPI'];

const nextBillNo = async (hospitalId) => {
  let n = 1001 + await PharmacyBill.countDocuments({ hospitalId });
  while (await PharmacyBill.exists({ hospitalId, billNo: `PB-${n}` })) n += 1;
  return `PB-${n}`;
};

// 5. POST Checkout — prescription or counter sale.
// The prescription is locked first (no double dispensing), each stock line is decremented atomically
// only if enough stock remains, and everything is undone if any step fails.
pharmacyRouter.post('/checkout', pharmacyStaff, async (req, res) => {
  const { rxCode, patientNo, patientName, patientPhone, doctorName, items, paymentMode, discount, hospitalId } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Add at least one medicine to the bill.' });
  }
  if (items.some(item => !Number.isInteger(Number(item.qty)) || !(Number(item.qty) > 0))) {
    return res.status(400).json({ success: false, message: 'Every item must have a whole-number quantity above zero.' });
  }
  if (!PAYMENT_MODES.includes(paymentMode)) {
    return res.status(400).json({ success: false, message: 'Choose Cash, Card or UPI.' });
  }

  const isCounterSale = !rxCode || /^OTC/i.test(rxCode);
  const decremented = [];
  let lockedRx = null;

  const undo = async () => {
    await Promise.all(decremented.map(d => Medicine.updateOne({ _id: d.id }, { $inc: { stock: d.qty } })));
    if (lockedRx) await Prescription.updateOne({ _id: lockedRx._id }, { status: 'PENDING' });
  };

  try {
    if (!isCounterSale) {
      lockedRx = await Prescription.findOneAndUpdate({ code: rxCode, hospitalId, status: 'PENDING' }, { status: 'DISPENSED' }, { new: true });
      if (!lockedRx) {
        const exists = await Prescription.exists({ code: rxCode, hospitalId });
        return res.status(exists ? 409 : 404).json({
          success: false,
          message: exists ? `Prescription ${rxCode} has already been dispensed.` : `Prescription ${rxCode} was not found.`
        });
      }
    }

    const today = todayYMD();
    const lines = [];
    for (const item of items) {
      const med = (item.medicineId && isObjectId(item.medicineId) ? await Medicine.findOne({ _id: item.medicineId, hospitalId }) : null)
        || (item.name ? await findByExactName(hospitalId, item.name) : null);
      if (!med) throw Object.assign(new Error(`"${item.name}" is not in pharmacy stock. Remove it from the bill.`), { status: 400 });
      if (med.expiryDate && med.expiryDate < today) {
        throw Object.assign(new Error(`${med.name} (batch ${med.batchNo}) expired on ${med.expiryDate}. Do not dispense it.`), { status: 400 });
      }
      const qty = Number(item.qty);
      const updated = await Medicine.findOneAndUpdate(
        { _id: med._id, hospitalId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!updated) throw Object.assign(new Error(`Insufficient stock: "${med.name}" has only ${med.stock} units left.`), { status: 400 });
      decremented.push({ id: med._id, qty });
      lines.push({ medicineId: med._id.toString(), name: med.name, qty, price: med.price });
    }

    const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0) * 100) / 100;
    const off = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
    const bill = await PharmacyBill.create({
      billNo: await nextBillNo(hospitalId),
      saleType: isCounterSale ? 'Counter' : 'Prescription',
      rxCode: isCounterSale ? '' : rxCode,
      patientNo: lockedRx ? lockedRx.patientNo : patientNo,
      patientName: (lockedRx ? lockedRx.patientName : patientName) || 'Walk-in customer',
      patientPhone: (lockedRx ? lockedRx.patientPhone : patientPhone) || '',
      doctorName: (lockedRx ? lockedRx.doctorName : doctorName) || '',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      items: lines,
      subtotal,
      discount: off,
      total: Math.round((subtotal - off) * 100) / 100,
      paymentMode,
      hospitalId
    });

    res.status(201).json({ success: true, message: 'Bill saved and stock updated.', bill });
  } catch (error) {
    await undo().catch(() => {});
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

// 6. PUT Update Medicine
pharmacyRouter.put('/inventory/:id', pharmacyStaff, async (req, res) => {
  const { id } = req.params;
  const { name, category, batchNo, location, stock, minThreshold, expiryDate, price } = req.body;
  try {
    // Only the fields that were sent are changed
    const update = {};
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: 'Medicine name cannot be empty.' });
      const clash = await findByExactName(req.hospitalId, name);
      if (clash && clash._id.toString() !== id) return res.status(409).json({ message: `"${String(name).trim()}" is already in the catalogue.` });
      update.name = String(name).trim();
    }
    if (category !== undefined) update.category = category;
    if (batchNo !== undefined) update.batchNo = batchNo;
    if (location !== undefined) update.location = location;
    for (const [key, value] of [['stock', stock], ['minThreshold', minThreshold], ['price', price]]) {
      if (value === undefined) continue;
      if (!(Number(value) >= 0)) return res.status(400).json({ message: `Enter a valid ${key === 'minThreshold' ? 'minimum stock' : key}.` });
      update[key] = Number(value);
    }
    if (expiryDate !== undefined) {
      if (!YMD_RE.test(expiryDate)) return res.status(400).json({ message: 'Enter a valid expiry date.' });
      update.expiryDate = expiryDate;
    }
    const updated = await Medicine.findOneAndUpdate({ _id: isObjectId(id) ? id : null, hospitalId: req.hospitalId }, update, { new: true });
    if (!updated) return res.status(404).json({ message: 'Medicine not found.' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 7. DELETE Medicine
pharmacyRouter.delete('/inventory/:id', pharmacyStaff, async (req, res) => {
  const { id } = req.params;
  try {
    await Medicine.findOneAndDelete({ _id: isObjectId(id) ? id : null, hospitalId: req.hospitalId });
    res.json({ message: 'Medicine catalog entry deleted.' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
