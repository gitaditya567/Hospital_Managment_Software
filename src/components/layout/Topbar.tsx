import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, User, LogOut, Search, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useNavigate } from 'react-router-dom';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuthStore();
  const { searchQuery, setSearchQuery, activities, tenants, licenses } = useSuperAdminStore();
  const { hospitalName: fetchedHospitalName, staff } = useHospitalStore();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const doctors = React.useMemo(() => {
    return (staff || []).filter(s => s.role === 'Doctor');
  }, [staff]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const hospitalName = React.useMemo(() => {
    if (isSuperAdmin) {
      return 'Super Admin Control';
    }
    return fetchedHospitalName || 'MediSaaS Portal';
  }, [isSuperAdmin, fetchedHospitalName]);

  // Compute alerts (failed payments, expiring licenses, suspended accounts for Super Admin, or Tenant-specific alerts for Hospital Admin)
  const systemAlerts = React.useMemo(() => {
    const alerts: Array<{ id: string; text: string; time: string; type: 'error' | 'warning' }> = [];
    
    if (user?.role === 'SUPER_ADMIN') {
      // Failed payment alerts
      activities
        .filter(act => act.description.toLowerCase().includes('failed') || act.description.toLowerCase().includes('past due'))
        .forEach(act => {
          alerts.push({
            id: act.id,
            text: act.description,
            time: new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'error'
          });
        });

      // Expiring licenses alerts (expired or near expiry)
      licenses
        .filter(lic => lic.status === 'Expired')
        .forEach(lic => {
          alerts.push({
            id: `lic-exp-${lic.code}`,
            text: `License code ${lic.code} has expired.`,
            time: new Date(lic.createdAt).toLocaleDateString(),
            type: 'warning'
          });
        });

      // Expiring soon tenants
      tenants
        .filter(t => {
          const diffTime = new Date(t.subscriptionExpiryDate).getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays > 0 && diffDays <= 30;
        })
        .forEach(t => {
          alerts.push({
            id: `ten-exp-${t.id}`,
            text: `Hospital "${t.hospitalName}" plan expires soon (${t.subscriptionExpiryDate}).`,
            time: 'Active',
            type: 'warning'
          });
        });
    } else if (user?.role === 'HOSPITAL_ADMIN') {
      // Hospital-specific alerts!
      if (user.hospitalId) {
        const tenant = tenants.find(t => t.id === user.hospitalId);
        if (tenant) {
          const diffTime = new Date(tenant.subscriptionExpiryDate).getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 0) {
            alerts.push({
              id: 'hosp-alert-expired',
              text: `Critical: Your MediSaaS subscription has expired on ${tenant.subscriptionExpiryDate}. Contact Super Admin!`,
              time: 'Just now',
              type: 'error'
            });
          } else if (diffDays <= 30) {
            alerts.push({
              id: 'hosp-alert-expiring',
              text: `Warning: Software access locks in ${diffDays} days (${tenant.subscriptionExpiryDate}). Contact Super Admin.`,
              time: 'Just now',
              type: 'error'
            });
          }
        }
      }
      
      // Stock warning alert
      alerts.push({
        id: 'hosp-alert-stock',
        text: 'Alert: Low pharmacy inventory detected for Paracetamol 650mg (12 boxes left).',
        time: '1 hour ago',
        type: 'warning'
      });

      // Daily checkout warning
      alerts.push({
        id: 'hosp-alert-checkout',
        text: 'Daily Report: Yesterday\'s OPD fee clearance completed successfully.',
        time: '9:00 AM',
        type: 'warning'
      });
    }

    return alerts;
  }, [activities, licenses, tenants, user]);

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 z-30 sticky top-0 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.015)]">
      <div className="flex items-center flex-1 min-w-0 mr-4 gap-3">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 mr-2 text-slate-500 hover:bg-slate-50 rounded-xl shrink-0 transition-colors"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-sm font-extrabold text-slate-800 hidden sm:block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mr-3 shrink-0 max-w-[160px] lg:max-w-[240px] truncate uppercase tracking-wider">
          {hospitalName}
        </h1>

        {(isSuperAdmin || user?.role === 'HOSPITAL_ADMIN' || user?.role === 'RECEPTIONIST') && (
          <div className="relative w-full max-w-[180px] lg:max-w-xs hidden md:block shrink">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder={
                isSuperAdmin 
                  ? "Search by Hospital, License..." 
                  : user?.role === 'RECEPTIONIST'
                  ? "Universal Search: Type phone or name..."
                  : "Search staff, patient or phone..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-slate-100 rounded-xl text-xs bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.005)]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {user?.role === 'RECEPTIONIST' && doctors.length > 0 && (
          <div className="hidden xl:flex items-center space-x-2 border-l border-slate-200 pl-3 text-[10px] font-bold text-slate-600 shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold">OPD Shift:</span>
            {doctors.map(doc => {
              const isActive = doc.status === 'Active';
              return (
                <span 
                  key={doc.id}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${
                    isActive 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                      : 'bg-rose-50 border-rose-100 text-rose-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                  Dr. {doc.name} ({isActive ? 'Active' : doc.status})
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Notifications Popover */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200 active:scale-95 relative"
          >
            <Bell size={18} />
            {systemAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3.5 w-80 bg-white rounded-2xl shadow-[0_12px_36px_-8px_rgba(0,0,0,0.08)] border border-slate-100/90 overflow-hidden animate-in fade-in slide-in-from-top-2 cubic-bezier(0.16, 1, 0.3, 1) duration-300 z-50">
              <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100/60 flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">System Alerts</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-full">
                  {systemAlerts.length} Active
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100/60">
                {systemAlerts.map((alert) => (
                  <div key={alert.id} className="p-3.5 hover:bg-slate-50/50 transition-colors flex gap-3">
                    {alert.type === 'error' ? (
                      <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={16} />
                    ) : (
                      <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed break-words">{alert.text}</p>
                      <p className="text-[9px] text-slate-400 font-bold tracking-wider mt-1">{alert.time}</p>
                    </div>
                  </div>
                ))}
                {systemAlerts.length === 0 && (
                  <div className="py-10 text-center text-slate-400 text-xs font-semibold">
                    No critical SaaS alerts. All systems operational!
                  </div>
                )}
              </div>
              <div className="p-2.5 border-t border-slate-100/60 bg-slate-50/20 text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Auto-monitoring active</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2.5 border-l border-slate-100 pl-3.5">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-700 leading-none">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{user?.role?.replace('_', ' ').toLowerCase()}</p>
          </div>
          <div className="h-9.5 w-9.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center border border-blue-100/50 font-bold text-sm shadow-[0_2px_8px_-2px_rgba(37,99,235,0.05)]">
            {user?.name ? user.name.charAt(0) : <User size={16} />}
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 active:scale-95 ml-1"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
