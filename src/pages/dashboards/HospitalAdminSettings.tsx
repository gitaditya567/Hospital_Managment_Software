import { useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { Button } from '../../components/ui/Button';
import { Settings, Building, ShieldCheck, Mail, Phone, MapPin, Save, Bell } from 'lucide-react';

export function HospitalAdminSettings() {
  const { hospitalName, setHospitalName, hospitalLogo, setHospitalLogo } = useHospitalStore();

  const [name, setName] = useState(hospitalName || 'City Multi-Specialty Hospital');
  const [email, setEmail] = useState('admin@cityhospital.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [address, setAddress] = useState('123 Healthcare Boulevard, Tech City, IN');
  const [logoUrl, setLogoUrl] = useState(hospitalLogo || '');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setHospitalName(name);
    if (logoUrl) {
      setHospitalLogo(logoUrl);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl font-sans">
      <div>
        <h1 className="text-2xl font-bold text-[#060606] flex items-center gap-2">
          <Settings className="text-[#3683F8]" /> Hospital Configuration &amp; Settings
        </h1>
        <p className="text-slate-500 text-sm">Manage hospital metadata, contact information, branding, and notification preferences</p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center gap-2 font-semibold animate-in fade-in">
          <ShieldCheck size={18} className="text-emerald-500" />
          <span>Hospital settings updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Metadata */}
        <div className="bg-white p-6 rounded-2xl border border-[#D8D8D8] shadow-xs space-y-4">
          <h2 className="text-lg font-semibold text-[#060606] flex items-center gap-2 border-b border-[#D8D8D8] pb-3">
            <Building size={18} className="text-[#3683F8]" /> Profile &amp; Branding
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] bg-white text-[#060606] font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom Logo URL</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] bg-white text-[#060606]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Contact Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 border border-[#D8D8D8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] bg-white text-[#060606]"
                />
                <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Helpline Phone Number</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 border border-[#D8D8D8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] bg-white text-[#060606]"
                />
                <Phone size={16} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital Facility Address</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 border border-[#D8D8D8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] bg-white text-[#060606]"
                />
                <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Notifications & System Preferences */}
        <div className="bg-white p-6 rounded-2xl border border-[#D8D8D8] shadow-xs space-y-4">
          <h2 className="text-lg font-semibold text-[#060606] flex items-center gap-2 border-b border-[#D8D8D8] pb-3">
            <Bell size={18} className="text-[#3683F8]" /> Notification Channels
          </h2>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#D8D8D8] hover:bg-[#EBF3FE]/20 cursor-pointer transition-colors">
              <div>
                <p className="text-sm font-semibold text-[#060606]">Email Notifications</p>
                <p className="text-xs text-slate-500">Send daily summaries and critical patient alert emails to admin staff</p>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-[#D8D8D8] text-[#3683F8] focus:ring-[#3683F8] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#D8D8D8] hover:bg-[#EBF3FE]/20 cursor-pointer transition-colors">
              <div>
                <p className="text-sm font-semibold text-[#060606]">SMS Gateway Alerts</p>
                <p className="text-xs text-slate-500">Send automatic appointment SMS confirmations to patients</p>
              </div>
              <input
                type="checkbox"
                checked={smsAlerts}
                onChange={(e) => setSmsAlerts(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-[#D8D8D8] text-[#3683F8] focus:ring-[#3683F8] cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="flex items-center gap-2 bg-[#3683F8] hover:bg-blue-600 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-md">
            <Save size={16} /> Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
