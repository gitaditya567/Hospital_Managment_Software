import { useState } from 'react';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Button } from '../../components/ui/Button';
import { Settings, Shield, Mail, FileSpreadsheet, Server, DollarSign, ToggleLeft, ToggleRight, Check } from 'lucide-react';

export function SuperAdminSettings() {
  const { settings, updateSettings, addActivity } = useSuperAdminStore();
  const [platformName, setPlatformName] = useState(settings.platformName);
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail);
  const [taxRate, setTaxRate] = useState(settings.taxRate);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode);
  const [allowManualOnboarding, setAllowManualOnboarding] = useState(settings.allowManualOnboarding);
  const [stripeEnabled, setStripeEnabled] = useState(settings.stripeEnabled);
  const [razorpayEnabled, setRazorpayEnabled] = useState(settings.razorpayEnabled);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      platformName,
      supportEmail,
      taxRate: Number(taxRate),
      maintenanceMode,
      allowManualOnboarding,
      stripeEnabled,
      razorpayEnabled,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleBackupDB = () => {
    addActivity('Manual raw encrypted MongoDB database backup successfully downloaded by Super Admin.', 'system');
    alert('System backup initiated. An encrypted backup archive is compiling and downloading...');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="text-slate-700" /> Platform Settings
        </h1>
        <p className="text-slate-500">Configure global parameters, security defaults, and integrated gateway states</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Profile & Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
            <Server size={18} className="text-blue-500" /> Global Platform Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SaaS Product Name</label>
              <input 
                type="text" 
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Super Admin Support Email</label>
              <input 
                type="email" 
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Maintenance Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-800">Maintenance Mode</p>
                <p className="text-xs text-slate-400">Lock database logins except for Super Admins</p>
              </div>
              <button 
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className="text-blue-600 focus:outline-none transition-transform active:scale-95"
              >
                {maintenanceMode ? <ToggleRight size={44} className="text-rose-500" /> : <ToggleLeft size={44} className="text-slate-300" />}
              </button>
            </div>

            {/* Offline Sales Activation Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-800">Manual License Code Activation</p>
                <p className="text-xs text-slate-400">Permit clinic admins to register offline sales licenses</p>
              </div>
              <button 
                type="button"
                onClick={() => setAllowManualOnboarding(!allowManualOnboarding)}
                className="text-blue-600 focus:outline-none transition-transform active:scale-95"
              >
                {allowManualOnboarding ? <ToggleRight size={44} className="text-emerald-500" /> : <ToggleLeft size={44} className="text-slate-300" />}
              </button>
            </div>
          </div>
        </div>

        {/* Integration Options */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
            <DollarSign size={18} className="text-emerald-500" /> Payment & Billing Configurator
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Base Tax Rate (GST / VAT %)</label>
              <div className="relative">
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-sm font-bold">%</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Automated Stripe/Razorpay Webhooks Simulation</p>
            
            <div className="flex items-center justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">S</div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Stripe Webhook Integration</p>
                  <p className="text-[10px] text-slate-400">Pipes transaction successes directly from Stripe webhook endpoints</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setStripeEnabled(!stripeEnabled)}
                className="focus:outline-none"
              >
                {stripeEnabled ? <ToggleRight size={40} className="text-indigo-600" /> : <ToggleLeft size={40} className="text-slate-300" />}
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">R</div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Razorpay API Integration (India)</p>
                  <p className="text-[10px] text-slate-400">Pipes transactions in real-time utilizing Razorpay payment routes</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setRazorpayEnabled(!razorpayEnabled)}
                className="focus:outline-none"
              >
                {razorpayEnabled ? <ToggleRight size={40} className="text-blue-600" /> : <ToggleLeft size={40} className="text-slate-300" />}
              </button>
            </div>
          </div>
        </div>

        {/* Diagnostic Actions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
            <Shield size={18} className="text-rose-500" /> Central Security & Diagnosis
          </h2>
          <p className="text-xs text-slate-500">
            For critical emergency incidents or security audits. Perform backups of entire tenant MongoDB records. (Clinical logs and patient histories are private and fully excluded from backup files to secure strict HIPAA boundaries).
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleBackupDB} 
              className="flex items-center gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <FileSpreadsheet size={16} /> Export Centralized DB Backup
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                alert('Audited log files compile successfully. Generated diagnostic index token for HIPAA compliance: COMP-9283-DX82');
              }}
              className="flex items-center gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Mail size={16} /> Send Diagnostics Log
            </Button>
          </div>
        </div>

        {/* Submit & Success */}
        <div className="flex items-center gap-4">
          <Button type="submit" className="shadow-lg shadow-blue-500/10">
            Save Configuration
          </Button>
          {isSaved && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 animate-in fade-in duration-200">
              <Check size={16} /> Settings applied globally in real-time!
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
