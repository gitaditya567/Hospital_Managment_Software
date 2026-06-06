import { useEffect, useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CreditCard, CheckCircle, AlertTriangle, ShieldCheck, Download, Calendar, HardDrive, UserCheck, Printer, Sliders, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getPrintSettings, savePrintSettings } from '../../utils/printSettings';
import type { PrintSettings } from '../../utils/printSettings';

export function HospitalAdminBilling() {
  const { staff, fees } = useHospitalStore();
  const { tenants, plans, invoices, fetchSuperAdminData } = useSuperAdminStore();
  const { user } = useAuthStore();

  const [printSettings, setPrintSettings] = useState<PrintSettings>(getPrintSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSuperAdminData();
  }, [fetchSuperAdminData]);

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
  const hospitalName = currentHospital?.hospitalName || 'City Care Hospital';
  const plan = currentHospital ? plans.find(p => p.id === currentHospital.planId) : plans[0] || null;

  // Calculate subscription validity days remaining
  const expiryDateStr = currentHospital?.subscriptionExpiryDate || '2027-05-23';
  const expiryDate = new Date(expiryDateStr);
  const diffTime = expiryDate.getTime() - new Date().getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Determine subscription health status
  const isExpiringSoon = diffDays > 0 && diffDays <= 30;
  const isExpired = diffDays <= 0;

  // Filter invoices for THIS hospital
  const hospitalInvoices = invoices.filter(
    inv => inv.hospitalName.toLowerCase() === hospitalName.toLowerCase()
  );

  // Count staff allocations
  const doctorsCreated = staff.filter(s => s.role === 'Doctor').length;
  const receptionistsCreated = staff.filter(s => s.role === 'Receptionist').length;
  const pharmacistsCreated = staff.filter(s => s.role === 'Pharmacy').length;

  const storageUsed = currentHospital?.storageUsed || 1.15; // dynamically fetched from backend API (in MB)

  return (
    <div className="space-y-6">

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
                Your MediSaaS subscription ended on <span className="font-extrabold">{expiryDateStr}</span>. Administrative slots are locked.
              </p>
            </div>
          </div>
          <Button className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-10 px-5 rounded-full">
            Contact Super Admin to Renew
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
          <Button className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-10 px-5 rounded-full">
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
          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-100/50 font-bold text-xs h-10 px-5 rounded-full">
            Upgrade Plan Tier
          </Button>
        </div>
      )}

      {/* Usage telemetry cards & progress bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Progress Bars Limit details */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
              <UserCheck className="text-blue-500" size={18} /> Plan Capacity Slots Allocation
            </h2>
            <p className="text-xs text-slate-500">Real-time statistics of staff slots and storage capacity compared to plan limits.</p>
          </div>

          {plan && (
            <div className="space-y-5">
              {/* Doctors Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">👨‍⚕️ Doctor Accounts</span>
                  <span className="font-bold font-mono">
                    {doctorsCreated} / {plan.maxDoctors === -1 ? 'Unlimited' : plan.maxDoctors} used
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      plan.maxDoctors !== -1 && doctorsCreated >= plan.maxDoctors ? 'bg-rose-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${plan.maxDoctors === -1 ? 30 : Math.min((doctorsCreated / plan.maxDoctors) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Receptionists Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">👩‍💼 Receptionist Accounts</span>
                  <span className="font-bold font-mono">
                    {receptionistsCreated} / {plan.maxReceptionists === -1 ? 'Unlimited' : plan.maxReceptionists} used
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      plan.maxReceptionists !== -1 && receptionistsCreated >= plan.maxReceptionists ? 'bg-rose-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${plan.maxReceptionists === -1 ? 20 : Math.min((receptionistsCreated / plan.maxReceptionists) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Pharmacists Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">💊 Pharmacist & Medical Accounts</span>
                  <span className="font-bold font-mono">
                    {pharmacistsCreated} / {plan.maxPharmacists === -1 ? 'Unlimited' : plan.maxPharmacists} used
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      plan.maxPharmacists !== -1 && pharmacistsCreated >= plan.maxPharmacists ? 'bg-rose-500' : 'bg-blue-600'
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
                  <span className="font-bold font-mono">
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
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${Math.min((storageUsed / (plan.maxStorage * 1024)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Support Plan Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-800">Support Level</h3>
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs font-semibold text-blue-900 flex gap-2.5 items-start">
              <CheckCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {plan?.name === 'Enterprise Plan' ? 'Enterprise SLAs Enabled' : plan?.name === 'Pro Plan' ? 'Priority SLAs Enabled' : 'Standard Support Enabled'}
                </p>
                <p className="text-[10px] text-blue-700 mt-0.5">
                  {plan?.name === 'Enterprise Plan'
                    ? 'Your hospital has priority 24/7 dedicated engineering support. Support emails: support@medisaas.com.'
                    : plan?.name === 'Pro Plan'
                      ? 'Your hospital has priority email support with a 12-hour response guarantee. Support emails: support@medisaas.com.'
                      : 'Your hospital has standard email support with a 24-hour response guarantee. Support emails: support@medisaas.com.'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-slate-50 mt-6">
            <p className="text-xs font-extrabold text-slate-700">Associated License Details:</p>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/50 font-mono text-[10px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">License Code:</span>
                <span className="font-bold text-slate-800">{currentHospital?.licenseCodeUsed || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pricing Tier:</span>
                <span className="font-bold text-blue-600">{plan?.name || '—'}</span>
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-6 animate-in fade-in duration-300">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Printer className="text-blue-500" size={20} /> Print Layout & Formatting Configuration
            </h2>
            <p className="text-xs text-slate-500">Configure global sheet margins, padding, typography, branding titles, and colors for patient slips and prescriptions.</p>
          </div>
          <Button
            onClick={handleSavePrintSettings}
            className={`font-bold text-xs h-10 px-5 rounded-xl transition-all duration-300 flex items-center gap-1.5 shadow-sm hover:scale-[1.01] active:scale-[0.99] ${
              saveSuccess 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-250/20' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-250/20'
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle size={14} /> Format Saved Successfully!
              </>
            ) : (
              <>
                <Sparkles size={14} /> Apply Global Format
              </>
            )}
          </Button>
        </div>

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
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all hover:scale-[1.01] active:scale-[0.99] ${
                        printSettings.paperSize === size
                          ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                  className="w-full h-9 px-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs font-bold text-slate-700"
                />
              </div>
            </div>

            {/* Range sliders */}
            <div className="space-y-5 bg-slate-50/50 border border-slate-200/50 p-5 rounded-2xl">
              <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <Sliders size={14} className="text-slate-400" /> Dimension & Typography Formatting
              </h3>

              {/* Margin */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Page Margin</span>
                  <span className="font-mono font-bold text-blue-600">{printSettings.margin} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={printSettings.margin}
                  onChange={e => updateSetting('margin', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 font-medium">Controls outer spacing around print templates. Set lower for small receipt rolls.</p>
              </div>

              {/* Padding */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Inner Padding</span>
                  <span className="font-mono font-bold text-blue-600">{printSettings.padding} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={printSettings.padding}
                  onChange={e => updateSetting('padding', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 font-medium">Controls cell spacing inside slips, invoices, and prescription items list.</p>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Font Size (Base)</span>
                  <span className="font-mono font-bold text-blue-600">{printSettings.fontSize} px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="18"
                  value={printSettings.fontSize}
                  onChange={e => updateSetting('fontSize', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
                    { label: 'Ink Black', value: '#000000', bg: 'bg-black' },
                    { label: 'Royal Blue', value: '#1e293b', bg: 'bg-slate-800' },
                    { label: 'Navy Glow', value: '#1d4ed8', bg: 'bg-blue-700' },
                    { label: 'Forest Green', value: '#047857', bg: 'bg-emerald-700' },
                    { label: 'Crimson Red', value: '#be123c', bg: 'bg-rose-700' }
                  ].map(color => (
                    <button
                      key={color.value}
                      type="button"
                      title={color.label}
                      onClick={() => updateSetting('accentColor', color.value)}
                      className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${color.bg} ${
                        printSettings.accentColor === color.value
                          ? 'border-blue-500 ring-2 ring-blue-500/20 scale-110 shadow-sm'
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
                <div className="space-y-2.5 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printSettings.showHeader}
                      onChange={e => updateSetting('showHeader', e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-slate-350 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Show Hospital Title and Header</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printSettings.showFooter}
                      onChange={e => updateSetting('showFooter', e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-slate-350 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Show barcodes and clinical footer msg</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Logo Upload Section */}
            <div className="space-y-3 bg-slate-50/50 border border-slate-200/50 p-4 rounded-2xl">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Hospital Logo Image</label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {printSettings.logoUrl ? (
                  <div className="relative h-16 w-16 rounded-2xl border border-slate-200 bg-white flex items-center justify-center p-1.5 group shadow-sm">
                    <img src={printSettings.logoUrl} alt="Hospital Logo" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => updateSetting('logoUrl', '')}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-bold text-[9px] shadow-md border border-white hover:scale-105 transition-all animate-in zoom-in"
                      title="Remove Logo"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-slate-250 bg-white flex items-center justify-center text-slate-350">
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
                      className="inline-flex h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-700 items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.01] transition-all"
                    >
                      <Download size={12} className="text-blue-500 rotate-180" /> Upload Image Logo
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
                placeholder="Thank you for visiting! Powered by MediSaaS."
                className="w-full h-9 px-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs font-semibold text-slate-700"
              />
            </div>
          </div>

          {/* Interactive Live Preview Column */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block self-start mb-2">Live Visual Output Preview</span>

            <div className="bg-slate-100/80 p-5 rounded-3xl border border-slate-200/60 flex items-center justify-center w-full min-h-[420px] shadow-inner relative overflow-hidden">
              {/* Physical Slip Background representation */}
              <div
                className="bg-white border border-slate-300 rounded shadow-md text-slate-900 transition-all duration-300 max-h-[430px] overflow-y-auto"
                style={{
                  width: printSettings.paperSize === 'A4' ? '260px' : '190px',
                  padding: `${printSettings.padding}px`,
                  margin: `${printSettings.margin}px`,
                  fontSize: `${printSettings.fontSize}px`,
                  fontFamily: printSettings.paperSize === 'A4' ? 'sans-serif' : 'monospace',
                  borderTop: `4px solid ${printSettings.accentColor}`
                }}
              >
                {/* Header Title */}
                {printSettings.showHeader && (
                  <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-1">
                    {printSettings.logoUrl && (
                      <div className="flex justify-center mb-1.5 animate-in zoom-in duration-200">
                        <img src={printSettings.logoUrl} alt="Logo Preview" className="h-10 object-contain" />
                      </div>
                    )}
                    <h4 className="font-extrabold text-[1.15em] uppercase tracking-wide" style={{ color: printSettings.accentColor }}>
                      🏥 {printSettings.customHeaderText || hospitalName}
                    </h4>
                    <p className="text-[0.75em] text-slate-500">Live Clinical Registry Slip</p>
                    <p className="text-[0.65em] text-slate-400">Date: {new Date().toLocaleDateString('en-IN')}</p>
                  </div>
                )}

                {/* Queue Token Box */}
                <div className="text-center py-2 border rounded my-2 bg-slate-50/50 space-y-0.5" style={{ borderColor: `${printSettings.accentColor}30` }}>
                  <p className="text-[0.7em] font-extrabold text-slate-400 uppercase tracking-wider">Queue Token</p>
                  <h2 className="text-[1.8em] font-black leading-none animate-pulse-fast" style={{ color: printSettings.accentColor }}>A-104</h2>
                  <p className="text-[0.75em] font-extrabold text-slate-600">Dr. Sarah Rahman</p>
                </div>

                {/* Patient details */}
                <div className="space-y-1 text-[0.85em] border-b border-dashed border-slate-300 pb-2">
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
                <div className="space-y-1 py-1.5 text-[0.85em]">
                  <div className="flex justify-between">
                    <span>OPD Fee:</span>
                    <span className="font-bold">₹{fees.opdFee}</span>
                  </div>
                  <div className="flex justify-between font-black text-[1.1em] border-t pt-1.5 mt-1" style={{ borderTopColor: printSettings.accentColor }}>
                    <span>Paid Amount:</span>
                    <span style={{ color: printSettings.accentColor }}>₹{fees.opdFee}</span>
                  </div>
                </div>

                {/* Footer and mock barcode */}
                {printSettings.showFooter && (
                  <div className="text-center pt-2.5 border-t border-dashed border-slate-300 mt-2 space-y-1.5">
                    <div className="h-5 w-full flex items-center justify-center text-[0.65em] text-white tracking-[4px] font-bold rounded" style={{ backgroundColor: printSettings.accentColor }}>
                      ||||||||||||||||||
                    </div>
                    <p className="text-[0.68em] text-slate-400 leading-normal uppercase">
                      {printSettings.customFooterText || 'Please wait outside Room 101'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Payments Receipts table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="text-blue-500" size={20} /> SaaS Payments Invoice Ledger
          </h2>
          <p className="text-xs text-slate-500">History of payments processed from this hospital node to MediSaaS operators.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Billing Date</th>
                <th className="px-6 py-4">Subscription Plan</th>
                <th className="px-6 py-4">Amount Paid</th>
                <th className="px-6 py-4">Transaction Method</th>
                <th className="px-6 py-4">Payment Status</th>
                <th className="px-6 py-4 text-right">Receipts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs font-medium">
              {hospitalInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-slate-800">{inv.id}</td>
                  <td className="px-6 py-4 flex items-center gap-1.5 text-slate-600">
                    <Calendar size={14} className="text-slate-400" />
                    <span>{inv.date}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">{inv.planName}</td>
                  <td className="px-6 py-4 font-bold text-slate-900 font-mono">₹{inv.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 font-bold text-slate-500">{inv.method}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${inv.status === 'Paid' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => alert(`Downloading receipt for invoice ${inv.id}...`)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-500"
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
    </div>
  );
}
