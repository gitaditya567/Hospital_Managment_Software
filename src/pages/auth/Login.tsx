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
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-blue-50/20 to-indigo-50/30 text-slate-600 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-blue-400/80 rounded-full blur-[120px] opacity-10 pointer-events-none animate-float"></div>
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-indigo-400/80 rounded-full blur-[120px] opacity-10 pointer-events-none animate-float" style={{ animationDelay: '1.5s' }}></div>

      <div className="w-full max-w-md z-10 animate-fade-in-up">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-15 w-15 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-extrabold mb-3.5 shadow-lg shadow-blue-500/20 animate-float">
            ✚
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-slate-800 to-slate-950 bg-clip-text text-transparent flex justify-center items-center gap-2.5">
            MediSaaS <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-600 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-widest font-extrabold shadow-sm">Gateway</span>
          </h1>
          <p className="text-slate-400 mt-2 text-xs font-semibold uppercase tracking-wider">
            Enter credentials below to access the gateway node
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-100/90 rounded-3xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.05)] p-8 md:p-10">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 shadow-sm">
              <span className="text-rose-500 font-bold shrink-0">⚠️</span>
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-1.5 group">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 transition-colors group-focus-within:text-blue-500">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  placeholder="e.g. receptionist@medisaas.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-100 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 group">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 transition-colors group-focus-within:text-blue-500">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full pl-11 pr-11 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-100 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Hospital Access Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold transition-colors group-focus-within:text-blue-500">
                  🔑
                </div>
                <input
                  type="text"
                  placeholder="e.g. HOSP-2026-R4T1-OP90 (First login only)"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-100 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 uppercase font-mono tracking-wider"
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
                  className="rounded-md bg-slate-50 border-slate-200 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-white" 
                  defaultChecked
                />
                <span className="text-slate-400 font-semibold group-hover:text-slate-600 transition-colors">Remember session</span>
              </label>
              <a href="#" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">
                Recover Credentials
              </a>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/15 disabled:opacity-50 disabled:pointer-events-none hover:-translate-y-[1.5px] hover:scale-[1.01] active:translate-y-0 active:scale-[0.99]"
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
            className="text-blue-600 hover:text-blue-700 font-bold transition-colors flex items-center gap-1 active:scale-95"
          >
            Activate Node <Sparkles size={12} className="text-blue-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

