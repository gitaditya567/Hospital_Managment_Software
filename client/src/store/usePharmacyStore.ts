import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

export interface MedicineBatch {
  batchNo: string;
  expiryDate: string;
  qty: number;
  supplier: string;
  receivedAt?: string;
}

export interface Medicine {
  id: string;
  code: string;
  name: string;
  category: string;
  batchNo: string;
  location: string;
  stock: number;
  minThreshold: number;
  expiryDate: string; // YYYY-MM-DD (earliest batch still in stock)
  price: number;
  batches?: MedicineBatch[];
}

export interface PharmacyBillItem {
  medicineId: string;
  name: string;
  qty: number;
  price: number;
}

export type PaymentMode = 'Cash' | 'Card' | 'UPI';

export interface PharmacyBill {
  id: string;
  billNo: string;
  saleType: 'Prescription' | 'Counter';
  rxCode: string;
  patientNo?: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  date: string;
  items: PharmacyBillItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMode: PaymentMode;
  createdAt?: string;
}

export interface PrescriptionItem {
  name: string;
  qty: number;
  price: number;
  dosage?: string;
  timing?: string;
  duration?: string;
}

export interface Prescription {
  id: string; // the Rx code, e.g. "RX-K3P2123"
  patientNo?: string;
  patientId?: string | null;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  date: string;
  status: 'PENDING' | 'DISPENSED';
  items: PrescriptionItem[];
  diagnosis?: string;
  advice?: string;
  createdAt?: string;
}

export interface CheckoutInput {
  rxCode?: string; // omit for a counter (OTC) sale
  patientNo?: string;
  patientName?: string;
  patientPhone?: string;
  doctorName?: string;
  items: Array<{ medicineId?: string; name: string; qty: number }>;
  paymentMode: PaymentMode;
  discount?: number;
}

interface PharmacyState {
  inventory: Medicine[];
  prescriptions: Prescription[];
  bills: PharmacyBill[];
  loading: boolean;
  lastSync: number;
  /** Kept for older admin pages; no longer filled with simulated messages */
  transactionLogs: string[];

  fetchPharmacyData: (hospitalId?: string) => Promise<void>;
  addMedicine: (med: Omit<Medicine, 'id' | 'code'> & { code?: string }) => Promise<{ success: boolean; error?: string }>;
  receiveStockBatch: (data: {
    medicineId?: string;
    medicineName: string;
    supplier: string;
    batchNo: string;
    expiryDate: string;
    qty: number;
    price?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  dispensePrescription: (data: CheckoutInput) => Promise<{ success: boolean; error?: string; bill?: PharmacyBill }>;
  updateMedicine: (id: string, updates: Partial<Medicine>) => Promise<{ success: boolean; error?: string }>;
  deleteMedicine: (id: string) => Promise<void>;
  clearLogs: () => void;
}

const asArray = (v: any): any[] => (Array.isArray(v) ? v : []);

const toMedicine = (m: any): Medicine => ({
  id: m._id || m.id,
  code: m.code,
  name: m.name,
  category: m.category,
  batchNo: m.batchNo,
  location: m.location,
  stock: m.stock,
  minThreshold: m.minThreshold,
  expiryDate: m.expiryDate,
  price: m.price,
  batches: asArray(m.batches)
});

const toBill = (b: any): PharmacyBill => ({
  id: b._id || b.id,
  billNo: b.billNo || '',
  saleType: b.saleType || (b.rxCode ? 'Prescription' : 'Counter'),
  rxCode: b.rxCode || '',
  patientNo: b.patientNo,
  patientName: b.patientName,
  patientPhone: b.patientPhone || '',
  doctorName: b.doctorName || '',
  date: b.date,
  items: asArray(b.items),
  subtotal: typeof b.subtotal === 'number' && b.subtotal > 0 ? b.subtotal : b.total,
  discount: b.discount || 0,
  total: b.total,
  paymentMode: b.paymentMode,
  createdAt: b.createdAt
});

const toPrescription = (p: any): Prescription => ({
  id: p.code || p.id,
  patientNo: p.patientNo,
  patientId: p.patientId || null,
  patientName: p.patientName,
  patientPhone: p.patientPhone,
  doctorName: p.doctorName,
  date: p.date,
  status: p.status,
  items: asArray(p.items),
  diagnosis: p.diagnosis || '',
  advice: p.advice || '',
  createdAt: p.createdAt
});

const message = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => ({}));
  return (data && data.message) || fallback;
};

export const usePharmacyStore = create<PharmacyState>((set, get) => ({
  inventory: [],
  prescriptions: [],
  bills: [],
  loading: false,
  lastSync: 0,
  transactionLogs: [],

  fetchPharmacyData: async () => {
    if (!useAuthStore.getState().user?.hospitalId) return;
    set({ loading: true });
    try {
      const [invRes, rxRes, billRes] = await Promise.all([
        fetch('/api/pharmacy/inventory'),
        fetch('/api/pharmacy/prescriptions'),
        fetch('/api/pharmacy/bills')
      ]);
      const [inv, rx, bills] = await Promise.all([invRes.json(), rxRes.json(), billRes.json()]);
      set({
        inventory: asArray(inv).map(toMedicine),
        prescriptions: asArray(rx).map(toPrescription),
        bills: asArray(bills).map(toBill),
        loading: false,
        lastSync: Date.now()
      });
    } catch (error) {
      console.error('Failed to load pharmacy data', error);
      set({ loading: false });
    }
  },

  addMedicine: async (med) => {
    try {
      const res = await fetch('/api/pharmacy/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(med)
      });
      if (!res.ok) return { success: false, error: await message(res, 'Could not add the medicine.') };
      await get().fetchPharmacyData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  },

  receiveStockBatch: async (data) => {
    try {
      const res = await fetch('/api/pharmacy/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) return { success: false, error: await message(res, 'Could not receive this batch.') };
      await get().fetchPharmacyData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  },

  dispensePrescription: async (data) => {
    try {
      const res = await fetch('/api/pharmacy/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await message(res, 'Billing failed. Nothing was charged.');
        await get().fetchPharmacyData();
        return { success: false, error };
      }
      const resData = await res.json();
      await get().fetchPharmacyData();
      return { success: true, bill: toBill(resData.bill) };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  },

  updateMedicine: async (id, updates) => {
    try {
      const res = await fetch(`/api/pharmacy/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) return { success: false, error: await message(res, 'Could not update the medicine.') };
      await get().fetchPharmacyData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  },

  deleteMedicine: async (id) => {
    try {
      await fetch(`/api/pharmacy/inventory/${id}`, { method: 'DELETE' });
      await get().fetchPharmacyData();
    } catch (err) {
      console.error('Failed to delete medicine', err);
    }
  },

  clearLogs: () => set({ transactionLogs: [] })
}));
