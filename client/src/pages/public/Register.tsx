import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, User, Mail, Lock, Phone, MapPin, KeyRound, ArrowRight, ArrowLeft, CheckCircle2,
  Eye, EyeOff, Copy, Check, Gift, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { PasswordStrengthMeter } from '../../components/ui/PasswordStrengthMeter';

interface PublicPlan {
  id: string;
  name: string;
  price: number;
  maxDoctors: number;
  maxReceptionists: number;
  maxPharmacists: number;
  durationMonths: number;
}

interface RegistrationResult {
  hospitalName: string;
  accessCode: string;
  planName: string;
  email: string;
  isTrial: boolean;
  expiryDate: string;
}

const inputClass = 'block w-full pl-10 pr-3.5 h-11 rounded-xl text-sm bg-white border border-[#D8D8D8] text-[#060606] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] transition-all font-medium';

function Field({ label, icon: Icon, children, hint }: { label: string; icon: any; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="relative block">
        <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        {children}
      </span>
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore(state => state.setSession);
  const { settings, loadPublicConfig } = useSuperAdminStore();

  const allowTrial = settings?.allowSelfSignup !== false;
  const trialDays = settings?.trialDays || 14;

  const [mode, setMode] = useState<'trial' | 'license'>(params.get('mode') === 'license' ? 'license' : 'trial');
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [planId, setPlanId] = useState(params.get('plan') || '');
  const [licenseCode, setLicenseCode] = useState('');

  const [hospitalName, setHospitalName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = 'Register your hospital';
    loadPublicConfig();
    fetch('/api/public/plans')
      .then(res => (res.ok ? res.json() : []))
      .then((data: PublicPlan[]) => {
        const list = Array.isArray(data) ? data : [];
        setPlans(list);
        setPlanId(current => (current && list.some(p => p.id === current) ? current : list[0]?.id || ''));
      })
      .catch(() => setPlans([]));
  }, [loadPublicConfig]);

  useEffect(() => {
    if (!allowTrial) setMode('license');
  }, [allowTrial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) return setError('Password must be at least 8 characters long.');
    if (password !== confirmPassword) return setError('Password and confirm password do not match.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Please enter a valid 10-digit mobile number.');
    if (mode === 'license' && !licenseCode.trim()) return setError('Please enter the license key shared by our team.');
    if (!agree) return setError('Please accept the terms to continue.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalName: hospitalName.trim(),
          adminName: adminName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          planId: mode === 'trial' ? planId : undefined,
          licenseCode: mode === 'license' ? licenseCode.trim() : undefined
        })
      });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await res.json().catch(() => ({})) : {};
      if (!res.ok) {
        if (!isJson || res.status === 404) {
          setError(`Registration service is unavailable (HTTP ${res.status}). The server may be restarting or outdated — please try again in a minute.`);
        } else {
          setError(data.message || 'Registration failed. Please try again.');
        }
        return;
      }

      setSession(data.token, data.user, data.subscription);
      setResult({
        hospitalName: data.hospital.hospitalName,
        accessCode: data.hospital.accessCode,
        planName: data.hospital.planName,
        email: data.user.email,
        isTrial: !!data.subscription?.isTrial,
        expiryDate: data.subscription?.expiryDate || ''
      });
      window.scrollTo({ top: 0 });
    } catch {
      setError('Unable to reach the server. Please check your internet connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const selectedPlan = plans.find(p => p.id === planId);

  return (
    <div className="min-h-screen bg-[#EBF3FE] font-sans text-[#060606] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#3683F8_1px,transparent_1px)] [background-size:26px_26px] opacity-[0.1] pointer-events-none" />

      <header className="relative max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#3683F8] text-white flex items-center justify-center font-black text-lg">✚</div>
          <span className="font-extrabold text-sm sm:text-base hidden sm:inline">Smart Hospital Management</span>
        </Link>
        <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#3683F8]">
          Already registered? <span className="text-[#3683F8]">Sign in</span>
        </Link>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-16 pt-4">
        {result ? (
          <div className="max-w-xl mx-auto bg-white rounded-3xl border border-[#D8D8D8] shadow-2xl p-6 sm:p-10 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-5">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">Welcome aboard!</h1>
            <p className="text-slate-600 mt-2">
              <strong>{result.hospitalName}</strong> is ready on the <strong>{result.planName}</strong>
              {result.isTrial ? ' free trial' : ''}{result.expiryDate ? `, valid until ${result.expiryDate}` : ''}.
            </p>

            <div className="mt-7 text-left rounded-2xl bg-slate-50 border border-[#D8D8D8] divide-y divide-[#D8D8D8]">
              <div className="p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Admin login</div>
                <div className="font-bold mt-0.5 break-all">{result.email}</div>
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hospital access code</div>
                  <div className="font-mono font-bold mt-0.5 break-all">{result.accessCode}</div>
                </div>
                <button type="button" onClick={copyCode} className="h-9 px-3 rounded-lg border border-[#D8D8D8] text-xs font-bold inline-flex items-center gap-1.5 hover:border-[#3683F8] shrink-0">
                  {copied ? <><Check size={14} className="text-emerald-500" /> Copied</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 text-left">
              Keep this code safe — it is needed to recover passwords. We have also e-mailed it to you.
            </p>

            <div className="mt-6 text-left space-y-2.5">
              <div className="text-sm font-extrabold">Next steps</div>
              {['Add your doctors, receptionists and pharmacists in Staff Management', 'Set OPD, emergency and bed fees under OPD & Clinical Fees', 'Upload your hospital logo in Hospital Profile'].map((step, i) => (
                <div key={step} className="flex gap-3 text-sm text-slate-700">
                  <span className="h-6 w-6 rounded-full bg-[#EBF3FE] text-[#3683F8] text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                  {step}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate('/hospital-admin')}
              className="mt-8 w-full h-12 rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white font-extrabold inline-flex items-center justify-center gap-2 shadow-md shadow-[#3683F8]/25"
            >
              Go to my dashboard <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Left info panel */}
            <aside className="lg:col-span-4 rounded-3xl bg-gradient-to-br from-[#060606] via-[#101928] to-[#0A1424] text-white p-7 lg:sticky lg:top-6">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#3683F8]">Hospital registration</span>
              <h1 className="text-2xl font-black text-white mt-2 leading-snug">Set up your hospital in under 5 minutes</h1>
              <ul className="mt-6 space-y-3.5">
                {[
                  { icon: Gift, text: allowTrial ? `${trialDays}-day free trial, no card required` : 'Activate instantly with your license key' },
                  { icon: ShieldCheck, text: 'Private, isolated data for your hospital' },
                  { icon: Building2, text: 'Reception, doctor, pharmacy & billing modules' },
                  { icon: KeyRound, text: 'Upgrade any time with a license key' }
                ].map(item => (
                  <li key={item.text} className="flex gap-3 text-sm text-slate-300">
                    <item.icon size={18} className="text-[#3683F8] shrink-0 mt-0.5" /> {item.text}
                  </li>
                ))}
              </ul>
              {mode === 'trial' && selectedPlan && (
                <div className="mt-7 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Selected plan</div>
                  <div className="font-extrabold text-white mt-1">{selectedPlan.name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Free for {trialDays} days, then ₹{selectedPlan.price.toLocaleString('en-IN')} / {selectedPlan.durationMonths === 12 ? 'year' : `${selectedPlan.durationMonths} months`}
                  </div>
                </div>
              )}
              <Link to="/" className="mt-7 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white">
                <ArrowLeft size={14} /> Back to home
              </Link>
            </aside>

            {/* Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-8 bg-white rounded-3xl border border-[#D8D8D8] shadow-xl p-6 sm:p-8 space-y-6">
              {allowTrial && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  {[
                    { key: 'trial' as const, label: 'Start free trial', icon: Gift },
                    { key: 'license' as const, label: 'I have a license key', icon: KeyRound }
                  ].map(option => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => { setMode(option.key); setError(''); }}
                      className={`h-11 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-all ${mode === option.key ? 'bg-white text-[#3683F8] shadow' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <option.icon size={16} /> {option.label}
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-semibold flex gap-2.5">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {mode === 'trial' ? (
                plans.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Choose a plan for your trial</span>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {plans.map(plan => (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setPlanId(plan.id)}
                          className={`text-left p-3.5 rounded-2xl border transition-all ${planId === plan.id ? 'border-[#3683F8] bg-[#EBF3FE] ring-2 ring-[#3683F8]/20' : 'border-[#D8D8D8] hover:border-[#3683F8]'}`}
                        >
                          <div className="text-sm font-extrabold">{plan.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">₹{plan.price.toLocaleString('en-IN')} / {plan.durationMonths === 12 ? 'yr' : `${plan.durationMonths} mo`}</div>
                          <div className="text-[11px] text-slate-500 mt-1.5">{plan.maxDoctors === -1 ? 'Unlimited' : plan.maxDoctors} doctors</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <Field label="License key" icon={KeyRound} hint="The HMS-… key shared by our sales team after purchase.">
                  <input value={licenseCode} onChange={e => setLicenseCode(e.target.value)} placeholder="HMS-2026-001-XXXXXX" className={`${inputClass} font-mono uppercase`} autoComplete="off" />
                </Field>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Hospital / clinic name" icon={Building2}>
                    <input required minLength={3} value={hospitalName} onChange={e => setHospitalName(e.target.value)} placeholder="e.g. City Care Multispeciality Hospital" className={inputClass} />
                  </Field>
                </div>
                <Field label="Your full name" icon={User}>
                  <input required value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Dr. Anil Sharma" className={inputClass} autoComplete="name" />
                </Field>
                <Field label="Mobile number" icon={Phone}>
                  <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="98765 43210" className={inputClass} autoComplete="tel" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Work email (your login)" icon={Mail}>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@yourhospital.com" className={inputClass} autoComplete="email" />
                  </Field>
                </div>
                <Field label="Hospital address" icon={MapPin}>
                  <input required minLength={5} value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, area" className={inputClass} autoComplete="street-address" />
                </Field>
                <Field label="City" icon={MapPin}>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Lucknow" className={inputClass} autoComplete="address-level2" />
                </Field>
                <div className="space-y-1">
                  <Field label="Password" icon={Lock}>
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className={`${inputClass} pr-10`}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </Field>
                  {password && <PasswordStrengthMeter password={password} onPasswordChange={setPassword} />}
                </div>
                <Field label="Confirm password" icon={Lock}>
                  <input required type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" className={inputClass} autoComplete="new-password" />
                </Field>
              </div>

              <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 rounded border-[#D8D8D8] text-[#3683F8] focus:ring-[#3683F8]/20" />
                <span>I confirm I am authorised to register this hospital and agree to keep patient data confidential.</span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-[#3683F8] hover:bg-blue-600 disabled:opacity-60 text-white font-extrabold inline-flex items-center justify-center gap-2 shadow-md shadow-[#3683F8]/25 transition-colors"
              >
                {submitting ? 'Creating your hospital…' : mode === 'trial' ? `Start ${trialDays}-day free trial` : 'Activate my hospital'}
                {!submitting && <ArrowRight size={18} />}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
