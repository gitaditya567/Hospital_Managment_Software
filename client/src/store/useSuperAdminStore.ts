import { create } from 'zustand';

export interface Plan {
  id: string;
  name: string;
  price: number; // in INR
  maxDoctors: number; // -1 for unlimited
  maxReceptionists: number; // -1 for unlimited
  maxPharmacists: number; // -1 for unlimited
  maxStorage: number; // in GB
  durationMonths: number;
}

export interface LicenseCode {
  code: string;
  planId: string;
  isUsed: boolean;
  status: 'Unused' | 'Active' | 'Expired';
  activatedByHospitalId: string | null; // Tenant ID
  createdAt: string;
  validityMonths: number;
}

export interface Tenant {
  id: string;
  hospitalName: string;
  adminEmail: string;
  adminPhone?: string;
  address: string;
  status: 'Active' | 'Suspended' | 'Past Due';
  licenseCodeUsed: string;
  subscriptionExpiryDate: string;
  staffCreated: number;
  storageUsed: number; // in MB
  planId: string;
}

export interface Invoice {
  id: string;
  hospitalName: string;
  planName: string;
  amount: number;
  status: 'Paid' | 'Failed' | 'Pending';
  date: string;
  method: 'Manual Invoice' | 'Stripe' | 'Razorpay';
}

export interface Activity {
  id: string;
  description: string;
  type: 'hospital' | 'license' | 'plan' | 'payment' | 'system';
  timestamp: string;
}

export interface PlatformSettings {
  platformName: string;
  maintenanceMode: boolean;
  supportEmail: string;
  allowManualOnboarding: boolean;
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
  taxRate: number; // percentage
}

interface SuperAdminState {
  plans: Plan[];
  licenses: LicenseCode[];
  tenants: Tenant[];
  invoices: Invoice[];
  activities: Activity[];
  settings: PlatformSettings;
  searchQuery: string;
  loading: boolean;

  // Actions
  fetchSuperAdminData: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  generateLicense: (planId: string, validityMonths: number) => Promise<string>;
  revokeLicense: (code: string) => Promise<void>;
  deleteLicense: (code: string) => Promise<void>;

  onboardHospital: (hospital: Omit<Tenant, 'id' | 'status' | 'staffCreated' | 'storageUsed'> & { adminPhone?: string; adminPassword?: string }) => Promise<{
    success: boolean;
    adminEmail?: string;
    adminPhone?: string;
    generatedPassword?: string;
    licenseCodeUsed?: string;
    error?: string;
  }>;
  updateTenant: (id: string, updated: Partial<Tenant>) => Promise<void>;
  deleteTenant: (id: string) => Promise<void>;
  toggleTenantStatus: (tenantId: string) => Promise<void>; // Suspend / Reactivate

  addPlan: (plan: Omit<Plan, 'id'>) => Promise<void>;
  updatePlan: (id: string, updated: Partial<Plan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;

  updateSettings: (settings: Partial<PlatformSettings>) => Promise<void>;
  addActivity: (description: string, type: Activity['type']) => Promise<void>;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'date'>) => Promise<void>;
  exportBackup: () => Promise<void>;
  sendDiagnostics: () => Promise<string>;
}

