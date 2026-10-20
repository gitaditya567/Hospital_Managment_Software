import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Button } from '../../components/ui/Button';
import { 
  Mail, 
  Lock, 
  LogIn, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Timer,
  ShieldCheck,
  Building2,
  UserCheck,
  Stethoscope,
  Pill,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  Activity,
  User
} from 'lucide-react';
import { RecoverCredentialsModal } from '../../components/auth/RecoverCredentialsModal';

export function Login() {
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('session') === 'expired';
  const [selectedRole, setSelectedRole] = useState('HOSPITAL_ADMIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Common hospital email domains for auto-suggest
  const EMAIL_DOMAINS = ['hospital.com', 'citycare.com', 'clinic.com', 'healthcare.com', 'medcare.in'];

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

  const handleRoleSelect = (roleKey: string) => {
    setSelectedRole(roleKey);
    setError('');
  };

  // Whether the current input looks like an email or a plain username
  const isEmailFormat = email.includes('@');

  // Suggestions: only show when typing without @
  const suggestions = !isEmailFormat && email.trim().length > 0
    ? EMAIL_DOMAINS.map(domain => `${email.trim()}@${domain}`)
    : [];

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

    if (!email.trim()) {
      setError('Please enter your email address or username.');
      return;
    }

    setLoading(true);
    
    const result = await login(email.trim(), password, accessCode, selectedRole);
    setLoading(false);
    
    if (result.success) {
      localStorage.removeItem('medisaas_lockout_until');
      localStorage.removeItem('medisaas_failed_attempts');
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

  const { settings, loadPublicConfig } = useSuperAdminStore();

  useEffect(() => {
    document.title = 'Sign in';
    loadPublicConfig();
  }, [loadPublicConfig]);
  const platformTitle = settings?.platformName || 'Smart Hospital Management Software';

  const roleOptions = [
    { key: 'SUPER_ADMIN', label: 'Super Operator', email: 'admin@hospital.com', icon: ShieldCheck },
    { key: 'HOSPITAL_ADMIN', label: 'Hospital Admin', email: 'admin@citycare.com', icon: Building2 },
    { key: 'RECEPTIONIST', label: 'Front Desk', email: 'receptionist@citycare.com', icon: UserCheck },
    { key: 'DOCTOR', label: 'Doctor Node', email: 'doctor@citycare.com', icon: Stethoscope },
    { key: 'PHARMACY', label: 'Pharmacist', email: 'pharmacy@citycare.com', icon: Pill },
  ];

  return (
    <div className="min-h-screen bg-[#EBF3FE] text-[#060606] flex items-center justify-center p-4 lg:p-8 font-sans medical-grid relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#3683F8]/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#3683F8]/15 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Main Container Dual-Pane Layout */}
      <div className="w-full max-w-6xl bg-white/90 backdrop-blur-xl border border-[#D8D8D8] rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] z-10 animate-fade-in-up">
        
        {/* Left Column: Enterprise SaaS Showcase Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#060606] via-[#101928] to-[#0A1424] text-white p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle grid pattern overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#3683F8_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none"></div>

          <div className="relative z-10 space-y-6">
            {/* Header Brand */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-[#3683F8] text-white flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(54,131,248,0.5)]">
                ✚
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Multi-Tenant SaaS</span>
                <span className="text-base font-extrabold tracking-tight text-white">{platformTitle}</span>
              </div>
            </div>

            {/* Platform Feature Cards */}
            <div className="pt-6 space-y-4">
              <h2 className="text-xl lg:text-2xl font-black text-white leading-snug">
                Next-Gen Medical Telemetry & Clinical Governance
              </h2>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Empowering multi-hospital operations with instant OPD registration, real-time e-prescriptions, automated pharmacy billing, and central admin licensing.
              </p>
            </div>

            {/* Live Telemetry Highlights */}
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md flex items-center gap-3.5">
                <div className="p-2.5 bg-[#3683F8]/20 text-[#3683F8] rounded-xl shrink-0">
                  <Activity size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    Real-Time OPD Queueing <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">Instant check-in & token dispatch</div>
                </div>
              </div>

              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md flex items-center gap-3.5">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Automated Pharmacy Billing</div>
                  <div className="text-[11px] text-slate-400 font-medium">Batched stock deduction & invoice printing</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Metrics */}
          <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck size={14} /> 256-Bit Encrypted Node
            </span>
            <span className="text-white bg-[#3683F8]/30 border border-[#3683F8]/50 px-2.5 py-1 rounded-full">
              v1.0.0 Enterprise
            </span>
          </div>
        </div>

        {/* Right Column: Authentication Form Gateway */}
        <div className="lg:col-span-7 p-8 lg:p-12 bg-white flex flex-col justify-between">
          <div>
            {/* Top Gateway Title */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#3683F8] bg-[#EBF3FE] px-3 py-1 rounded-full border border-blue-200">
                  System Authentication
                </span>
                <h2 className="text-2xl font-black text-[#060606] tracking-tight mt-2">
                  Sign In to Terminal Node
                </h2>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-[#3683F8] bg-[#EBF3FE] px-3 py-1.5 rounded-xl border border-blue-200">
                <ShieldCheck size={14} /> Secure Session
              </div>
            </div>

            {/* Quick Demo Role Selector Chips */}
            <div className="mb-6 space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Select your account role
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {roleOptions.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === role.key;
                  return (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() => handleRoleSelect(role.key)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all border text-left ${
                        isSelected
                          ? 'bg-[#3683F8] text-white border-[#3683F8] shadow-md shadow-[#3683F8]/20 scale-[1.02]'
                          : 'bg-[#EBF3FE]/40 text-slate-700 border-[#D8D8D8] hover:border-[#3683F8] hover:bg-[#EBF3FE]'
                      }`}
                    >
                      <Icon size={16} className={isSelected ? 'text-white' : 'text-[#3683F8]'} />
                      <span className="truncate">{role.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lockout & Error Alerts */}
            {sessionExpired && !error && (
              <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold">
                Your session has ended. Please sign in again to continue.
              </div>
            )}
            {isMaintenanceActive && (
              <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 shadow-xs">
                <span className="text-amber-500 font-bold shrink-0">⚠️</span>
                <span className="font-extrabold uppercase tracking-wide">System Maintenance Mode: Platform Administrator Access Only</span>
              </div>
            )}

            {remainingSeconds > 0 && (
              <div className="mb-5 p-4 bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-2xl text-xs leading-relaxed shadow-md">
                <div className="flex items-center justify-between font-extrabold mb-1.5">
                  <span className="flex items-center gap-1.5 text-rose-700 uppercase tracking-wider text-[11px]">
                    <ShieldAlert size={16} className="text-rose-600 shrink-0" /> Security Lockout Active
                  </span>
                  <span className="bg-rose-600 text-white font-mono px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                    <Timer size={12} className="animate-spin" /> {formatTimer(remainingSeconds)}
                  </span>
                </div>
                <p className="font-semibold text-rose-800">
                  Maximum <strong>3 failed login attempts</strong> reached. Please wait <strong>5 minutes</strong> before re-attempting authentication.
                </p>
              </div>
            )}

            {error && remainingSeconds === 0 && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 shadow-xs animate-pulse">
                <span className="text-rose-500 font-bold text-base shrink-0 leading-none">⚠️</span>
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Address / Username */}
              <div className="space-y-1 group">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 group-focus-within:text-[#3683F8] transition-colors">
                  Email Address / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#3683F8] transition-colors">
                    {isEmailFormat ? <Mail size={16} /> : <User size={16} />}
                  </div>
                  <input
                    type="text"
                    placeholder="you@yourhospital.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setShowSuggestions(!e.target.value.includes('@') && e.target.value.trim().length > 0);
                    }}
                    onFocus={() => {
                      if (!email.includes('@') && email.trim().length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    disabled={remainingSeconds > 0 || loading}
                    required
                    autoComplete="username"
                    className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-white border border-[#D8D8D8] text-[#060606] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] transition-all duration-200 font-medium"
                  />

                  {/* Auto-suggest Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#3683F8]/30 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-1.5 bg-[#EBF3FE]/60 border-b border-[#D8D8D8]">
                        <span className="text-[10px] font-bold text-[#3683F8] uppercase tracking-wider">@ सुझाव — एक चुनें:</span>
                      </div>
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onMouseDown={() => {
                            setEmail(suggestion);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#EBF3FE] hover:text-[#3683F8] transition-colors flex items-center gap-2 group/item"
                        >
                          <Mail size={12} className="text-slate-400 group-hover/item:text-[#3683F8] shrink-0" />
                          <span className="font-mono">
                            <span className="text-slate-400">{email.trim()}</span>
                            <span className="text-[#3683F8] font-bold">@{suggestion.split('@')[1]}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] pl-1">
                  {isEmailFormat
                    ? <span className="text-emerald-600 font-semibold">✉ Email format detected — ready to sign in</span>
                    : email.trim()
                      ? <span className="text-amber-600 font-semibold">👤 Username detected — select a @ suggestion above or type full email</span>
                      : <span className="text-slate-400">Enter your email address or plain username (e.g. admindemo)</span>}
                </p>
              </div>

              {/* Password */}
              <div className="space-y-1 group">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 group-focus-within:text-[#3683F8] transition-colors">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#3683F8] transition-colors">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={remainingSeconds > 0 || loading}
                    required
                    className="block w-full pl-11 pr-11 py-2.5 rounded-xl text-sm bg-white border border-[#D8D8D8] text-[#060606] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] transition-all duration-200 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={remainingSeconds > 0 || loading}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Hospital Access Code */}
              <div className="space-y-1 group">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 group-focus-within:text-[#3683F8] transition-colors">
                  Hospital License Access Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#3683F8]">
                    <KeyRound size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Only needed for your first sign-in (optional)"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    disabled={remainingSeconds > 0 || loading}
                    className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-white border border-[#D8D8D8] text-[#060606] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] transition-all duration-200 font-mono text-xs uppercase"
                  />
                </div>
              </div>

              {/* Actions & Credentials Recovery */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    disabled={remainingSeconds > 0 || loading}
                    className="rounded bg-white border-[#D8D8D8] text-[#3683F8] focus:ring-[#3683F8]/20" 
                    defaultChecked
                  />
                  <span className="text-slate-600 font-semibold">Keep me signed in</span>
                </label>
                <button 
                  type="button"
                  onClick={() => setIsRecoverModalOpen(true)}
                  className="font-bold text-[#3683F8] hover:text-blue-700 transition-colors"
                >
                  Recover Passwords
                </button>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={remainingSeconds > 0 || loading}
                className="w-full h-12 bg-[#3683F8] hover:bg-blue-600 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-[#3683F8]/20 disabled:opacity-50 hover:-translate-y-[1px] active:translate-y-0"
              >
                {remainingSeconds > 0 
                  ? `System Lockout Active (${formatTimer(remainingSeconds)})` 
                  : loading ? 'Verifying Credentials...' : 'Sign In to Gateway'
                } <LogIn size={18} />
              </Button>
            </form>
          </div>

          {/* Footer Activation Node & Copyright */}
          <div className="pt-6 border-t border-[#D8D8D8] flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <span className="text-slate-500 font-bold text-[11px]">
              © Copyright @twinsCloud • Smart Hospital Management
            </span>
            <div className="flex items-center gap-4">
              <Link to="/" className="text-slate-500 font-bold hover:text-[#3683F8] transition-colors">
                Home
              </Link>
              <Link
                to="/register"
                className="text-[#3683F8] font-black hover:text-blue-700 transition-colors flex items-center gap-1 active:scale-95"
              >
                New hospital? Register free <ArrowRight size={14} />
              </Link>
            </div>
          </div>
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

