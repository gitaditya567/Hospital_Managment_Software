import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { Key, Building, User, Mail, Lock, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';

export function Activate() {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  // Setup fields
  const [hospitalName, setHospitalName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [address, setAddress] = useState('');

  const [validatedPlan, setValidatedPlan] = useState<any>(null);
  const [validityMonths, setValidityMonths] = useState(12);

  const navigate = useNavigate();
  const { licenses, plans, onboardHospital } = useSuperAdminStore();
  const { login } = useAuthStore();

  // Find unused license codes for helpful UI helpers
  const unusedTestLicenses = licenses.filter(l => !l.isUsed && l.status === 'Unused');

  const handleValidateCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedCode = code.trim().toUpperCase();
    const license = licenses.find(l => l.code === trimmedCode);

    if (!license) {
      setError('Invalid license code format. Please check the code provided by Super Admin.');
      return;
    }

    if (license.isUsed) {
      setError('This license code has already been activated by another tenant.');
      return;
    }

    if (license.status === 'Expired') {
      setError('This license code has expired. Please request a new one from the Super Admin.');
      return;
    }

    const plan = plans.find(p => p.id === license.planId);
    if (!plan) {
      setError('The subscription plan associated with this license is no longer available.');
      return;
    }

    // Success - transition to step 2
    setValidatedPlan(plan);
    setValidityMonths(license.validityMonths || 12);
    setStep(2);
  };

  const handleCompleteSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!hospitalName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword.trim() || !address.trim()) {
      setError('All fields are required to establish your hospital node.');
      return;
    }

    try {
      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + validityMonths);
      const expiryString = expiryDate.toISOString().split('T')[0];

      // 1. Register tenant in Super Admin store
      onboardHospital({
        hospitalName: hospitalName.trim(),
        adminEmail: adminEmail.trim(),
        address: address.trim(),
        licenseCodeUsed: code.trim().toUpperCase(),
        subscriptionExpiryDate: expiryString,
        planId: validatedPlan.id
      });

      // 2. Fetch the newly created tenant to extract its generated ID
      // Retrieve the most recently added tenant that matches this license
      const allTenants = useSuperAdminStore.getState().tenants;
      const createdTenant = allTenants.find(t => t.licenseCodeUsed === code.trim().toUpperCase());

      if (!createdTenant) {
        setError('Error establishing database tenant record. Please retry.');
        return;
      }

      // 3. Immediately log in the user as HOSPITAL_ADMIN
      login(adminEmail.trim(), adminPassword.trim(), code.trim().toUpperCase());

      // 4. Redirect to the hospital dashboard
      navigate('/hospital-admin');
    } catch (err: any) {
      setError(err?.message || 'Failed to complete registration.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-blue-50/20 to-indigo-50/30 text-slate-600 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/80 rounded-full blur-[120px] opacity-10 pointer-events-none animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-400/80 rounded-full blur-[120px] opacity-10 pointer-events-none animate-float" style={{ animationDelay: '1.5s' }}></div>

      <div className="w-full max-w-lg z-10 animate-fade-in-up">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-15 w-15 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-3xl font-extrabold mb-3.5 shadow-lg shadow-blue-500/20 animate-float">
            ✚
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-slate-800 to-slate-950 bg-clip-text text-transparent">MediSaaS Tenant Activation</h1>
          <p className="text-slate-400 mt-2 text-xs font-semibold uppercase tracking-wider">
            Activate your custom hospital node in real-time
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8 space-x-6">
          <div className="flex items-center">
            <span className={`flex items-center justify-center h-8 w-8 rounded-xl border text-xs font-bold transition-all duration-300 ${
              step >= 1 ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}>
              1
            </span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-2">License</span>
          </div>
          <div className="w-8 h-px bg-slate-200"></div>
          <div className="flex items-center">
            <span className={`flex items-center justify-center h-8 w-8 rounded-xl border text-xs font-bold transition-all duration-300 ${
              step === 2 ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}>
              2
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">Provisioning</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-100/90 rounded-3xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.05)] p-8 md:p-10">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold flex gap-3 items-start animate-in fade-in">
              <AlertTriangle className="shrink-0 text-rose-500 mt-0.5" size={16} />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleValidateCode} className="space-y-6">
              <div className="space-y-2 group">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Enter License Code</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <Key size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. HOSP-2026-R4T1-OP90"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    className="block w-full pl-11 pr-3.5 py-3 rounded-xl text-sm bg-slate-50 border border-slate-100 placeholder-slate-400 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase tracking-wider font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">Verification triggers real-time query inside LicenseCodes registry.</p>
              </div>

              <Button type="submit" className="w-full h-12 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center gap-2 rounded-full transition-all shadow-md shadow-blue-500/15 font-bold hover:-translate-y-[1.5px] hover:scale-[1.01] active:translate-y-0 active:scale-[0.99]">
                Verify License Code <ArrowRight size={16} />
              </Button>

              {/* Helpful Onboarding Hint */}
              <div className="pt-5 border-t border-slate-100/80">
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-500" /> Onboarding Sandbox helper:
                </p>
                <p className="text-[11px] text-slate-400 leading-normal mb-3 font-semibold">
                  You can click one of the generated license keys below to auto-verify instantly:
                </p>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {unusedTestLicenses.map((lic) => {
                    const planName = plans.find(p => p.id === lic.planId)?.name || 'Plan';
                    return (
                      <button
                        key={lic.code}
                        type="button"
                        onClick={() => setCode(lic.code)}
                        className="w-full p-2.5 bg-slate-50 hover:bg-slate-100/70 rounded-full border border-slate-100 flex justify-between items-center text-slate-600 hover:text-slate-900 transition-all duration-200 text-left active:scale-[0.99]"
                      >
                        <span className="font-bold tracking-wider">{lic.code}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100/30 font-sans font-bold shadow-sm">
                          {planName} ({lic.validityMonths}M)
                        </span>
                      </button>
                    );
                  })}
                  {unusedTestLicenses.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-2 font-medium">
                      No unused codes in store. Generate a code in the Super Admin first!
                    </div>
                  )}
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCompleteSetup} className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex gap-3 items-center shadow-sm">
                <CheckCircle2 className="shrink-0 text-emerald-500 animate-bounce" size={20} />
                <div>
                  <p className="font-extrabold text-sm">License Verified Successfully!</p>
                  <p className="mt-0.5 font-semibold text-slate-500">
                    Tier: <span className="font-bold text-slate-700">{validatedPlan.name}</span> •
                    Storage: <span className="font-bold text-slate-700">{validatedPlan.maxStorage}GB</span> •
                    Validity: <span className="font-bold text-slate-700">{validityMonths} Months</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Hospital Name */}
                <div className="space-y-1 group">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Hospital Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Building size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. City Care Hospital"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      required
                      className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-100 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Hospital Address */}
                <div className="space-y-1 group">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Hospital Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <MapPin size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 102 Metro Road, Connaught Place, New Delhi"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                      className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-100 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Admin Full Name */}
                <div className="space-y-1 group">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Hospital Admin Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Rajesh Verma"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      required
                      className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-100 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Admin Email */}
                <div className="space-y-1 group">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Admin Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      placeholder="e.g. admin@citycare.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-100 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1 group">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-focus-within:text-blue-600 transition-colors">Choose Admin Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Lock size={16} />
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      className="block w-full pl-11 pr-3.5 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-100 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3.5 pt-2">
                <Button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 h-12 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-full font-bold text-sm transition-all"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/15 hover:-translate-y-[1.5px] hover:scale-[1.01] active:translate-y-0 active:scale-[0.99]"
                >
                  Create Hospital Node <CheckCircle2 size={16} />
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-slate-400 flex justify-between items-center px-3 font-semibold">
          <span>MediSaaS Platform Gateway v1.0.0</span>
          <button
            onClick={() => navigate('/login')}
            className="text-blue-600 hover:text-blue-700 font-bold transition-colors active:scale-95"
          >
            Back to Operator Login
          </button>
        </div>
      </div>
    </div>
  );
}
