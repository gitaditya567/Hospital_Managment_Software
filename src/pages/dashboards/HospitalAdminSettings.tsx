import { useEffect, useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { Settings, Building, ShieldCheck, Mail, Phone, MapPin, Save, KeyRound, AlertTriangle } from 'lucide-react';

export function HospitalAdminSettings() {
  const { hospitalName, hospitalLogo, profileDetails, saveHospitalProfile } = useHospitalStore();
  const { user } = useAuthStore();

  const [name, setName] = useState(hospitalName || '');
  const [phone, setPhone] = useState(profileDetails.adminPhone);
  const [address, setAddress] = useState(profileDetails.address);
  const [logoUrl, setLogoUrl] = useState(hospitalLogo || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fill the form once the hospital profile arrives from the server
  useEffect(() => {
    setName(hospitalName || '');
    setPhone(profileDetails.adminPhone);
    setAddress(profileDetails.address);
    setLogoUrl(hospitalLogo || '');
  }, [hospitalName, hospitalLogo, profileDetails.adminPhone, profileDetails.address]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    const result = await saveHospitalProfile({ hospitalName: name.trim(), adminPhone: phone.trim(), address: address.trim(), hospitalLogo: logoUrl.trim() });
    setSaving(false);
    if (!result.success) {
      setSaveError(result.error || 'Failed to save settings.');
      return;
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordStatus({ type: 'error', message: data.message || 'Failed to change password.' });
        return;
      }
      setPasswordStatus({ type: 'success', message: 'Password updated. Use the new password next time you sign in.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordStatus({ type: 'error', message: 'Server connection error.' });
    }
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

      {saveError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2 font-semibold">
          <AlertTriangle size={18} className="text-rose-500" />
          <span>{saveError}</span>
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Login Email</label>
              <div className="relative">
                <input
                  type="email"
                  readOnly
                  value={profileDetails.adminEmail || user?.email || ''}
                  title="This is your sign-in email and cannot be changed here"
                  className="w-full h-10 pl-9 pr-3 border border-[#D8D8D8] rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
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

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#3683F8] hover:bg-blue-600 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-md disabled:opacity-60">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {/* Change Password */}
      <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-2xl border border-[#D8D8D8] shadow-xs space-y-4">
        <h2 className="text-lg font-semibold text-[#060606] flex items-center gap-2 border-b border-[#D8D8D8] pb-3">
          <KeyRound size={18} className="text-[#3683F8]" /> Change Password
        </h2>

        {passwordStatus && (
          <div className={`p-3 rounded-xl text-sm font-semibold border ${passwordStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
            {passwordStatus.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Current Password', value: currentPassword, set: setCurrentPassword, auto: 'current-password' },
            { label: 'New Password', value: newPassword, set: setNewPassword, auto: 'new-password' },
            { label: 'Confirm New Password', value: confirmPassword, set: setConfirmPassword, auto: 'new-password' }
          ].map(field => (
            <div key={field.label} className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{field.label}</label>
              <input
                type="password"
                required
                autoComplete={field.auto}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] bg-white text-[#060606]"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="flex items-center gap-2 bg-[#060606] hover:bg-slate-800 text-white font-bold text-xs h-10 px-6 rounded-xl">
            <KeyRound size={16} /> Update Password
          </Button>
        </div>
      </form>
    </div>
  );
}
