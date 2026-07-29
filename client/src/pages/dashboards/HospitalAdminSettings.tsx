import { useState, useEffect } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { Settings, Building2, DollarSign, Check, Save } from 'lucide-react';

export function HospitalAdminSettings() {
  const user = useAuthStore((state) => state.user);
  const { hospitalName, hospitalLogo, fees, updateFees, fetchHospitalData } = useHospitalStore();

  const [name, setName] = useState(hospitalName || '');
  const [logoUrl, setLogoUrl] = useState(hospitalLogo || '');
  const [opdFee, setOpdFee] = useState(fees?.opdFee ?? 500);
  const [emergencyFee, setEmergencyFee] = useState(fees?.emergencyFee ?? 1200);
  const [bedChargePerDay, setBedChargePerDay] = useState(fees?.bedChargePerDay ?? 2500);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.hospitalId) {
      fetchHospitalData(user.hospitalId);
    }
  }, [user?.hospitalId, fetchHospitalData]);

  useEffect(() => {
    setName(hospitalName || '');
    setLogoUrl(hospitalLogo || '');
    if (fees) {
      setOpdFee(fees.opdFee ?? 500);
      setEmergencyFee(fees.emergencyFee ?? 1200);
      setBedChargePerDay(fees.bedChargePerDay ?? 2500);
    }
  }, [hospitalName, hospitalLogo, fees]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFees({
        opdFee: Number(opdFee),
        emergencyFee: Number(emergencyFee),
        bedChargePerDay: Number(bedChargePerDay),
      });

      if (name) {
        localStorage.setItem('medisaas_hospital_name', name);
      }
      if (logoUrl) {
        localStorage.setItem('medisaas_hospital_logo', logoUrl);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="text-slate-700" /> Hospital Settings
        </h1>
        <p className="text-slate-500">Manage hospital profile, consultation fees, and operational parameters</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Hospital Branding */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
            <Building2 size={18} className="text-blue-500" /> Hospital Profile & Branding
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital / Clinic Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-medium"
                placeholder="e.g. MetroCare General Hospital"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital Logo URL</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>

          {logoUrl && (
            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs font-semibold text-slate-400">Logo Preview:</span>
              <img src={logoUrl} alt="Hospital Logo" className="h-10 w-auto max-w-[150px] object-contain rounded border border-slate-200 p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
            </div>
          )}
        </div>

        {/* Standard Operational Fees */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
            <DollarSign size={18} className="text-emerald-500" /> Standard Operational Charges
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">OPD Consultation Fee (₹)</label>
              <input
                type="number"
                min="0"
                value={opdFee}
                onChange={(e) => setOpdFee(Number(e.target.value))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Emergency Fee (₹)</label>
              <input
                type="number"
                min="0"
                value={emergencyFee}
                onChange={(e) => setEmergencyFee(Number(e.target.value))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bed Charge / Day (₹)</label>
              <input
                type="number"
                min="0"
                value={bedChargePerDay}
                onChange={(e) => setBedChargePerDay(Number(e.target.value))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        {/* Submit & Status */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving} className="shadow-lg shadow-blue-500/10 flex items-center gap-2">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          {isSaved && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 animate-in fade-in duration-200">
              <Check size={16} /> Settings saved successfully!
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
