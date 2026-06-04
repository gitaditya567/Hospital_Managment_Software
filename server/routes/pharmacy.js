import express from 'express';
import mongoose from 'mongoose';
import { Medicine } from '../models/Medicine.js';
import { Prescription } from '../models/Prescription.js';
import { PharmacyBill } from '../models/PharmacyBill.js';

export const pharmacyRouter = express.Router();

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
  const { phone, hospitalId } = req.query;
  if (!phone) return res.status(400).json({ message: 'phone is required' });
  if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
  try {
    const list = await Prescription.find({ patientPhone: phone, hospitalId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new Prescription from Doctor
pharmacyRouter.post('/prescriptions', async (req, res) => {
  const { code, patientNo, patientName, patientPhone, doctorName, date, items, hospitalId } = req.body;
  try {
    const newRx = new Prescription({
      code: code || `RX-${Math.floor(1000 + Math.random() * 9000)}`,
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
pharmacyRouter.post('/inventory', async (req, res) => {
  const { code, name, category, batchNo, location, stock, minThreshold, expiryDate, price, hospitalId } = req.body;
  try {
    const newMed = new Medicine({
      code,
      name,
      category,
      batchNo,
      location,
      stock: Number(stock),
      minThreshold: Number(minThreshold),
      expiryDate,
      price: Number(price),
      hospitalId
    });
    await newMed.save();
    res.status(201).json(newMed);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 3. POST Restock Batch
pharmacyRouter.post('/restock', async (req, res) => {
  const { medicineName, supplier, batchNo, expiryDate, qty, hospitalId } = req.body;
  try {
    let med = await Medicine.findOne({ 
      name: { $regex: new RegExp(`^${medicineName}$`, 'i') }, 
      hospitalId 
    });

    if (med) {
      med.stock += Number(qty);
      med.batchNo = batchNo;
      med.expiryDate = expiryDate;
      await med.save();
    } else {
      med = new Medicine({
        code: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
        name: medicineName,
        category: 'General',
        batchNo,
        location: 'Unassigned',
        stock: Number(qty),
        minThreshold: 20,
        expiryDate,
        price: 20.00,
        hospitalId
      });
      await med.save();
    }
    res.json(med);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. GET Prescription Reference
pharmacyRouter.get('/prescription/:query', async (req, res) => {
  const { query } = req.params;
  const hospitalId = req.query.hospitalId || 'HOSP-123';
  try {
    const rx = await Prescription.findOne({
      $or: [
        { code: query.toUpperCase() },
        { patientPhone: query },
        { patientNo: { $regex: new RegExp(`^${query}$`, 'i') } }
      ],
      hospitalId,
      status: 'PENDING'
    });
    if (!rx) {
      return res.status(404).json({ message: 'No active prescription found.' });
    }
    res.json(rx);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. POST POS Checkout - Bulletproof ACID Mongoose Transactions with standalone local MongoDB fallback
pharmacyRouter.post('/checkout', async (req, res) => {
  const { rxCode, patientNo, patientName, patientPhone, doctorName, date, items, total, paymentMode, hospitalId } = req.body;
  const billDate = date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // 1. Try with session transaction first
  let session;
  let useTransaction = true;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (sessErr) {
    console.warn("[Mongoose Session Error] Replica sets not configured. Falling back to standard non-transactional checkout.", sessErr.message);
    useTransaction = false;
  }

  if (useTransaction && session) {
    try {
      console.log(`[ACID Transaction Start] Settle prescriptions: ${rxCode}`);

      // Step 1: Create Pharmacy Bill in session
      const newBill = await PharmacyBill.create([{
        rxCode,
        patientNo,
        patientName,
        patientPhone,
        doctorName,
        date: billDate,
        items,
        total: Number(total),
        paymentMode,
        hospitalId
      }], { session });

      // Step 2: Loop through items, verify quantities, and decrement stock
      for (const item of items) {
        const med = await Medicine.findOne({ _id: item.medicineId, hospitalId }).session(session);
        
        if (!med) {
          throw new Error(`Inventory Check Failed: Medicine ID ${item.medicineId} not registered.`);
        }
        
        if (med.stock < item.qty) {
          throw new Error(`Insufficient Stock: "${item.name}" has only ${med.stock} units, but ${item.qty} were requested.`);
        }

        // Decrement stock count
        med.stock -= item.qty;
        await med.save({ session });
        console.log(`[ACID Step] Decremented ${item.qty} units from "${item.name}". New Stock: ${med.stock}`);
      }

      // Step 3: Mark original doctor prescription as DISPENSED
      const rx = await Prescription.findOne({ code: rxCode, hospitalId }).session(session);
      if (rx) {
        rx.status = 'DISPENSED';
        await rx.save({ session });
        console.log(`[ACID Step] Prescription ${rxCode} flagged as DISPENSED.`);
      }

      // Commit all changes to database
      await session.commitTransaction();
      session.endSession();
      console.log(`[ACID Transaction Success] POS Bill clearing committed successfully! ID: ${newBill[0]._id}`);

      return res.status(201).json({
        success: true,
        message: 'Checkout completed successfully. Inventory state synchronized.',
        bill: newBill[0]
      });

    } catch (error) {
      // Rollback everything if any error occurs
      await session.abortTransaction();
      session.endSession();
      console.error(`[ACID Transaction Aborted & Rolled Back] Error: ${error.message}`);
      
      // If the error was explicitly about transaction numbers/replica set, let's fallback to standard checkout!
      if (error.message.includes('replica set') || error.message.includes('Transaction numbers') || error.message.includes('member')) {
        console.warn("[ACID Fallback] Re-attempting checkout without Mongoose sessions for standalone instance compatibility.");
        useTransaction = false;
      } else {
        return res.status(400).json({
          success: false,
          message: `Checkout failed, database state rolled back. Error: ${error.message}`
        });
      }
    }
  }

  // 2. Standalone local MongoDB checkout fallback (no transaction session)
  if (!useTransaction) {
    try {
      console.log(`[Standalone POS Checkout Start] Processing transaction-less checkouts: ${rxCode}`);
      
      // Step 1: Pre-validate stock availability for all items to simulate atomic safety
      for (const item of items) {
        const med = await Medicine.findOne({ _id: item.medicineId, hospitalId });
        if (!med) {
          return res.status(400).json({ success: false, message: `Inventory Check Failed: Medicine "${item.name}" not registered.` });
        }
        if (med.stock < item.qty) {
          return res.status(400).json({ success: false, message: `Insufficient Stock: "${item.name}" has only ${med.stock} units left.` });
        }
      }

      // Step 2: Deduct stock from inventory
      for (const item of items) {
        await Medicine.findOneAndUpdate(
          { _id: item.medicineId, hospitalId },
          { $inc: { stock: -item.qty } }
        );
        console.log(`[Standalone Step] Decremented ${item.qty} units from "${item.name}".`);
      }

      // Step 3: Mark original doctor prescription as DISPENSED
      const rx = await Prescription.findOneAndUpdate(
        { code: rxCode, hospitalId },
        { status: 'DISPENSED' }
      );
      if (rx) {
        console.log(`[Standalone Step] Prescription ${rxCode} flagged as DISPENSED.`);
      }

      // Step 4: Create Pharmacy Bill
      const newBill = await PharmacyBill.create({
        rxCode,
        patientNo,
        patientName,
        patientPhone,
        doctorName,
        date: billDate,
        items,
        total: Number(total),
        paymentMode,
        hospitalId
      });

      console.log(`[Standalone POS Checkout Success] Committed successfully! ID: ${newBill._id}`);
      return res.status(201).json({
        success: true,
        message: 'Checkout completed successfully. Inventory state synchronized (Standalone Fallback).',
        bill: newBill
      });

    } catch (error) {
      console.error(`[Standalone POS Checkout Failed] Error: ${error.message}`);
      return res.status(400).json({
        success: false,
        message: `Standalone checkout failed. Error: ${error.message}`
      });
    }
  }
});

// 6. PUT Update Medicine
pharmacyRouter.put('/inventory/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, batchNo, location, stock, minThreshold, expiryDate, price } = req.body;
  try {
    const updated = await Medicine.findByIdAndUpdate(id, {
      name,
      category,
      batchNo,
      location,
      stock: Number(stock),
      minThreshold: Number(minThreshold),
      expiryDate,
      price: Number(price)
    }, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 7. DELETE Medicine
pharmacyRouter.delete('/inventory/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Medicine.findByIdAndDelete(id);
    res.json({ message: 'Medicine catalog entry deleted.' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
