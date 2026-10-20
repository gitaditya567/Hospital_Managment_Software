import { useEffect, useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CreditCard, CheckCircle, AlertTriangle, ShieldCheck, Download, Calendar, HardDrive, UserCheck, Printer, Sliders, Sparkles, X, Key, Zap, PackageCheck, Check, Mail } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getPrintSettings, savePrintSettings } from '../../utils/printSettings';
import type { PrintSettings } from '../../utils/printSettings';

export function HospitalAdminBilling() {
  const { staff, fees, renewSubscription, subscriptionTenant, subscriptionPlans: plans, subscriptionInvoices: invoices, fetchSubscription, hospitalName: storeHospitalName } = useHospitalStore();
  const tenants = subscriptionTenant ? [subscriptionTenant] : [];
  const { user } = useAuthStore();

  const [printSettings, setPrintSettings] = useState<PrintSettings>(getPrintSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal & Renewal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [licenseInput, setLicenseInput] = useState('');
  const [renewing, setRenewing] = useState(false);
  const [renewStatus, setRenewStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const updateSetting = (key: keyof PrintSettings, value: any) => {
    setPrintSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSavePrintSettings = () => {
    savePrintSettings(printSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert("Image is too large. Please select a logo under 500KB to ensure smooth persistence.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateSetting('logoUrl', event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Find active tenant and its plan
  const currentHospitalId = user?.hospitalId || tenants[0]?.id || 'tenant-1';
  const currentHospital = tenants.find(t => t.id === currentHospitalId);
  const hospitalName = currentHospital?.hospitalName || storeHospitalName || '';
  const plan = currentHospital ? plans.find(p => p.id === currentHospital.planId) : plans[0] || null;

  // Calculate subscription validity days remaining
  const expiryDateStr = currentHospital?.subscriptionExpiryDate || '';
  const expiryDate = new Date(`${expiryDateStr}T00:00:00`);
  const diffTime = expiryDate.getTime() - new Date().setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Determine subscription health status (valid through the expiry date itself)
  const isExpiringSoon = diffDays >= 0 && diffDays <= 30;
  const isExpired = diffDays < 0;

  // Filter invoices for THIS hospital
  const hospitalInvoices = invoices.filter(
    inv => inv.hospitalName.toLowerCase() === hospitalName.toLowerCase()
  );

  // Count staff allocations
  const doctorsCreated = staff.filter(s => s.role === 'Doctor').length;
  const receptionistsCreated = staff.filter(s => s.role === 'Receptionist').length;
  const pharmacistsCreated = staff.filter(s => s.role === 'Pharmacy').length;

  const storageUsed = currentHospital?.storageUsed || 0; // dynamically fetched from backend API (in MB)

  const handleLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseInput.trim()) return;

    setRenewing(true);
    setRenewStatus(null);

    const res = await renewSubscription(currentHospitalId, licenseInput.trim());
    if (res.success) {
      setRenewStatus({ type: 'success', message: res.message || 'Subscription renewed successfully!' });
      setLicenseInput('');
      await fetchSubscription();
    } else {
      setRenewStatus({ type: 'error', message: res.error || 'Invalid or used License Key.' });
    }
    setRenewing(false);
  };

  return (
    <div className="space-y-6 font-sans">

      {/* Dynamic Subscription Status Banner */}
      {isExpired ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in fade-in">
          <div className="flex gap-4 items-start">
            <div className="h-12 w-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-rose-800">Critical Warning: Subscription Expired!</h2>
              <p className="text-xs text-rose-600 font-semibold">
                Your Smart Hospital Management Software subscription ended on <span className="font-extrabold">{expiryDateStr}</span>. Administrative slots are locked.
              </p>
            </div>
          </div>
          <Button onClick={() => setIsPlanModalOpen(true)} className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-10 px-5 rounded-xl">
            Renew Subscription Plan
          </Button>
        </div>
      ) : isExpiringSoon ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in fade-in">
          <div className="flex gap-4 items-start">
            <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-amber-800">Warning: Software access locks in {diffDays} days!</h2>
              <p className="text-xs text-amber-600 font-semibold">
                Your pricing tier subscription expires soon on <span className="font-extrabold">{expiryDateStr}</span>.
              </p>
            </div>
          </div>
          <Button onClick={() => setIsPlanModalOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-10 px-5 rounded-xl">
            Renew Subscription Plan
          </Button>
        </div>
      ) : (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in fade-in">
          <div className="flex gap-4 items-start">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
              <ShieldCheck size={24} className="text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-emerald-800">Plan: {plan?.name || 'Premium Plan'} • Active & Healthy</h2>
              <p className="text-xs text-emerald-600 font-semibold">
                Your hospital node is operational. SaaS subscription remains valid until <span className="font-extrabold">{expiryDateStr}</span> ({diffDays} Days left).
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setIsPlanModalOpen(true)} className="border-emerald-200 text-emerald-700 hover:bg-emerald-100/50 font-bold text-xs h-10 px-5 rounded-xl">
            View Available Plans / Upgrade
          </Button>
        </div>
      )}

      {/* Usage telemetry cards & progress bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Progress Bars Limit details */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-xs border border-[#D8D8D8] p-5 space-y-6">
          <div className="border-b border-[#D8D8D8] pb-3">
            <h2 className="text-base font-bold text-[#060606] flex items-center gap-1.5">
              <UserCheck className="text-[#3683F8]" size={18} /> Plan Capacity Slots Allocation
            </h2>
            <p className="text-xs text-slate-500">Real-time statistics of staff slots and storage capacity compared to plan limits.</p>
          </div>

          {plan && (
            <div className="space-y-5">
              {/* Doctors Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">👨‍⚕️ Doctor Accounts</span>
                  <span className="font-bold font-mono text-[#060606]">
                    {doctorsCreated} / {plan.maxDoctors === -1 ? 'Unlimited' : plan.maxDoctors} used
                  </span>
                </div>
                <div className="h-2 w-full bg-[#EBF3FE] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      plan.maxDoctors !== -1 && doctorsCreated >= plan.maxDoctors ? 'bg-rose-500' : 'bg-[#3683F8]'
                    }`}
                    style={{ width: `${plan.maxDoctors === -1 ? 30 : Math.min((doctorsCreated / plan.maxDoctors) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Receptionists Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">👩‍💼 Receptionist Accounts</span>
                  <span className="font-bold font-mono text-[#060606]">
                    {receptionistsCreated} / {plan.maxReceptionists === -1 ? 'Unlimited' : plan.maxReceptionists} used
                  </span>
                </div>
                <div className="h-2 w-full bg-[#EBF3FE] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      plan.maxReceptionists !== -1 && receptionistsCreated >= plan.maxReceptionists ? 'bg-rose-500' : 'bg-[#3683F8]'
                    }`}
                    style={{ width: `${plan.maxReceptionists === -1 ? 20 : Math.min((receptionistsCreated / plan.maxReceptionists) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Pharmacists Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">💊 Pharmacist & Medical Accounts</span>
                  <span className="font-bold font-mono text-[#060606]">
                    {pharmacistsCreated} / {plan.maxPharmacists === -1 ? 'Unlimited' : plan.maxPharmacists} used
                  </span>
                </div>
                <div className="h-2 w-full bg-[#EBF3FE] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      plan.maxPharmacists !== -1 && pharmacistsCreated >= plan.maxPharmacists ? 'bg-rose-500' : 'bg-[#3683F8]'
                    }`}
                    style={{ width: `${plan.maxPharmacists === -1 ? 40 : Math.min((pharmacistsCreated / plan.maxPharmacists) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Storage Quota */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2 flex-1">
                    <HardDrive size={14} className="text-slate-400 inline" /> Database Storage Quota
                  </span>
                  <span className="font-bold font-mono text-[#060606]">
                    {(() => {
                      const mb = storageUsed;
                      if (mb < 0.0009765625) {
                        return `${(mb * 1024 * 1024).toFixed(0)} Bytes`;
                      } else if (mb < 1) {
                        return `${(mb * 1024).toFixed(2)} KB`;
                      } else if (mb < 1024) {
                        return `${mb.toFixed(2)} MB`;
                      } else {
                        return `${(mb / 1024).toFixed(2)} GB`;
                      }
                    })()} / {plan.maxStorage} GB used
                  </span>
                </div>
                <div className="h-2 w-full bg-[#EBF3FE] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-600 transition-all duration-500"
                    style={{ width: `${Math.min((storageUsed / (plan.maxStorage * 1024)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Support Plan Details */}
        <div className="bg-white rounded-2xl shadow-xs border border-[#D8D8D8] p-5 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold text-[#060606]">Support Level</h3>
            <div className="p-3 bg-[#EBF3FE] border border-blue-200 rounded-xl text-xs font-semibold text-[#060606] flex gap-2.5 items-start">
              <CheckCircle size={16} className="text-[#3683F8] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {plan?.name === 'Enterprise Plan' ? 'Enterprise SLAs Enabled' : plan?.name === 'Pro Plan' ? 'Priority SLAs Enabled' : 'Standard Support Enabled'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {plan?.name === 'Enterprise Plan'
                    ? 'Your hospital has priority 24/7 dedicated engineering support. Support emails: support@twinscloud.com.'
                    : plan?.name === 'Pro Plan'
                      ? 'Your hospital has priority email support with a 12-hour response guarantee. Support emails: support@twinscloud.com.'
                      : 'Your hospital has standard email support with a 24-hour response guarantee. Support emails: support@twinscloud.com.'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-[#D8D8D8] mt-6">
            <p className="text-xs font-extrabold text-[#060606]">Associated License Details:</p>
            <div className="bg-[#EBF3FE]/40 p-3 rounded-xl border border-[#D8D8D8] font-mono text-[10px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">License Code:</span>
                <span className="font-bold text-[#060606]">{currentHospital?.licenseCodeUsed || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pricing Tier:</span>
                <span className="font-bold text-[#3683F8]">{plan?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active Node Status:</span>
                <span className="font-bold text-emerald-600 uppercase">Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Layout & Format Configurator */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#D8D8D8] p-6 space-y-6 animate-in fade-in duration-300">
        <div className="border-b border-[#D8D8D8] pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#060606] flex items-center gap-2">
              <Printer className="text-[#3683F8]" size={20} /> Print Layout &amp; Formatting Configuration
            </h2>
            <p className="text-xs text-slate-500">Configure global sheet margins, padding, typography, branding titles, and colors for patient slips and prescriptions across all roles.</p>
          </div>
          <Button
            onClick={handleSavePrintSettings}
            className={`font-bold text-xs h-10 px-5 rounded-xl transition-all duration-300 flex items-center gap-1.5 shadow-md ${
              saveSuccess 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-[#3683F8] hover:bg-blue-600 text-white'
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle size={14} /> Global Format Applied to All Roles!
              </>
            ) : (
              <>
                <Sparkles size={14} /> Apply Global Format
              </>
            )}
          </Button>
        </div>

        {saveSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>
              Global format configuration active! Every slip generated by <strong>Receptionist, Pharmacy, Doctor, and Billing</strong> will now automatically use this exact layout format.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-6">

            {/* Presets and Sizes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Paper Size Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['80mm', 'A4'] as const).map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateSetting('paperSize', size)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        printSettings.paperSize === size
                          ? 'border-[#3683F8] bg-[#EBF3FE] text-[#3683F8] shadow-xs'
                          : 'border-[#D8D8D8] bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {size === '80mm' ? '📟 Thermal (3-inch)' : '📄 Standard A4 Sheet'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Default Hospital Tag</label>
                <input
                  type="text"
                  value={printSettings.customHeaderText}
                  onChange={e => updateSetting('customHeaderText', e.target.value)}
                  placeholder={hospitalName}
                  className="w-full h-9 px-3 border border-[#D8D8D8] rounded-xl focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] outline-none text-xs font-bold text-[#060606]"
                />
              </div>
            </div>

            {/* Range sliders */}
            <div className="space-y-5 bg-[#EBF3FE]/30 border border-[#D8D8D8] p-5 rounded-2xl">
              <h3 className="text-xs font-extrabold text-[#060606] flex items-center gap-1.5">
                <Sliders size={14} className="text-[#3683F8]" /> Dimension & Typography Formatting
              </h3>

              {/* Margin */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Page Margin</span>
                  <span className="font-mono font-bold text-[#3683F8]">{printSettings.margin} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={printSettings.margin}
                  onChange={e => updateSetting('margin', Number(e.target.value))}
                  className="w-full h-1.5 bg-[#D8D8D8] rounded-lg appearance-none cursor-pointer accent-[#3683F8]"
                />
                <p className="text-[10px] text-slate-400 font-medium">Controls outer spacing around print templates. Set lower for small receipt rolls.</p>
              </div>

              {/* Padding */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Inner Padding</span>
                  <span className="font-mono font-bold text-[#3683F8]">{printSettings.padding} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={printSettings.padding}
                  onChange={e => updateSetting('padding', Number(e.target.value))}
                  className="w-full h-1.5 bg-[#D8D8D8] rounded-lg appearance-none cursor-pointer accent-[#3683F8]"
                />
                <p className="text-[10px] text-slate-400 font-medium">Controls cell spacing inside slips, invoices, and prescription items list.</p>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Font Size (Base)</span>
                  <span className="font-mono font-bold text-[#3683F8]">{printSettings.fontSize} px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="18"
                  value={printSettings.fontSize}
                  onChange={e => updateSetting('fontSize', Number(e.target.value))}
                  className="w-full h-1.5 bg-[#D8D8D8] rounded-lg appearance-none cursor-pointer accent-[#3683F8]"
                />
                <p className="text-[10px] text-slate-400 font-medium">Balances font legibility. Higher values increase text size to prevent squinting.</p>
              </div>
            </div>

            {/* Color accent selection & header footer toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* Color selectors */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Print Primary Ink Accent</label>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { label: 'Brand Blue', value: '#3683F8', bg: 'bg-[#3683F8]' },
                    { label: 'Ink Black', value: '#060606', bg: 'bg-[#060606]' },
                    { label: 'Forest Green', value: '#047857', bg: 'bg-emerald-700' },
                    { label: 'Crimson Red', value: '#be123c', bg: 'bg-rose-700' }
                  ].map(color => (
                    <button
                      key={color.value}
                      type="button"
                      title={color.label}
                      onClick={() => updateSetting('accentColor', color.value)}
                      className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all ${color.bg} ${
                        printSettings.accentColor === color.value
                          ? 'border-[#3683F8] ring-2 ring-[#3683F8]/20 scale-110 shadow-xs'
                          : 'border-white'
                      }`}
                    >
                      {printSettings.accentColor === color.value && (
                        <span className="h-2 w-2 rounded-full bg-white animate-fade-in" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Black ink preset is optimized for fast and durable hardware thermal printing.</p>
              </div>

              {/* Toggles and Footer Custom message */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Layout Configurations</label>
                <div className="space-y-2.5 text-xs font-semibold text-[#060606]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printSettings.showHeader}
                      onChange={e => updateSetting('showHeader', e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-[#D8D8D8] text-[#3683F8] focus:ring-[#3683F8] cursor-pointer"
                    />
                    <span>Show Hospital Title and Header</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printSettings.showFooter}
                      onChange={e => updateSetting('showFooter', e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-[#D8D8D8] text-[#3683F8] focus:ring-[#3683F8] cursor-pointer"
                    />
                    <span>Show barcodes and clinical footer msg</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Logo Upload Section */}
            <div className="space-y-3 bg-[#EBF3FE]/30 border border-[#D8D8D8] p-4 rounded-2xl">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Hospital Logo Image</label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {printSettings.logoUrl ? (
                  <div className="relative h-16 w-16 rounded-2xl border border-[#D8D8D8] bg-white flex items-center justify-center p-1.5 group shadow-xs">
                    <img src={printSettings.logoUrl} alt="Hospital Logo" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => updateSetting('logoUrl', '')}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-bold text-[9px] shadow-md border border-white hover:scale-105 transition-all"
                      title="Remove Logo"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-[#D8D8D8] bg-white flex items-center justify-center text-slate-350">
                    <Printer size={22} className="opacity-40" />
                  </div>
                )}

                <div className="flex-1 space-y-2">
                  <div className="relative">
                    <input
                      type="file"
                      id="logo-upload-input"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="logo-upload-input"
                      className="inline-flex h-8 px-3 rounded-xl border border-[#D8D8D8] bg-white hover:bg-[#EBF3FE] text-[10px] font-bold text-[#060606] items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Download size={12} className="text-[#3683F8] rotate-180" /> Upload Image Logo
                    </label>
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium">Supports PNG, JPG or SVG. Max 500KB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Custom Footer Message</label>
              <input
                type="text"
                value={printSettings.customFooterText}
                onChange={e => updateSetting('customFooterText', e.target.value)}
                placeholder="Thank you for visiting! Powered by Smart Hospital Management Software • Copyright © twinsCloud"
                className="w-full h-9 px-3 border border-[#D8D8D8] rounded-xl focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] outline-none text-xs font-semibold text-[#060606]"
              />
            </div>
          </div>

          {/* Interactive Live Preview Column */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block self-start mb-2">Live Visual Output Preview</span>

            <div className="bg-[#EBF3FE]/40 p-5 rounded-3xl border border-[#D8D8D8] flex items-center justify-center w-full min-h-[420px] shadow-inner relative overflow-hidden">
              {/* Physical Slip Background representation */}
              <div
                className="bg-white border border-[#D8D8D8] rounded-xl shadow-md text-[#060606] transition-all duration-300 w-full max-w-[220px]"
                style={{
                  padding: `${printSettings.padding}px`,
                  fontSize: `${printSettings.fontSize}px`,
                  fontFamily: 'monospace',
                  borderTop: `4px solid ${printSettings.accentColor}`
                }}
              >
                {/* Header Title */}
                {printSettings.showHeader && (
                  <div className="text-center pb-2 border-b border-dashed border-[#D8D8D8] space-y-1">
                    {printSettings.logoUrl && (
                      <div className="flex justify-center mb-1.5">
                        <img src={printSettings.logoUrl} alt="Logo Preview" className="h-9 object-contain" />
                      </div>
                    )}
                    <h4 className="font-extrabold text-[1.1em] uppercase tracking-wide" style={{ color: printSettings.accentColor }}>
                      {printSettings.customHeaderText || hospitalName}
                    </h4>
                    <div className="flex justify-between text-[0.7em] text-slate-500 pt-1 border-t border-dashed border-slate-200">
                      <span>Bill No: <strong>SR-104</strong></span>
                      <span>Date: <strong>{new Date().toLocaleDateString('en-IN')}</strong></span>
                    </div>
                  </div>
                )}

                {/* Queue Token Box */}
                <div className="text-center py-2 border rounded-xl my-2 bg-[#EBF3FE]/50 space-y-0.5" style={{ borderColor: `${printSettings.accentColor}30` }}>
                  <p className="text-[0.68em] font-extrabold text-slate-400 uppercase tracking-wider">Queue Token</p>
                  <h2 className="text-[1.8em] font-black leading-none" style={{ color: printSettings.accentColor }}>A-104</h2>
                  <p className="text-[0.72em] font-extrabold text-slate-600">Dr. Sarah Rahman</p>
                </div>

                {/* Patient details */}
                <div className="space-y-1 text-[0.82em] border-b border-dashed border-[#D8D8D8] pb-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Patient:</span>
                    <span className="font-bold">Ananya Sharma</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">UID:</span>
                    <span className="font-mono">PAT-9831</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Age/Gender:</span>
                    <span className="font-bold">28 Yrs / Female</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-mono">9876543210</span>
                  </div>
                </div>

                {/* Billing charges list */}
                <div className="space-y-1 py-1.5 text-[0.82em]">
                  <div className="flex justify-between">
                    <span>OPD Consultation Fee:</span>
                    <span className="font-bold">₹{fees.opdFee}</span>
                  </div>
                  <div className="flex justify-between font-black text-[1.05em] border-t pt-1.5 mt-1" style={{ borderTopColor: printSettings.accentColor }}>
                    <span>TOTAL AMOUNT:</span>
                    <span style={{ color: printSettings.accentColor }}>₹{fees.opdFee}</span>
                  </div>
                </div>

                {/* Footer */}
                {printSettings.showFooter && (
                  <div className="text-center pt-2.5 border-t border-dashed border-[#D8D8D8] mt-2 space-y-1">
                    <p className="text-[0.68em] text-slate-500 uppercase tracking-wider">E &amp; O.E</p>
                    <p className="text-[0.72em] text-slate-600 font-semibold leading-normal">
                      {printSettings.customFooterText || 'Thank you for visiting!'}
                    </p>
                    <p className="text-[0.85em] font-extrabold text-slate-800 tracking-tight pt-1">Thank You</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Payments Receipts table */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#D8D8D8] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#D8D8D8] bg-[#EBF3FE]/30">
          <h2 className="text-lg font-bold text-[#060606] flex items-center gap-2">
            <CreditCard className="text-[#3683F8]" size={20} /> SaaS Payments Invoice Ledger
          </h2>
          <p className="text-xs text-slate-500">History of payments processed from this hospital node to Smart Hospital Management Software operators.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EBF3FE]/50 border-b border-[#D8D8D8] text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Billing Date</th>
                <th className="px-6 py-4">Subscription Plan</th>
                <th className="px-6 py-4">Amount Paid</th>
                <th className="px-6 py-4">Transaction Method</th>
                <th className="px-6 py-4">Payment Status</th>
                <th className="px-6 py-4 text-right">Receipts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8D8D8]/60 text-slate-700 text-xs font-medium">
              {hospitalInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#EBF3FE]/20 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-[#3683F8]">{inv.id}</td>
                  <td className="px-6 py-4 flex items-center gap-1.5 text-slate-600">
                    <Calendar size={14} className="text-slate-400" />
                    <span>{inv.date}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#060606]">{inv.planName}</td>
                  <td className="px-6 py-4 font-bold text-[#060606] font-mono">₹{inv.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 font-bold text-slate-500">{inv.method}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'Paid' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => alert(`Downloading receipt for invoice ${inv.id}...`)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3683F8] hover:text-blue-600"
                    >
                      <Download size={12} /> Receipt
                    </button>
                  </td>
                </tr>
              ))}
              {hospitalInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400 font-semibold">
                    No billing ledger registered. Onboarded manually by Super Admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Available Subscription & Renewal Plans Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 font-sans">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-[#D8D8D8] overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-[#3683F8] text-white p-6 sm:p-8 relative">
              <button
                onClick={() => { setIsPlanModalOpen(false); setRenewStatus(null); }}
                className="absolute top-5 right-5 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-300 fill-amber-300" /> SaaS Pricing & Upgrades
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Available Subscription Plans</h2>
              <p className="text-blue-50 text-xs sm:text-sm mt-1 max-w-2xl">
                Explore available plans or enter a License Key provided by Super Admin to extend your hospital software access.
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-8 max-h-[75vh] overflow-y-auto">

              {/* License Key Activation Section */}
              <div className="bg-[#EBF3FE]/50 border border-blue-200 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#060606] flex items-center gap-2">
                    <Key size={16} className="text-[#3683F8]" /> Have a Renewal License Key / Code?
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400">Instant Activation</span>
                </div>

                <form onSubmit={handleLicenseSubmit} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value)}
                    placeholder="e.g. HMS-2026-001-A9X2K4"
                    className="flex-1 h-11 px-4 border border-[#D8D8D8] rounded-xl text-xs font-mono font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] bg-white text-[#060606]"
                  />
                  <Button
                    type="submit"
                    disabled={renewing || !licenseInput.trim()}
                    className="h-11 px-6 bg-[#3683F8] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md shrink-0"
                  >
                    {renewing ? 'Validating...' : 'Activate & Renew Plan'}
                  </Button>
                </form>

                {renewStatus && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    renewStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {renewStatus.type === 'success' ? <CheckCircle size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
                    <span>{renewStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Available Plans Grid */}
              <div className="space-y-4">
                <h3 className="text-base font-extrabold text-[#060606] flex items-center gap-2">
                  <PackageCheck size={18} className="text-[#3683F8]" /> Available SaaS Tiers ({plans.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {plans.map((p) => {
                    const isCurrent = plan?.id === p.id || plan?.name === p.name;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl p-5 border transition-all relative flex flex-col justify-between ${
                          isCurrent
                            ? 'border-[#3683F8] bg-[#EBF3FE]/40 ring-2 ring-[#3683F8]/20 shadow-md'
                            : 'border-[#D8D8D8] bg-white hover:border-[#3683F8] hover:shadow-xs'
                        }`}
                      >
                        {isCurrent && (
                          <span className="absolute -top-3 right-4 bg-[#3683F8] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                            Current Active Plan
                          </span>
                        )}

                        <div className="space-y-3">
                          <div>
                            <h4 className="text-base font-bold text-[#060606]">{p.name}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{p.durationMonths || 12} Months License Validity</p>
                          </div>

                          <div className="py-2 border-y border-[#D8D8D8]">
                            <span className="text-2xl font-black text-[#060606]">₹{p.price.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-slate-400 font-semibold"> / {p.durationMonths || 12} mo</span>
                          </div>

                          <ul className="space-y-2 text-xs font-semibold text-slate-600">
                            <li className="flex items-center gap-2">
                              <Check size={14} className="text-emerald-500 shrink-0" />
                              <span>Doctor Slots: <strong className="text-[#060606]">{p.maxDoctors === -1 ? 'Unlimited' : `${p.maxDoctors} Doctors`}</strong></span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check size={14} className="text-emerald-500 shrink-0" />
                              <span>Receptionist Slots: <strong className="text-[#060606]">{p.maxReceptionists === -1 ? 'Unlimited' : `${p.maxReceptionists} Accounts`}</strong></span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check size={14} className="text-emerald-500 shrink-0" />
                              <span>Pharmacy Slots: <strong className="text-[#060606]">{p.maxPharmacists === -1 ? 'Unlimited' : `${p.maxPharmacists} Accounts`}</strong></span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check size={14} className="text-emerald-500 shrink-0" />
                              <span>Storage Quota: <strong className="text-[#060606]">{p.maxStorage} GB</strong></span>
                            </li>
                          </ul>
                        </div>

                        <div className="pt-5 mt-3 border-t border-[#D8D8D8]">
                          <Button
                            onClick={() => {
                              setLicenseInput('');
                              setRenewStatus({
                                type: 'success',
                                message: `Selected ${p.name}. Enter your license key above to activate this plan.`
                              });
                            }}
                            className={`w-full text-xs font-bold h-9 rounded-xl ${
                              isCurrent
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-[#3683F8] hover:bg-blue-600 text-white'
                            }`}
                          >
                            {isCurrent ? 'Active Plan' : `Select ${p.name}`}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Support Email Callout */}
              <div className="bg-[#3683F8] text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Mail size={16} className="text-blue-100" /> Need a new License Key for Renewal?
                  </h4>
                  <p className="text-xs text-blue-50">
                    Contact Super Admin or TwinsCloud support team to issue an offline license key for your hospital.
                  </p>
                </div>
                <a
                  href="mailto:support@twinscloud.com?subject=Subscription%20Renewal%20License%20Request"
                  className="px-4 py-2 bg-white text-[#3683F8] hover:bg-blue-50 text-xs font-bold rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  Request License Key
                </a>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
