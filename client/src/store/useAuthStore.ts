import { create } from 'zustand';

export type UserRole = 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'RECEPTIONIST' | 'DOCTOR' | 'PHARMACY' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hospitalId: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string, code: string, role?: string) => Promise<{ success: boolean; error?: string; lockoutUntil?: number; failedAttempts?: number }>;
  logout: () => void;
  initialize: () => void;
}

const getInitialAuth = () => {
  try {
    const token = localStorage.getItem('smarthospital_token') || localStorage.getItem('medisaas_token');
    const userJson = localStorage.getItem('smarthospital_user') || localStorage.getItem('medisaas_user');
    if (token && userJson) {
      const user = JSON.parse(userJson);
      return {
        token,
        user: {
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          hospitalId: user.hospitalId
        },
        isAuthenticated: true
      };
    }
  } catch (e) {
    console.error('Failed to parse auth token or user info', e);
  }
  return { token: null, user: null, isAuthenticated: false };
};

const initialAuth = getInitialAuth();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialAuth.user,
  isAuthenticated: initialAuth.isAuthenticated,
  token: initialAuth.token,

  login: async (email, password, code, role) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, code, role })
      });

      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (e) {
          return { success: false, error: 'Received invalid response format from server. Please try again.' };
        }
      } else {
        const text = await response.text();
        return {
          success: false,
          error: text ? `Server error: ${text.slice(0, 100)}` : `Server connection error (${response.status}). Please verify backend server status.`
        };
      }

      if (!response.ok) {
        return { 
          success: false, 
          error: data.message || 'Login failed. Invalid email or password.',
          lockoutUntil: data.lockoutUntil,
          failedAttempts: data.failedAttempts
        };
      }

      const { token, user } = data;
      localStorage.setItem('smarthospital_token', token);
      localStorage.setItem('smarthospital_user', JSON.stringify(user));

      set({
        token,
        user: {
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          hospitalId: user.hospitalId
        },
        isAuthenticated: true
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error. Unable to contact authentication server.' };
    }
  },

  logout: () => {
    localStorage.removeItem('smarthospital_token');
    localStorage.removeItem('smarthospital_user');
    localStorage.removeItem('medisaas_token');
    localStorage.removeItem('medisaas_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  initialize: () => {
    const token = localStorage.getItem('smarthospital_token') || localStorage.getItem('medisaas_token');
    const userJson = localStorage.getItem('smarthospital_user') || localStorage.getItem('medisaas_user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        set({
          token,
          user: {
            id: user.id || user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            hospitalId: user.hospitalId
          },
          isAuthenticated: true
        });
      } catch (e) {
        localStorage.removeItem('smarthospital_token');
        localStorage.removeItem('smarthospital_user');
        localStorage.removeItem('medisaas_token');
        localStorage.removeItem('medisaas_user');
      }
    }
  }
}));
