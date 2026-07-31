import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Button } from '../../components/ui/Button';
import { Mail, Lock, LogIn, Sparkles, Eye, EyeOff, UserCheck, ShieldAlert, Timer } from 'lucide-react';
import { RecoverCredentialsModal } from '../../components/auth/RecoverCredentialsModal';


export function Login() {
  const [selectedRole, setSelectedRole] = useState('SUPER_ADMIN');
  const [email, setEmail] = useState('admin@hospital.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);

  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('medisaas_lockout_until');
    if (saved) {
      const time = parseInt(saved, 10);
      if (Date.now() < time) return time;
      localStorage.removeItem('medisaas_lockout_until');
    }
    return null;
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  // Countdown timer effect for 5-minute security lockout
  useEffect(() => {
    if (!lockoutUntil) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        setLockoutUntil(null);
        setError('');
        localStorage.removeItem('medisaas_lockout_until');
        localStorage.removeItem('medisaas_failed_attempts');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    fetch('/api/auth/maintenance-status')
      .then(res => res.json())
      .then(data => {
        if (data && data.maintenanceMode) {
          setIsMaintenanceActive(true);
        }
      })
      .catch(err => console.error('Failed to query maintenance status', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (remainingSeconds > 0) {
      return;
    }

    if (!selectedRole) {
      setError('Please select an account role before signing in.');
      return;
    }

    setLoading(true);
    
    const result = await login(email, password, accessCode, selectedRole);
    setLoading(false);
    
    if (result.success) {
      localStorage.removeItem('medisaas_lockout_until');
      localStorage.removeItem('medisaas_failed_attempts');
      // Fetch user role from the updated store to route correctly
      const user = useAuthStore.getState().user;
      const role = user?.role;
      if (role === 'SUPER_ADMIN') navigate('/super-admin');
      else if (role === 'HOSPITAL_ADMIN') navigate('/hospital-admin');
      else if (role === 'RECEPTIONIST') navigate('/receptionist');
      else if (role === 'DOCTOR') navigate('/doctor');
      else if (role === 'PHARMACY') navigate('/pharmacy');
    } else {
      setError(result.error || 'Invalid credentials.');
      if (result.lockoutUntil) {
        setLockoutUntil(result.lockoutUntil);
        localStorage.setItem('medisaas_lockout_until', result.lockoutUntil.toString());
      }
    }
  };



  const { settings } = useSuperAdminStore();
  const platformTitle = settings?.platformName || 'Smart Hospital Management Software';

  return (
    <div className="min-h-screen bg-gradient-to-tr from-teal-50/50 via-white to-cyan-50/40 text-slate-600 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans medical-grid">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-teal-300/40 rounded-full blur-[120px] opacity-20 pointer-events-none animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-cyan-300/40 rounded-full blur-[120px] opacity-20 pointer-events-none animate-float-slow" style={{ animationDelay: '2s' }}></div>

      {/* Sweeping ECG heartwave background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] flex items-center justify-center">
        <svg className="w-full h-48 text-teal-600" viewBox="0 0 1000 100" preserveAspectRatio="none">
          <path 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            d="M0,50 L250,50 L260,35 L270,65 L280,50 L350,50 L365,15 L380,85 L395,50 L470,50 L480,35 L490,65 L500,50 L650,50 L665,20 L680,80 L695,50 L770,50 L780,35 L790,65 L800,50 L1000,50" 
          />
        </svg>
      </div>

      <div className="w-full max-w-md z-10 animate-fade-in-up">
        {/* Logo and Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-gradient-to-br from-teal-400 to-cyan-500 text-white text-3xl font-extrabold mb-4 shadow-[0_4px_20px_rgba(20,184,166,0.35)] animate-heartbeat">
            ✚
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 border border-teal-100/80 rounded-full mb-2.5 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            <span className="text-[10px] text-teal-700 font-extrabold uppercase tracking-widest">Gateway Access</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-tight text-center bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-transparent px-2">
            {platformTitle}
          </h1>
          <p className="text-slate-400 mt-2 text-xs font-semibold uppercase tracking-wider">
            Enter credentials below to access the gateway node
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-3xl shadow-[0_12px_40px_-12px_rgba(13,148,136,0.08)] border border-teal-100/50 p-8 md:p-10 relative overflow-hidden">
          {/* Floating stethoscope background vector inside card */}
          <div className="absolute -right-8 -top-8 w-24 h-24 text-teal-500/10 pointer-events-none animate-float-slow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19H3v-6h6v6zm12 0h-6v-6h6v6zM9 9H3V3h6v6zm12 0h-6V3h6v6z" />
            </svg>
          </div>

          {isMaintenanceActive && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200/80 text-amber-800 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 shadow-sm">
              <span className="text-amber-500 font-bold shrink-0">⚠️</span>
              <span className="font-extrabold uppercase tracking-wide">System Maintenance Active: Super Admin Login Only</span>
            </div>
          )}

          {/* 5-Minute Security Lockout Alert Banner */}
          {remainingSeconds > 0 && (
            <div className="mb-5 p-4 bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-2xl text-xs leading-relaxed shadow-md animate-fade-in">
              <div className="flex items-center justify-between font-extrabold mb-1.5">
                <span className="flex items-center gap-1.5 text-rose-700 uppercase tracking-wider text-[11px]">
                  <ShieldAlert size={16} className="text-rose-600 shrink-0" /> Security Lockout Active
                </span>
                <span className="bg-rose-600 text-white font-mono px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                  <Timer size={12} className="animate-spin" /> {formatTimer(remainingSeconds)}
                </span>
              </div>
              <p className="font-semibold text-rose-700">
                Maximum <strong>3 failed login attempts</strong> reached. For your system security, please wait <strong>5 minutes</strong> before trying again to ensure accurate data entry.
              </p>
            </div>
          )}

          {error && remainingSeconds === 0 && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 shadow-sm animate-pulse">
              <span className="text-rose-500 font-bold text-base shrink-0 leading-none">⚠️</span>
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Account Role Dropdown */}
            <div className="space-y-1.5 group">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-teal-600 transition-colors">
                Select System Role <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 transition-colors group-focus-within:text-teal-500">
                  <UserCheck size={16} />
                </div>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  disabled={remainingSeconds > 0 || loading}
                  required
                  className="block w-full pl-11 pr-8 py-2.5 rounded-xl text-sm bg-slate-50/50 border border-teal-100/60 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">-- Choose Login Role --</option>
                  <option value="SUPER_ADMIN">Super Operator / Platform Admin</option>
                  <option value="HOSPITAL_ADMIN">Hospital Administrator</option>
                  <option value="RECEPTIONIST">Front Desk / Receptionist</option>
                  <option value="DOCTOR">Doctor / Medical Practitioner</option>
                  <option value="PHARMACY">Pharmacist / Pharmacy Manager</option>
                </select>
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5 group">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-teal-600 transition-colors">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 transition-colors group-focus-within:text-teal-500">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  placeholder="e.g. receptionist@smarthospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={remainingSeconds > 0 || loading}
                  required
                  className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50/50 border border-teal-100/60 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 group">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-teal-600 transition-colors">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 transition-colors group-focus-within:text-teal-500">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={remainingSeconds > 0 || loading}
                  required
                  className="block w-full pl-11 pr-11 py-2.5 rounded-xl text-sm bg-slate-50/50 border border-teal-100/60 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={remainingSeconds > 0 || loading}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none active:scale-95 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Hospital Access Code Input */}
            <div className="space-y-1.5 group">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-teal-600 transition-colors">Hospital Access Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-teal-600 font-bold transition-colors group-focus-within:text-teal-500">
                  🔑
                </div>
                <input
                  type="text"
                  placeholder="e.g. HMS-2026-001-R4#1%P (First login only)"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  disabled={remainingSeconds > 0 || loading}
                  className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50/50 border border-teal-100/60 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 uppercase font-mono tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-[9px] text-slate-400 font-medium leading-normal pt-0.5">
                Required for first-time hospital terminal activation. Leave blank for subsequent logins.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs pt-1.5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  disabled={remainingSeconds > 0 || loading}
                  className="rounded-md bg-slate-50 border-slate-200 text-teal-600 focus:ring-teal-500/20 focus:ring-offset-white" 
                  defaultChecked
                />
                <span className="text-slate-400 font-semibold group-hover:text-slate-600 transition-colors">Remember session</span>
              </label>
              <button 
                type="button"
                onClick={() => setIsRecoverModalOpen(true)}
                className="font-bold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Recover Credentials
              </button>
            </div>

            <Button 
              type="submit" 
              disabled={remainingSeconds > 0 || loading}
              className="w-full h-12 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-500/15 disabled:opacity-50 disabled:pointer-events-none hover:-translate-y-[1.5px] hover:scale-[1.01] active:translate-y-0 active:scale-[0.99] text-glow-teal animate-shimmer"
            >
              {remainingSeconds > 0 
                ? `System Lockout Active (${formatTimer(remainingSeconds)})` 
                : loading ? 'Verifying Gateway Node...' : 'Sign In to System'
              } <LogIn size={16} />
            </Button>
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 text-center text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-3 px-1 font-semibold">
          <span className="px-3 py-1 bg-teal-50/90 border border-teal-200/80 text-teal-800 text-[11px] font-black rounded-full shadow-sm shadow-teal-500/10 flex items-center gap-1.5">
            <span className="text-amber-500 font-extrabold">©</span> Copyright @twinsCloud • Smart Hospital Management Software v1.0.0
          </span>
          <button 
            type="button"
            onClick={() => navigate('/activate')} 
            className="text-teal-600 hover:text-teal-700 font-bold transition-colors flex items-center gap-1 active:scale-95"
          >
            Activate Node <Sparkles size={12} className="text-teal-500 animate-pulse" />
          </button>
        </div>
      </div>

      {/* Recover Credentials Modal */}
      <RecoverCredentialsModal
        isOpen={isRecoverModalOpen}
        onClose={() => setIsRecoverModalOpen(false)}
        onSuccess={(recoveredEmail: string, newPass: string) => {
          setEmail(recoveredEmail);
          setPassword(newPass);
        }}
      />
    </div>
  );
}
