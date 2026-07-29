import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useHospitalStore } from '../../store/useHospitalStore';
import { cn } from '../../lib/utils';
import { 
  LayoutDashboard, 
  Building2, 
  Key, 
  Users,
  Settings,
  CreditCard,
  ClipboardList,
  Pill,
  ShoppingCart,
  LineChart,
  Calendar,
  PanelLeftClose,
  UserPlus
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuthStore();
  const { settings } = useSuperAdminStore();
  const { hospitalLogo } = useHospitalStore();
  const platformTitle = settings?.platformName || 'Smart Hospital Management Software';

  const getLinks = () => {
    if (!user) return [];

    switch (user.role) {
      case 'SUPER_ADMIN':
        return [
          { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard' },
          { to: '/super-admin/hospitals', icon: Building2, label: 'Hospitals & Clinics' },
          { to: '/super-admin/licenses', icon: Key, label: 'License Management' },
          { to: '/super-admin/plans', icon: CreditCard, label: 'Subscription Plans' },
          { to: '/super-admin/financials', icon: LineChart, label: 'Financials & Revenue' },
          { to: '/super-admin/settings', icon: Settings, label: 'Platform Settings' },
        ];
      case 'HOSPITAL_ADMIN':
        return [
          { to: '/hospital-admin', icon: LayoutDashboard, label: 'Dashboard' },
          { to: '/hospital-admin/staff', icon: Users, label: 'Staff Management' },
          // { to: '/hospital-admin/departments', icon: Building2, label: 'Departments & Rooms' },
          { to: '/hospital-admin/billing', icon: CreditCard, label: 'Hospital Billing' },
          { to: '/hospital-admin/settings', icon: Settings, label: 'Hospital Profile' },
        ];
      case 'RECEPTIONIST':
        return [
          { to: '/receptionist', icon: LayoutDashboard, label: 'OPD Queue & Check-In' },
          { to: '/receptionist/patients', icon: Users, label: 'Patient Directory' },
          { to: '/receptionist/appointments', icon: Calendar, label: 'Doctor Schedules' },
          { to: '/receptionist/invoices', icon: CreditCard, label: 'OPD Fee Collection' },
        ];
      case 'DOCTOR':
        return [
          { to: '/doctor', icon: LayoutDashboard, label: 'My Consultations' },
          { to: '/doctor/search', icon: Users, label: 'E-Prescription Gateway' },
        ];
      case 'PHARMACY':
        return [
          { to: '/pharmacy', icon: LayoutDashboard, label: 'Dispense Prescriptions' },
          { to: '/pharmacy/inventory', icon: Pill, label: 'Stock & Medicine Batches' },
          { to: '/pharmacy/orders', icon: ShoppingCart, label: 'Billing & POS Orders' },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-64 bg-gradient-to-b from-teal-50/80 via-white to-blue-50/50 text-slate-700 border-r border-teal-100/60 shadow-[4px_0_24px_rgba(13,148,136,0.02)] backdrop-blur-md transition-all duration-300 ease-in-out flex flex-col shrink-0 overflow-hidden",
          isOpen ? "translate-x-0 md:static md:w-64" : "-translate-x-full md:-translate-x-full md:fixed md:w-0"
        )}
      >
        <div className="h-16 flex items-center justify-between px-5 bg-white border-b border-teal-50 text-slate-800 font-extrabold tracking-tight">
          <div className="flex items-center min-w-0">
            {hospitalLogo ? (
              <div className="h-9 w-9 rounded-full border-2 border-teal-500/80 p-0.5 bg-white shadow-sm overflow-hidden flex items-center justify-center mr-3 shrink-0">
                <img src={hospitalLogo} alt="Logo" className="w-full h-full object-contain rounded-full" />
              </div>
            ) : (
              <span className="bg-gradient-to-br from-teal-400 to-cyan-500 text-white h-9 w-9 rounded-2xl flex items-center justify-center font-extrabold text-base shadow-[0_0_15px_rgba(20,184,166,0.3)] animate-heartbeat mr-3 shrink-0">✚</span>
            )}
            <div className="flex flex-col min-w-0">
              <span className="bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-transparent text-xs font-black tracking-tight leading-tight truncate">
                {platformTitle}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors border border-slate-100/80 shrink-0"
            title="Hide Sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to.split('/').length === 2}
                onClick={() => onClose()}
                className={({ isActive }) => cn(
                  "flex items-center px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 group border border-transparent",
                  isActive 
                    ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20 border-teal-400/20" 
                    : "text-slate-600 hover:bg-teal-50/50 hover:text-teal-700 hover:translate-x-[4px]"
                )}
              >
                <Icon size={18} className="mr-3 opacity-70 group-hover:opacity-100 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 bg-white/60 border-t border-teal-50/60 flex flex-col gap-2 items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-[9px] text-emerald-800 font-extrabold justify-center w-full shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span>CLINICAL CONNECTED</span>
          </div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">v1.0.0 Premium</div>
          <div className="mt-1 px-3.5 py-1 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-full text-[10px] font-black tracking-wide shadow-sm shadow-teal-500/20 border border-teal-400/30 flex items-center gap-1.5 hover:scale-105 transition-transform cursor-pointer">
            <span className="text-amber-300">©</span> Copyright @twinsCloud
          </div>
        </div>
      </aside>
    </>
  );
}
