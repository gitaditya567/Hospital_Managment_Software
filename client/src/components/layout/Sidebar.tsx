import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { cn } from '../../lib/utils';
import { 
  LayoutDashboard, 
  Building2, 
  Key, 
  Users,
  Settings,
  PieChart,
  CreditCard,
  ClipboardList,
  Stethoscope,
  Pill,
  ShoppingCart,
  AlertTriangle,
  LineChart,
  Calendar
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuthStore();
  const role = user?.role;

  const links = React.useMemo(() => {
    switch (role) {
      case 'SUPER_ADMIN':
        return [
          { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard' },
          { to: '/super-admin/hospitals', icon: Building2, label: 'Hospitals & Tenants' },
          { to: '/super-admin/licenses', icon: Key, label: 'License Management' },
          { to: '/super-admin/plans', icon: CreditCard, label: 'Subscription Plans' },
          { to: '/super-admin/financials', icon: LineChart, label: 'Financials & Revenue' },
          { to: '/super-admin/settings', icon: Settings, label: 'Platform Settings' },
        ];
      case 'HOSPITAL_ADMIN':
        return [
          { to: '/hospital-admin', icon: LayoutDashboard, label: 'Dashboard' },
          { to: '/hospital-admin/staff', icon: Users, label: 'Staff Directory' },
          { to: '/hospital-admin/departments', icon: Settings, label: 'Department Config' },
          { to: '/hospital-admin/appointments', icon: Calendar, label: 'Appointments' },
          { to: '/hospital-admin/analytics', icon: PieChart, label: 'Analytics' },
          { to: '/hospital-admin/billing', icon: CreditCard, label: 'Billing/Plan' },
        ];
      case 'RECEPTIONIST':
        return [
          { to: '/receptionist', icon: ClipboardList, label: "Today's Live Queue" },
          { to: '/receptionist/appointments', icon: Calendar, label: 'Appointments' },
          { to: '/receptionist/patients', icon: Users, label: 'Patient Master List' },
          { to: '/receptionist/invoices', icon: CreditCard, label: 'OPD Billing & Receipts' },
        ];
      case 'DOCTOR':
        return [
          { to: '/doctor', icon: LayoutDashboard, label: "Today's Queue" },
          { to: '/doctor/search', icon: Users, label: 'Patient Search' },
          { to: '/doctor/profile', icon: Stethoscope, label: 'My Profile' },
        ];
      case 'PHARMACY':
        return [
          { to: '/pharmacy', icon: ShoppingCart, label: 'POS (Point of Sale) / Dispense' },
          { to: '/pharmacy/inventory', icon: Pill, label: 'Inventory Master' },
          { to: '/pharmacy/alerts', icon: AlertTriangle, label: 'Expiry & Low Stock Alerts' },
          { to: '/pharmacy/orders', icon: ClipboardList, label: 'Bills & Returns' },
        ];
      default:
        return [];
    }
  }, [role]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden animate-fade-in" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-64 bg-gradient-to-b from-teal-50/80 via-white to-blue-50/50 text-slate-700 border-r border-teal-100/60 shadow-[4px_0_24px_rgba(13,148,136,0.02)] backdrop-blur-md transition-transform duration-300 ease-in-out md:translate-x-0 md:static flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center px-6 bg-white border-b border-teal-50 text-slate-800 font-extrabold tracking-tight">
          <span className="bg-gradient-to-br from-teal-400 to-cyan-500 text-white h-9 w-9 rounded-2xl flex items-center justify-center font-extrabold text-base shadow-[0_0_15px_rgba(20,184,166,0.3)] animate-heartbeat mr-3">✚</span>
          <span className="bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-transparent text-lg font-black tracking-tight text-glow-teal">MediSaaS</span>
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
        </div>
      </aside>
    </>
  );
}
