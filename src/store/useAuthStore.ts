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
  login: (email: string, password: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  initialize: () => void;
}

const getInitialAuth = () => {
  try {
    const token = localStorage.getItem('medisaas_token');
    const userJson = localStorage.getItem('medisaas_user');
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

  login: async (email, password, code) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, code })
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Login failed. Invalid email or password.' };
      }

      const { token, user } = data;
      localStorage.setItem('medisaas_token', token);
      localStorage.setItem('medisaas_user', JSON.stringify(user));

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
    localStorage.removeItem('medisaas_token');
    localStorage.removeItem('medisaas_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  initialize: () => {
    const token = localStorage.getItem('medisaas_token');
    const userJson = localStorage.getItem('medisaas_user');
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
        localStorage.removeItem('medisaas_token');
        localStorage.removeItem('medisaas_user');
      }
    }
  }
}));