export const useSuperAdminStore = create<SuperAdminState>((set, get) => ({
  plans: [],
  licenses: [],
  tenants: [],
  invoices: [],
  activities: [],
  settings: {
    platformName: 'MediSaaS Central Control',
    maintenanceMode: false,
    supportEmail: 'superadmin.support@medisaas.com',
    allowManualOnboarding: true,
    stripeEnabled: true,
    razorpayEnabled: true,
    taxRate: 18,
  },
  searchQuery: '',
  loading: false,

  fetchSuperAdminData: async () => {
    set({ loading: true });
    try {
      const [plansRes, licRes, tenantsRes, invRes, actRes, settingsRes] = await Promise.all([
        fetch('/api/superadmin/plans'),
        fetch('/api/superadmin/licenses'),
        fetch('/api/superadmin/tenants'),
        fetch('/api/superadmin/invoices'),
        fetch('/api/superadmin/activities'),
        fetch('/api/superadmin/settings')
      ]);

      const plansData = await plansRes.json();
      const licensesData = await licRes.json();
      const tenantsData = await tenantsRes.json();
      const invoicesData = await invRes.json();
      const activitiesData = await actRes.json();
      const settingsData = await settingsRes.json();

      set({
        plans: plansData,
        licenses: licensesData.map((l: any) => ({
          code: l.code,
          planId: l.planId,
          isUsed: l.isUsed,
          status: l.status === 'Used' ? 'Active' : l.status,
          activatedByHospitalId: l.activatedByHospitalId || null,
          createdAt: l.createdAt,
          validityMonths: l.validityMonths
        })),
        tenants: tenantsData,
        invoices: invoicesData.map((inv: any) => ({
          id: inv._id || inv.id,
          hospitalName: inv.hospitalName,
          planName: inv.planName,
          amount: inv.amount,
          status: inv.status,
          date: inv.date,
          method: inv.method
        })),
        activities: activitiesData.map((act: any) => ({
          id: act._id || act.id,
          description: act.description,
          type: act.type,
          timestamp: act.timestamp
        })),
        settings: settingsData,
        loading: false
      });
    } catch (error) {
      console.error('Failed to fetch Super Admin platform data', error);
      set({ loading: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  generateLicense: async (planId, validityMonths) => {
    try {
      const response = await fetch('/api/superadmin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, validityMonths })
      });

      const data = await response.json();
      await get().fetchSuperAdminData();
      return data.code;
    } catch (err) {
      console.error('Failed to generate license key', err);
      return 'ERROR';
    }
  },

  revokeLicense: async (code) => {
    try {
      await fetch(`/api/superadmin/licenses/${code}/revoke`, { method: 'PUT' });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to revoke license', err);
    }
  },

  deleteLicense: async (code) => {
    try {
      await fetch(`/api/superadmin/licenses/${code}`, { method: 'DELETE' });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to delete license', err);
    }
  },

  onboardHospital: async (hospital) => {
    try {
      const response = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hospital)
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Onboarding failed.' };
      }

      await get().fetchSuperAdminData();
      return {
        success: true,
        adminEmail: data.adminEmail,
        adminPhone: data.adminPhone,
        generatedPassword: data.generatedPassword,
        licenseCodeUsed: data.licenseCodeUsed
      };
    } catch (err: any) {
      console.error('Failed to onboard hospital', err);
      return { success: false, error: err.message || 'Server connection error.' };
    }
  },

  updateTenant: async (id, updated) => {
    try {
      await fetch(`/api/superadmin/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to update tenant details', err);
    }
  },

  deleteTenant: async (id) => {
    try {
      await fetch(`/api/superadmin/tenants/${id}`, { method: 'DELETE' });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to delete hospital tenant', err);
    }
  },

  toggleTenantStatus: async (tenantId) => {
    try {
      await fetch(`/api/superadmin/tenants/${tenantId}/toggle`, { method: 'PUT' });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to toggle tenant status', err);
    }
  },

  addPlan: async (plan) => {
    try {
      await fetch('/api/superadmin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to add plan', err);
    }
  },

  updatePlan: async (id, updated) => {
    try {
      await fetch(`/api/superadmin/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to update plan', err);
    }
  },

  deletePlan: async (id) => {
    try {
      await fetch(`/api/superadmin/plans/${id}`, {
        method: 'DELETE'
      });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to delete plan', err);
    }
  },

  updateSettings: async (settings) => {
    try {
      await fetch('/api/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to update system configurations', err);
    }
  },

  addActivity: async (description, type) => {
    try {
      await fetch('/api/superadmin/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, type })
      });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to add platform activity log', err);
    }
  },

  addInvoice: async (invoice) => {
    try {
      await fetch('/api/superadmin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
      });
      await get().fetchSuperAdminData();
    } catch (err) {
      console.error('Failed to add payment invoice log', err);
    }
  },

  exportBackup: async () => {
    try {
      const response = await fetch('/api/superadmin/backup');
      if (!response.ok) throw new Error('Backup failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medisaas_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download database backup', err);
      throw err;
    }
  },

  sendDiagnostics: async () => {
    try {
      const response = await fetch('/api/superadmin/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Diagnostics compile failed');
      const data = await response.json();
      await get().fetchSuperAdminData();
      return data.token;
    } catch (err) {
      console.error('Failed to run diagnostics', err);
      throw err;
    }
  }
}));
