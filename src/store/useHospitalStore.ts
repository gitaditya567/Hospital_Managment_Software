import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

const getStoredApptDate = (phone?: string, name?: string) => {
  if (!phone || !name) return '';
  try {
    const key = `appt_date_${phone.trim()}_${name.trim()}`.toLowerCase();
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const setStoredApptDate = (phone?: string, name?: string, dateStr?: string) => {
  if (!phone || !name || !dateStr) return;
  try {
    const key = `appt_date_${phone.trim()}_${name.trim()}`.toLowerCase();
    localStorage.setItem(key, dateStr);
  } catch {}
};

export interface StaffMember {
  id: string;
  name: string;
  role: 'Doctor' | 'Receptionist' | 'Pharmacy';
  department?: string; // Optional for non-doctors
  contact: string;
  email: string;
  personalEmail?: string;
  status: 'Active' | 'Inactive' | 'On Leave';
  consultationFee?: number;
  roleHistory?: Array<{ previousRole: string; newRole: string; updatedAt: string }>;
}

export interface Department {
  id: string;
  name: string;
  head: string;
  staffCount: number;
  staffAssigned: string;
  beds: string;
  rooms: string;
  status: 'Active' | 'Setup Required';
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  doctorName: string;
  roomNumber: string;
  availability: string; // e.g. "10:00 AM - 02:00 PM"
  days: string; // e.g. "Mon, Wed, Fri"
}

export interface StandardFees {
  opdFee: number;
  emergencyFee: number;
  bedChargePerDay: number;
}

export interface PatientRecord {
  id: string;
  patientNo?: string;
  name: string;
  phone: string;
  age: number;
  gender?: string;
  doctorName: string;
  tokenNumber: string;
  timeRegistered: string;
  status: 'Waiting' | 'In Consultation' | 'Completed';
  waitTime?: string;
  createdAt?: string;
  vitals?: Array<{ name: string; value: string }>;
  pastDiagnoses?: string;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Pending';
  appointmentTime?: string;
  appointmentDate?: string;
}

export interface PatientInvoice {
  id: string;
  patientName: string;
  patientPhone: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending';
  doctorName: string;
  feeType: string;
  patientId?: string | null;
  paymentMode?: PaymentMode | '';
}

export type PaymentMode = 'Cash' | 'UPI' | 'Card';

export interface VisitFee {
  amount: number;
  feeType: string;
  paymentMode?: PaymentMode;
}

export interface Appointment {
  id: string;
  patientName: string;
  phone: string;
  age: number;
  gender: string;
  doctorId: string;
  doctorName: string;
  date: string; // YYYY-MM-DD
  time: string;
  notes: string;
  status: 'Booked' | 'Checked In' | 'Cancelled' | 'No Show';
  patientId: string | null;
}

export interface RegisteredVisit extends PatientRecord {
  invoice?: PatientInvoice | null;
}

const readError = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => ({}));
  return (data && data.message) || fallback;
};

const toInvoice = (i: any): PatientInvoice => ({
  id: i.invoiceNo || i._id || i.id,
  patientName: i.patientName,
  patientPhone: i.patientPhone,
  date: i.date,
  amount: i.amount,
  status: i.status,
  doctorName: i.doctorName,
  feeType: i.feeType,
  patientId: i.patientId || null,
  paymentMode: i.paymentMode || ''
});

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  maxDoctors: number;
  maxReceptionists: number;
  maxPharmacists: number;
  maxStorage: number;
  durationMonths: number;
}

export interface SubscriptionTenant {
  id: string;
  hospitalName: string;
  adminEmail: string;
  adminPhone: string;
  address: string;
  status: 'Active' | 'Suspended' | 'Past Due';
  licenseCodeUsed: string;
  subscriptionExpiryDate: string;
  planId: string;
  isTrial: boolean;
  staffCreated: number;
  storageUsed: number;
  createdAt?: string;
}

