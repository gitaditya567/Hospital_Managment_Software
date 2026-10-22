import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Rocket, ArrowRight } from 'lucide-react';
import { useHospitalStore } from '../../../store/useHospitalStore';
import { usePharmacyStore } from '../../../store/usePharmacyStore';

// Getting-started steps for a new hospital, worked out from real data; hidden once everything is done
export function SetupChecklist() {
  const { staff, schedules, fees, patients, hospitalLogo } = useHospitalStore();
  const { inventory } = usePharmacyStore();
  const doctors = staff.filter(s => s.role === 'Doctor');

  const steps = [
    { done: doctors.length > 0, label: 'Add your first doctor', to: '/hospital-admin/staff' },
    { done: staff.some(s => s.role === 'Receptionist'), label: 'Add a receptionist login', to: '/hospital-admin/staff' },
    { done: fees !== undefined && (fees.opdFee !== 500 || fees.emergencyFee !== 1200), label: 'Set your OPD and emergency fees', to: '/hospital-admin/opd-setup' },
    { done: doctors.length > 0 && doctors.every(d => schedules.some(s => (s.doctorId === d.id || s.doctorName === d.name) && s.roomNumber && s.roomNumber !== '—')), label: "Set each doctor's room and OPD hours", to: '/hospital-admin/opd-setup' },
    { done: staff.some(s => s.role === 'Pharmacy'), label: 'Add a pharmacist login', to: '/hospital-admin/staff' },
    { done: inventory.length > 0, label: 'Pharmacist adds medicines to stock', to: '/hospital-admin/staff' },
    { done: !!hospitalLogo, label: 'Upload your hospital logo', to: '/hospital-admin/settings' },
    { done: patients.length > 0, label: 'Register the first patient at the front desk', to: '/hospital-admin/appointments' }
  ];
  const done = steps.filter(s => s.done).length;
  if (done === steps.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-blue-200 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-extrabold flex items-center gap-2"><Rocket size={18} className="text-[#3683F8]" /> Get your hospital ready</h2>
          <p className="text-xs text-slate-500 font-semibold">{done} of {steps.length} steps done</p>
        </div>
        <div className="h-2 w-full sm:w-48 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Setup progress">
          <div className="h-full rounded-full bg-[#3683F8]" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {steps.map(s => (
          <Link key={s.label} to={s.to} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${s.done ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800' : 'border-[#D8D8D8] hover:border-[#3683F8] text-slate-700'}`}>
            <span className="flex items-center gap-2">{s.done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-300" />} {s.label}</span>
            {!s.done && <ArrowRight size={15} className="text-[#3683F8] shrink-0" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
