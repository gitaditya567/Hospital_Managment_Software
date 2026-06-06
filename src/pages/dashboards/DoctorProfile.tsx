import { useState, useEffect } from 'react';
import { Stethoscope, CheckCircle, AlertCircle, Loader2, User, Award, FileText, ShieldCheck, Phone } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';

export function DoctorProfile() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [contact, setContact] = useState('');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (!user?.email || !user?.hospitalId) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/hospital/staff/profile/details?email=${user.email}&hospitalId=${user.hospitalId}`);
        if (!res.ok) {
          throw new Error('Failed to load profile data');
        }
        const data = await res.json();
        setFullName(data.name || '');
        setSpecialization(data.department || '');
        setLicenseNo(data.licenseNo || '');
        setContact(data.contact || '');
        setSignature(data.signature || '');
      } catch (err: any) {
        console.error(err);
        setErrorMsg('Error loading profile from active clinical nodes.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !user?.hospitalId) return;

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/hospital/staff/profile/details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          hospitalId: user.hospitalId,
          name: fullName,
          department: specialization,
          licenseNo,
          contact,
          signature
        })
      });

      if (!res.ok) {
        throw new Error('Failed to save profile changes');
      }

      setSuccessMsg('Operational profile parameters updated successfully!');

      // Update global user name if it changed
      if (user) {
        const userJson = localStorage.getItem('medisaas_user');
        if (userJson) {
          const userObj = JSON.parse(userJson);
          userObj.name = fullName;
          localStorage.setItem('medisaas_user', JSON.stringify(userObj));
        }
        // Force sync Zustand store
        useAuthStore.setState({
          user: {
            ...user,
            name: fullName
          }
        });
      }

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center bg-slate-50/50 rounded-3xl border border-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600">✚</div>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Syncing Doctor Node...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans pb-16">
      {/* Decorative top header accent line */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-600 to-violet-500 rounded-full"></div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider mb-2 font-mono">
            <ShieldCheck size={12} /> Secure Clinical Registry
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            My Professional Profile
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage your credentials, specialization departments, registration numbers, and digital prescription signatures.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Profile Settings Form Column (Spans 2) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm relative overflow-hidden space-y-6">
          {/* Subtle Ambient Accent */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none"></div>

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top duration-300 shadow-sm">
              <CheckCircle className="text-emerald-600 shrink-0" size={16} />
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-300 shadow-sm">
              <AlertCircle className="text-rose-600 shrink-0" size={16} />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User size={18} className="text-blue-500" /> Basic & Department Credentials
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Sarah Smith"
                    className="block w-full pl-10 pr-3 h-11 rounded-xl text-sm bg-slate-55 border border-slate-200 placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Specialization */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Specialization / Department</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Stethoscope size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={specialization}
                    onChange={e => setSpecialization(e.target.value)}
                    placeholder="e.g. Cardiology"
                    className="block w-full pl-10 pr-3 h-11 rounded-xl text-sm bg-slate-55 border border-slate-200 placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 pt-2">
              <Award size={18} className="text-indigo-500" /> Regulatory & Contact Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* License Number */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">License / Registration No.</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Award size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={licenseNo}
                    onChange={e => setLicenseNo(e.target.value)}
                    placeholder="e.g. MED-892749"
                    className="block w-full pl-10 pr-3 h-11 rounded-xl text-sm bg-slate-55 border border-slate-200 placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono font-bold"
                  />
                </div>
              </div>

              {/* Contact Number */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={contact}
                    onChange={e => setContact(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    placeholder="10-digit mobile"
                    className="block w-full pl-10 pr-3 h-11 rounded-xl text-sm bg-slate-55 border border-slate-200 placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 pt-2">
              <FileText size={18} className="text-violet-500" /> Digital Prescription Signature
            </h2>

            {/* Signature Area */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Signature Format (Text Block)</label>
              <textarea
                required
                value={signature}
                onChange={e => setSignature(e.target.value)}
                placeholder="e.g. Dr. Sarah Smith, MD Cardiology&#10;City General Hospital"
                className="w-full h-24 p-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none resize-none text-sm font-sans placeholder-slate-400 text-slate-700 leading-relaxed transition-all"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                This digital signature block will be automatically formatted and stamped onto all outgoing PDF prescription sheets generated under your consult.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                🔒 HIPAA Compliant Cryptography Node
              </span>
              <Button
                type="submit"
                disabled={saving}
                className="shadow-xl shadow-blue-500/10 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-full px-6 py-2.5 h-11 flex items-center justify-center gap-1.5 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Profile Details ✓'
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Doctor Card Column (Identity Badge Preview) */}
        <div className="space-y-6">
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1 font-mono">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span> Identity Card Preview
          </div>

          <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[380px] group transition-all duration-300 hover:shadow-md hover:border-slate-300">
            {/* Top Accent Gradient Header Banner */}
            <div className="h-20 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100 flex items-center justify-between px-6 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-[20px]"></div>

              <div className="flex items-center gap-2 z-10">
                <span className="text-blue-600 font-black text-xs">✚</span>
                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">MediSaaS ID</span>
              </div>
              <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider z-10">
                Verified Node 🟢
              </span>
            </div>

            {/* Profile Avatar & Details */}
            <div className="px-6 py-6 space-y-4 flex-1">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-500 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                  <Stethoscope size={28} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-850 truncate group-hover:text-blue-600 transition-colors">
                    {fullName || 'Dr. Doctor Name'}
                  </h2>
                  <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider font-mono">
                    {specialization || 'Clinical Specialist'}
                  </p>
                </div>
              </div>

              {/* Card Meta Infos */}
              <div className="bg-slate-50/80 border border-slate-100/65 rounded-2xl p-4 space-y-2.5 text-xs text-slate-600 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] font-mono">License Number</span>
                  <span className="font-mono font-bold text-slate-700 truncate max-w-[150px]">{licenseNo || 'Pending'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] font-mono">Contact Phone</span>
                  <span className="font-mono text-slate-700">{contact ? `+91 ${contact.slice(0, 5)} ${contact.slice(5)}` : 'Pending'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] font-mono">System Role</span>
                  <span className="font-mono text-slate-700 uppercase font-bold text-[10px]">Clinician</span>
                </div>
              </div>
            </div>

            {/* Card Footer - Certified Digital Signature Stamp */}
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/30 space-y-1.5">
              <div className="text-[8px] text-slate-400 uppercase tracking-widest font-extrabold font-mono">Prescription Signature Stamp</div>
              <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col justify-center min-h-[50px] text-[10px] leading-relaxed relative">
                <span className="absolute top-1.5 right-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1 text-[7px] font-extrabold uppercase tracking-widest scale-90 select-none">
                  Verified ✓
                </span>
                <div className="italic text-slate-500 line-clamp-2 pr-12">
                  {signature ? signature.split('\n').join(' • ') : 'No digital signature configured.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
