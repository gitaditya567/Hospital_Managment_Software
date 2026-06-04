import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '../../store/useAuthStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useHospitalStore } from '../../store/useHospitalStore';
import { usePharmacyStore } from '../../store/usePharmacyStore';

import { ShieldAlert, LogOut } from 'lucide-react';

export function DashboardLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const fetchSuperAdminData = useSuperAdminStore((state) => state.fetchSuperAdminData);
  const fetchHospitalData = useHospitalStore((state) => state.fetchHospitalData);
  const fetchPharmacyData = usePharmacyStore((state) => state.fetchPharmacyData);

  const [isSuspended, setIsSuspended] = useState(false);
  const [countdown, setCountdown] = useState(120); // 2 minutes (120s) countdown

  useEffect(() => {
    if (!user) return;

    if (user.role === 'SUPER_ADMIN') {
      fetchSuperAdminData();
    } else if (user.hospitalId) {
      // Fetch hospital operational data
      fetchHospitalData(user.hospitalId);
      
      // Fetch pharmacy specific inventory/orders
      fetchPharmacyData(user.hospitalId);
    }
  }, [user, fetchSuperAdminData, fetchHospitalData, fetchPharmacyData]);

  // Periodic suspension status check
  useEffect(() => {
    if (!user || user.role === 'SUPER_ADMIN' || !user.hospitalId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/auth/hospital-status/${user.hospitalId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'Suspended') {
            setIsSuspended(true);
          } else {
            setIsSuspended(false);
          }
        }
      } catch (err) {
        console.error('Failed to query hospital status', err);
      }
    };

    // Check immediately
    checkStatus();

    // Poll every 8 seconds for extremely responsive enforcement
    const interval = setInterval(checkStatus, 8000);
    return () => clearInterval(interval);
  }, [user]);

  // Countdown timer for automatic logout
  useEffect(() => {
    if (!isSuspended) return;

    if (countdown <= 0) {
      logout();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isSuspended, countdown, logout]);

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Hospital Suspension Block Alert (Sleek Red Modal Panel) */}
      {isSuspended && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-xl bg-slate-950/90 animate-in fade-in duration-300 font-sans">
          <div className="relative max-w-lg w-full bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-8 shadow-[0_0_50px_rgba(244,63,94,0.15)] text-center space-y-6 overflow-hidden">
            {/* Ambient Red Glow decor */}
            <div className="absolute -top-12 -left-12 w-40 h-40 bg-rose-600/20 rounded-full blur-[60px] pointer-events-none"></div>
            <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-rose-600/20 rounded-full blur-[60px] pointer-events-none"></div>

            {/* Pulsing Icon */}
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
              <ShieldAlert size={48} className="animate-pulse" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-white uppercase">
                Hospital Node Suspended
              </h1>
              <p className="text-xs text-rose-400 font-bold uppercase tracking-widest font-mono">
                Security Restriction Active
              </p>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
              Your hospital's system node has been suspended by the central platform operator. Operations are frozen and database connections are locked.
            </p>

            {/* Countdown Box */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl py-4 px-6 max-w-xs mx-auto space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Session Forced Termination
              </div>
              <div className="text-2xl font-black font-mono text-rose-500 animate-pulse flex items-center justify-center gap-2">
                <span>⏱</span> {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => logout()}
                className="w-full h-12 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogOut size={16} /> Terminate & Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