export interface SubscriptionInvoiceRow {
  id: string;
  hospitalName: string;
  planName: string;
  amount: number;
  status: 'Paid' | 'Failed' | 'Pending';
  date: string;
  method: 'Manual Invoice' | 'Stripe' | 'Razorpay';
}

export interface HospitalProfileDetails {
  adminEmail: string;
  adminPhone: string;
  address: string;
}

// Server errors come back as objects; never let them crash list rendering
const asArray = (value: any): any[] => (Array.isArray(value) ? value : []);

interface HospitalState {
  staff: StaffMember[];
  departments: Department[];
  schedules: DoctorSchedule[];
  fees: StandardFees;
  patients: PatientRecord[];
  invoices: PatientInvoice[];
  hospitalName: string;
  hospitalLogo: string;
  profileDetails: HospitalProfileDetails;
  subscriptionTenant: SubscriptionTenant | null;
  subscriptionPlans: SubscriptionPlan[];
  subscriptionInvoices: SubscriptionInvoiceRow[];
  fetchSubscription: () => Promise<void>;
  saveHospitalProfile: (updates: { hospitalName?: string; adminPhone?: string; address?: string; hospitalLogo?: string }) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;

  // Actions
  fetchHospitalData: (hospitalId: string) => Promise<void>;
  addStaff: (member: Omit<StaffMember, 'id' | 'status'> & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  toggleStaffStatus: (id: string) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  updateStaff: (id: string, updates: Partial<StaffMember> & { password?: string }) => Promise<{ success: boolean; error?: string }>;

  addDepartment: (name: string, head?: string, extras?: { beds?: string; staffAssigned?: string }) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<void>;

  addSchedule: (schedule: Omit<DoctorSchedule, 'id'>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<DoctorSchedule>) => Promise<void>;

  updateFees: (fees: Partial<StandardFees>) => Promise<void>;
  registerPatient: (patient: Omit<PatientRecord, 'id' | 'tokenNumber' | 'timeRegistered' | 'status'> & { payNow?: boolean; fee?: VisitFee }) => Promise<RegisteredVisit>;
  updatePatientStatus: (patientId: string, status: PatientRecord['status']) => Promise<void>;
  addPatientInvoice: (invoice: Omit<PatientInvoice, 'id' | 'date'>) => Promise<void>;
  collectPatientFee: (invoiceId: string, paymentMode?: PaymentMode) => Promise<void>;
  collectPatientFeeDirectly: (patientId: string, amount?: number, feeType?: string, paymentMode?: PaymentMode) => Promise<PatientInvoice | null>;
  cancelPatient: (patientId: string) => Promise<void>;
  renewSubscription: (hospitalId: string, licenseCode: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  appointments: Appointment[];
  fetchAppointments: (from?: string, to?: string) => Promise<void>;
  bookAppointment: (appt: Omit<Appointment, 'id' | 'status' | 'patientId' | 'notes'> & { notes?: string }) => Promise<Appointment>;
  updateAppointment: (id: string, updates: Partial<Pick<Appointment, 'status' | 'date' | 'time' | 'doctorId' | 'doctorName' | 'notes'>>) => Promise<Appointment>;
  checkInAppointment: (id: string, opts: { payNow: boolean; fee: VisitFee; vitals?: Array<{ name: string; value: string }>; pastDiagnoses?: string }) => Promise<RegisteredVisit>;
  setHospitalName: (name: string) => void;
  setHospitalLogo: (logo: string) => void;
}

export const useHospitalStore = create<HospitalState>((set, get) => ({
  staff: [],
  departments: [],
  schedules: [],
  fees: { opdFee: 500, emergencyFee: 1200, bedChargePerDay: 2500 },
  patients: [],
  invoices: [],
  hospitalName: localStorage.getItem('medisaas_hospital_name') || 'Smart Hospital',
  hospitalLogo: localStorage.getItem('medisaas_hospital_logo') || '',
  profileDetails: { adminEmail: '', adminPhone: '', address: '' },
  subscriptionTenant: null,
  subscriptionPlans: [],
  subscriptionInvoices: [],
  loading: false,

  fetchSubscription: async () => {
    try {
      const res = await fetch('/api/hospital/subscription');
      if (!res.ok) return;
      const data = await res.json();
      set({
        subscriptionTenant: data.tenant || null,
        subscriptionPlans: asArray(data.plans),
        subscriptionInvoices: asArray(data.invoices)
      });
    } catch (err) {
      console.error('Failed to load subscription details', err);
    }
  },

  saveHospitalProfile: async (updates) => {
    try {
      const res = await fetch('/api/hospital/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: data.message || 'Failed to save hospital profile.' };
      if (updates.hospitalName) get().setHospitalName(updates.hospitalName);
      if (updates.hospitalLogo !== undefined) get().setHospitalLogo(updates.hospitalLogo);
      set({
        profileDetails: {
          ...get().profileDetails,
          ...(updates.adminPhone !== undefined ? { adminPhone: updates.adminPhone } : {}),
          ...(updates.address !== undefined ? { address: updates.address } : {})
        }
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  },

  setHospitalName: (name: string) => {
    localStorage.setItem('medisaas_hospital_name', name);
    set({ hospitalName: name });
  },

  setHospitalLogo: (logo: string) => {
    localStorage.setItem('medisaas_hospital_logo', logo);
    set({ hospitalLogo: logo });
  },

  fetchHospitalData: async (hospitalId) => {
    set({ loading: true });
    try {
      const [staffRes, deptRes, schedRes, patientRes, invRes, feesRes, profileRes] = await Promise.all([
        fetch(`/api/hospital/staff?hospitalId=${hospitalId}`),
        fetch(`/api/hospital/departments?hospitalId=${hospitalId}`),
        fetch(`/api/hospital/schedules?hospitalId=${hospitalId}`),
        fetch(`/api/hospital/patients?hospitalId=${hospitalId}`),
        fetch(`/api/hospital/invoices?hospitalId=${hospitalId}`),
        fetch(`/api/hospital/fees?hospitalId=${hospitalId}`),
        fetch(`/api/hospital/profile?hospitalId=${hospitalId}`)
      ]);

      const staffData = asArray(await staffRes.json());
      const deptData = asArray(await deptRes.json());
      const schedData = asArray(await schedRes.json());
      const patientData = asArray(await patientRes.json());
      const invData = asArray(await invRes.json());
      const feesData = await feesRes.json();
      const profileData = await profileRes.json();

      set({
        staff: staffData.map((s: any) => ({
          id: s._id || s.id,
          name: s.name,
          role: s.role,
          department: s.department,
          contact: s.contact,
          email: s.email,
          personalEmail: s.personalEmail || '',
          status: s.status,
          consultationFee: typeof s.consultationFee === 'number' ? s.consultationFee : undefined,
          roleHistory: s.roleHistory || []
        })),
        departments: deptData.map((d: any) => ({
          id: d._id || d.id,
          name: d.name,
          head: d.head,
          staffCount: d.staffCount,
          staffAssigned: d.staffAssigned || '',
          beds: d.beds || '',
          rooms: d.rooms,
          status: d.status
        })),
        schedules: schedData.map((s: any) => ({
          id: s._id || s.id,
          doctorId: s.doctorId,
          doctorName: s.doctorName,
          roomNumber: s.roomNumber,
          availability: s.availability,
          days: s.days
        })),
        patients: (() => {
          const existingPatients = get().patients || [];
          return patientData.map((p: any) => {
            const existing = existingPatients.find(ep => (ep.id === p._id || ep.id === p.id));
            const savedDate = getStoredApptDate(p.phone, p.name);
            const finalApptDate = (p.appointmentDate && p.appointmentDate.trim() !== '') 
              ? p.appointmentDate 
              : (existing?.appointmentDate || savedDate || p.createdAt);

            return {
              id: p._id || p.id,
              patientNo: p.patientNo || existing?.patientNo,
              name: p.name,
              phone: p.phone,
              age: p.age,
              gender: p.gender,
              doctorName: p.doctorName,
              tokenNumber: p.tokenNumber,
              timeRegistered: p.timeRegistered,
              status: p.status,
              waitTime: p.waitTime,
              createdAt: p.createdAt,
              appointmentDate: finalApptDate,
              vitals: p.vitals || [],
              pastDiagnoses: p.pastDiagnoses || '',
              paymentStatus: p.paymentStatus || 'Paid',
              appointmentTime: p.appointmentTime || ''
            };
          });
        })(),
        invoices: invData.map(toInvoice),
        fees: feesData,
        hospitalName: profileData.hospitalName || get().hospitalName || 'Smart Hospital',
        hospitalLogo: profileData.hospitalLogo || get().hospitalLogo || localStorage.getItem('medisaas_hospital_logo') || '',
        profileDetails: {
          adminEmail: profileData.adminEmail || '',
          adminPhone: profileData.adminPhone || '',
          address: profileData.address || ''
        },
        loading: false
      });

      const activeLogo = profileData.hospitalLogo || get().hospitalLogo || localStorage.getItem('medisaas_hospital_logo');
      if (activeLogo) {
        localStorage.setItem('medisaas_hospital_logo', activeLogo);
      }
      if (profileData.hospitalName) {
        localStorage.setItem('medisaas_hospital_name', profileData.hospitalName);
      }
    } catch (error) {
      console.error('Failed to load hospital operations data', error);
      set({ loading: false });
    }
  },

  addStaff: async (member) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      const response = await fetch('/api/hospital/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...member, hospitalId })
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to add staff member' };
      }

      await get().fetchHospitalData(hospitalId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  },

  toggleStaffStatus: async (id) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    const store = get();
    const existing = store.staff.find(s => s.id === id);
    if (!existing) return;

    const newStatus = existing.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await fetch(`/api/hospital/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      await store.fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to toggle staff status', err);
    }
  },

  deleteStaff: async (id) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/staff/${id}`, { method: 'DELETE' });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to delete staff member', err);
    }
  },

  updateStaff: async (id, updates) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      const response = await fetch(`/api/hospital/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      if (!response.ok) return { success: false, error: data.message || 'Failed to update staff member' };

      await get().fetchHospitalData(hospitalId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  },

  addDepartment: async (name, head = 'Pending Assignment', extras = {}) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch('/api/hospital/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, head, hospitalId, ...extras })
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to add department', err);
    }
  },

  deleteDepartment: async (id) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/departments/${id}`, { method: 'DELETE' });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to delete department', err);
    }
  },

  updateDepartment: async (id, updates) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to update department', err);
    }
  },

  addSchedule: async (schedule) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch('/api/hospital/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...schedule, hospitalId })
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to add schedule', err);
    }
  },

  deleteSchedule: async (id) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/schedules/${id}`, { method: 'DELETE' });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to delete schedule', err);
    }
  },

  updateSchedule: async (id, updates) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to update schedule', err);
    }
  },

  updateFees: async (newFees) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch('/api/hospital/fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newFees, hospitalId })
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to update fees', err);
    }
  },

  registerPatient: async (patient) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      if ((patient as any).appointmentDate) {
        setStoredApptDate(patient.phone, patient.name, (patient as any).appointmentDate);
      }

      const response = await fetch('/api/hospital/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patient, hospitalId })
      });
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not register the patient. Please try again.'));
      }

      const data = await response.json();
      await get().fetchHospitalData(hospitalId);

      const targetDate = data.appointmentDate || (patient as any).appointmentDate || getStoredApptDate(patient.phone, patient.name) || data.createdAt;

      const created: RegisteredVisit = {
        id: data._id || data.id,
        patientNo: data.patientNo,
        name: data.name,
        phone: data.phone,
        age: data.age,
        gender: data.gender,
        doctorName: data.doctorName,
        tokenNumber: data.tokenNumber,
        timeRegistered: data.timeRegistered,
        status: data.status,
        waitTime: data.waitTime,
        appointmentDate: targetDate,
        vitals: data.vitals || [],
        pastDiagnoses: data.pastDiagnoses || '',
        paymentStatus: data.paymentStatus,
        createdAt: data.createdAt
      };

      set(state => {
        const exists = state.patients.some(p => p.id === created.id || (p.phone === created.phone && p.name === created.name));
        return {
          patients: exists
            ? state.patients.map(p => (p.id === created.id || (p.phone === created.phone && p.name === created.name)) ? { ...p, ...created, appointmentDate: targetDate } : p)
            : [created, ...state.patients]
        };
      });

      return { ...created, invoice: data.invoice ? toInvoice(data.invoice) : null };
    } catch (err) {
      console.error('Failed to register patient', err);
      throw err;
    }
  },

  updatePatientStatus: async (patientId, status) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to update patient status', err);
    }
  },

  addPatientInvoice: async (invoice) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch('/api/hospital/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...invoice, hospitalId })
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to add patient invoice', err);
    }
  },

  collectPatientFee: async (invoiceId, paymentMode) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/invoices/${invoiceId}/collect`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMode })
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to collect patient fee', err);
    }
  },

  collectPatientFeeDirectly: async (patientId, amount, feeType = 'OPD Consultation Fee', paymentMode) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      const res = await fetch(`/api/hospital/patients/${patientId}/collect-fee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, feeType, paymentMode })
      });
      const data = await res.json().catch(() => ({}));
      await get().fetchHospitalData(hospitalId);
      return res.ok && data.invoice ? toInvoice(data.invoice) : null;
    } catch (err) {
      console.error('Failed to collect patient fee directly', err);
      return null;
    }
  },

  cancelPatient: async (patientId: string) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/patients/${patientId}`, { method: 'DELETE' });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to cancel patient appointment', err);
    }
  },

  appointments: [],

  fetchAppointments: async (from, to) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      const res = await fetch(`/api/hospital/appointments?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ appointments: asArray(data) });
    } catch (err) {
      console.error('Failed to load appointments', err);
    }
  },

  bookAppointment: async (appt) => {
    const res = await fetch('/api/hospital/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appt)
    });
    if (!res.ok) throw new Error(await readError(res, 'Could not book the appointment.'));
    const created: Appointment = await res.json();
    set(state => ({ appointments: [...state.appointments, created] }));
    return created;
  },

  updateAppointment: async (id, updates) => {
    const res = await fetch(`/api/hospital/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(await readError(res, 'Could not update the appointment.'));
    const updated: Appointment = await res.json();
    set(state => ({ appointments: state.appointments.map(a => (a.id === id ? updated : a)) }));
    return updated;
  },

  checkInAppointment: async (id, opts) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '';
    const res = await fetch(`/api/hospital/appointments/${id}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts)
    });
    if (!res.ok) throw new Error(await readError(res, 'Could not check in this appointment.'));
    const data = await res.json();
    set(state => ({ appointments: state.appointments.map(a => (a.id === id ? data.appointment : a)) }));
    await get().fetchHospitalData(hospitalId);
    const p = data.patient;
    return {
      id: p._id || p.id,
      patientNo: p.patientNo,
      name: p.name,
      phone: p.phone,
      age: p.age,
      gender: p.gender,
      doctorName: p.doctorName,
      tokenNumber: p.tokenNumber,
      timeRegistered: p.timeRegistered,
      status: p.status,
      paymentStatus: p.paymentStatus,
      createdAt: p.createdAt,
      appointmentTime: p.appointmentTime,
      appointmentDate: p.appointmentDate,
      invoice: p.invoice ? toInvoice(p.invoice) : null
    };
  },

  renewSubscription: async (hospitalId, licenseCode) => {
    try {
      const response = await fetch('/api/hospital/renew-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId, licenseCode })
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Renewal failed.' };
      }
      await Promise.all([get().fetchHospitalData(hospitalId), get().fetchSubscription()]);
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  }
}));
