import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

export interface StaffMember {
  id: string;
  name: string;
  role: 'Doctor' | 'Receptionist' | 'Pharmacy';
  department?: string; // Optional for non-doctors
  contact: string;
  email: string;
  personalEmail?: string;
  status: 'Active' | 'Inactive' | 'On Leave';
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
}

interface HospitalState {
  staff: StaffMember[];
  departments: Department[];
  schedules: DoctorSchedule[];
  fees: StandardFees;
  patients: PatientRecord[];
  invoices: PatientInvoice[];
  hospitalName: string;
  hospitalLogo: string;
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
  registerPatient: (patient: Omit<PatientRecord, 'id' | 'tokenNumber' | 'timeRegistered' | 'status'> & { payNow?: boolean }) => Promise<PatientRecord>;
  updatePatientStatus: (patientId: string, status: PatientRecord['status']) => Promise<void>;
  addPatientInvoice: (invoice: Omit<PatientInvoice, 'id' | 'date'>) => Promise<void>;
  collectPatientFee: (invoiceId: string) => Promise<void>;
  collectPatientFeeDirectly: (patientId: string, amount?: number, feeType?: string) => Promise<void>;
  cancelPatient: (patientId: string) => Promise<void>;
  renewSubscription: (hospitalId: string, licenseCode: string) => Promise<{ success: boolean; message?: string; error?: string }>;
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
  loading: false,

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

      const staffData = await staffRes.json();
      const deptData = await deptRes.json();
      const schedData = await schedRes.json();
      const patientData = await patientRes.json();
      const invData = await invRes.json();
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
        patients: patientData.map((p: any) => ({
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
          waitTime: p.waitTime,
          createdAt: p.createdAt,
          vitals: p.vitals || [],
          pastDiagnoses: p.pastDiagnoses || '',
          paymentStatus: p.paymentStatus || 'Paid',
          appointmentTime: p.appointmentTime || ''
        })),
        invoices: invData.map((i: any) => ({
          id: i.invoiceNo || i._id || i.id,
          patientName: i.patientName,
          patientPhone: i.patientPhone,
          date: i.date,
          amount: i.amount,
          status: i.status,
          doctorName: i.doctorName,
          feeType: i.feeType
        })),
        fees: feesData,
        hospitalName: profileData.hospitalName || get().hospitalName || 'Smart Hospital',
        hospitalLogo: profileData.hospitalLogo || get().hospitalLogo || localStorage.getItem('medisaas_hospital_logo') || '',
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
      const response = await fetch('/api/hospital/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patient, hospitalId })
      });

      const data = await response.json();
      await get().fetchHospitalData(hospitalId);

      const created: PatientRecord = {
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
        vitals: data.vitals || [],
        pastDiagnoses: data.pastDiagnoses || ''
      };

      return created;
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

  collectPatientFee: async (invoiceId) => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/invoices/${invoiceId}/collect`, {
        method: 'PUT'
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to collect patient fee', err);
    }
  },

  collectPatientFeeDirectly: async (patientId, amount = 500, feeType = 'OPD Consultation Fee') => {
    const hospitalId = useAuthStore.getState().user?.hospitalId || '65f3d9b1c92d5a3f124a9001';
    try {
      await fetch(`/api/hospital/patients/${patientId}/collect-fee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, feeType })
      });
      await get().fetchHospitalData(hospitalId);
    } catch (err) {
      console.error('Failed to collect patient fee directly', err);
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
      await get().fetchHospitalData(hospitalId);
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  }
}));
