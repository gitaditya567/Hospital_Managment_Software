import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { Mail, Lock, LogIn, Sparkles, Eye, EyeOff } from 'lucide-react';


export function Login() {
  const [email, setEmail] = useState('admin@hospital.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

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
    setLoading(true);
    
    const result = await login(email, password, accessCode);
    setLoading(false);
    
    if (result.success) {
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
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-tr from-teal-50/50 via-white to-cyan-50/40 text-slate-600 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans medical-grid">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-teal-300/40 rounded-full blur-[120px] opacity-20 pointer-events-none animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-cyan-300/40 rounded-full blur-[120px] opacity-20 pointer-events-none animate-float-slow" style={{ animationDelay: '2s' }}></div>

      {/* Sweeping ECG heartwave background */}
      <div className="absolute inset-x-0 bottom-0 h-48 w-full pointer-events-none opacity-40">
        <svg className="w-full h-full text-teal-600/10" preserveAspectRatio="none" viewBox="0 0 1000 100">
          <path 
            className="animate-ecg stroke-teal-500/30" 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1000" 
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
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-teal-800 to-cyan-950 bg-clip-text text-transparent flex justify-center items-center gap-2.5 text-glow-teal">
            MediSaaS <span className="text-[10px] bg-teal-50 border border-teal-100 text-teal-600 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-widest font-extrabold shadow-sm">Gateway</span>
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

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 shadow-sm">
              <span className="text-rose-500 font-bold shrink-0">⚠️</span>
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-1.5 group">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-teal-600 transition-colors">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 transition-colors group-focus-within:text-teal-500">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  placeholder="e.g. receptionist@medisaas.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50/50 border border-teal-100/60 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200"
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
                  required
                  className="block w-full pl-11 pr-11 py-2.5 rounded-xl text-sm bg-slate-50/50 border border-teal-100/60 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none active:scale-95"
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
                  placeholder="e.g. HOSP-2026-R4T1-OP90 (First login only)"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50/50 border border-teal-100/60 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 uppercase font-mono tracking-wider"
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
                  className="rounded-md bg-slate-50 border-slate-200 text-teal-600 focus:ring-teal-500/20 focus:ring-offset-white" 
                  defaultChecked
                />
                <span className="text-slate-400 font-semibold group-hover:text-slate-600 transition-colors">Remember session</span>
              </label>
              <a href="#" className="font-bold text-teal-600 hover:text-teal-700 transition-colors">
                Recover Credentials
              </a>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-500/15 disabled:opacity-50 disabled:pointer-events-none hover:-translate-y-[1.5px] hover:scale-[1.01] active:translate-y-0 active:scale-[0.99] text-glow-teal animate-shimmer"
            >
              {loading ? 'Verifying Gateway Node...' : 'Sign In to System'} <LogIn size={16} />
            </Button>
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 text-center text-xs text-slate-400 flex justify-between items-center px-3 font-semibold">
          <span>MediSaaS Platform Gateway v1.0.0</span>
          <button 
            type="button"
            onClick={() => navigate('/activate')} 
            className="text-teal-600 hover:text-teal-700 font-bold transition-colors flex items-center gap-1 active:scale-95"
          >
            Activate Node <Sparkles size={12} className="text-teal-500 animate-pulse" />
          </button>
        </div>
      </div>
    </div>
  );
}

