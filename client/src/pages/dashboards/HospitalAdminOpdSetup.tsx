import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings2, IndianRupee, Stethoscope, Save, CheckCircle2, UserPlus, DoorOpen } from 'lucide-react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { StaffMember } from '../../store/useHospitalStore';
import { doctorTitle } from '../../lib/utils';
import { ToastStack, useToasts } from './reception/receptionShared';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = Array.from({ length: 34 }, (_, i) => {
  const mins = 6 * 60 + i * 30; // 06:00 AM … 10:30 PM
  const h24 = Math.floor(mins / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
});

interface RowState { roomNumber: string; startTime: string; endTime: string; days: string[]; consultationFee: string; dirty: boolean; saving: boolean }

// Reads "Mon, Wed, Fri" / "Mon - Sat" / "Mon - Sun" into day chips
const parseDays = (text?: string) => {
  const t = (text || '').toLowerCase();
  if (!t) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (/mon\s*-\s*sun|daily|all/.test(t)) return [...DAYS];
  if (/mon\s*-\s*sat/.test(t)) return DAYS.slice(0, 6);
  if (/mon\s*-\s*fri/.test(t)) return DAYS.slice(0, 5);
  return DAYS.filter(d => t.includes(d.toLowerCase()));
};

export function HospitalAdminOpdSetup() {
  const { staff, schedules, fees, updateFees, saveDoctorSetup } = useHospitalStore();
  const { toasts, push, dismiss } = useToasts();
  const doctors = staff.filter(s => s.role === 'Doctor');

  // ───────── Hospital fees ─────────
  const [opd, setOpd] = useState('');
  const [emergency, setEmergency] = useState('');
  const [bed, setBed] = useState('');
  const [savingFees, setSavingFees] = useState(false);
  useEffect(() => {
    setOpd(String(fees?.opdFee ?? ''));
    setEmergency(String(fees?.emergencyFee ?? ''));
    setBed(String(fees?.bedChargePerDay ?? ''));
  }, [fees?.opdFee, fees?.emergencyFee, fees?.bedChargePerDay]);

  const saveFees = async () => {
    setSavingFees(true);
    try {
      await updateFees({ opdFee: Number(opd), emergencyFee: Number(emergency), bedChargePerDay: Number(bed) });
      push('success', 'Fees saved. Reception will use them for new registrations.');
    } catch (err: any) {
      push('error', err?.message || 'Could not save the fees.');
    } finally {
      setSavingFees(false);
    }
  };

  // ───────── Doctor schedules ─────────
  const [rows, setRows] = useState<Record<string, RowState>>({});
  useEffect(() => {
    setRows(prev => {
      const next: Record<string, RowState> = {};
      doctors.forEach(d => {
        if (prev[d.id]?.dirty) { next[d.id] = prev[d.id]; return; }
        const sch = schedules.find(s => s.doctorId === d.id || s.doctorName === d.name);
        const times = (sch?.availability || '').match(/\d{1,2}:\d{2}\s?(AM|PM)/gi) || [];
        const norm = (t?: string) => (t ? t.toUpperCase().replace(/^(\d):/, '0$1:').replace(/(\d)(AM|PM)$/, '$1 $2') : '');
        next[d.id] = {
          roomNumber: sch?.roomNumber && sch.roomNumber !== '—' ? sch.roomNumber : '',
          startTime: norm(times[0]) || '09:00 AM',
          endTime: norm(times[1]) || '02:00 PM',
          days: parseDays(sch?.days),
          consultationFee: d.consultationFee !== undefined ? String(d.consultationFee) : '',
          dirty: false,
          saving: false
        };
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, schedules]);

  const edit = (id: string, patch: Partial<RowState>) => setRows(r => ({ ...r, [id]: { ...r[id], ...patch, dirty: true } }));

  const saveRow = async (d: StaffMember) => {
    const row = rows[d.id];
    if (!row) return;
    setRows(r => ({ ...r, [d.id]: { ...row, saving: true } }));
    try {
      await saveDoctorSetup(d, {
        roomNumber: row.roomNumber,
        startTime: row.startTime,
        endTime: row.endTime,
        days: row.days,
        ...(row.consultationFee !== '' ? { consultationFee: Math.max(0, Number(row.consultationFee) || 0) } : {})
      });
      setRows(r => ({ ...r, [d.id]: { ...r[d.id], dirty: false, saving: false } }));
      push('success', `${doctorTitle(d.name)} saved.`);
    } catch (err: any) {
      setRows(r => ({ ...r, [d.id]: { ...r[d.id], saving: false } }));
      push('error', err?.message || 'Could not save.');
    }
  };

  const configured = doctors.filter(d => schedules.some(s => (s.doctorId === d.id || s.doctorName === d.name) && s.roomNumber && s.roomNumber !== '—')).length;
  const inputCls = 'h-10 rounded-xl border border-[#D8D8D8] px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]';

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><Settings2 size={22} /> OPD setup</h1>
        <p className="text-blue-50 text-xs font-semibold mt-1">Fees charged at the front desk, and each doctor's room, OPD hours and days. Reception, token slips and appointment slots use these.</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#D8D8D8] p-5 space-y-4">
        <h2 className="text-base font-extrabold flex items-center gap-2"><IndianRupee size={18} className="text-[#3683F8]" /> Hospital fees</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { id: 'fee-opd', label: 'OPD consultation (₹)', value: opd, set: setOpd, hint: 'Default fee at registration. 0 = free OPD.' },
            { id: 'fee-emergency', label: 'Emergency consultation (₹)', value: emergency, set: setEmergency, hint: 'Offered as a one-click option at the desk.' },
            { id: 'fee-bed', label: 'Bed charge per day (₹)', value: bed, set: setBed, hint: 'For admitted patients.' }
          ].map(f => (
            <label key={f.id} htmlFor={f.id} className="space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{f.label}</span>
              <input id={f.id} type="number" min={0} value={f.value} onChange={e => f.set(e.target.value)} className={`${inputCls} w-full font-mono`} />
              <span className="block text-[11px] text-slate-400">{f.hint}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={saveFees} disabled={savingFees} className="h-10 px-5 rounded-xl bg-[#3683F8] hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2">
            <Save size={16} /> {savingFees ? 'Saving…' : 'Save fees'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
        <div className="p-5 border-b border-[#D8D8D8] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold flex items-center gap-2"><Stethoscope size={18} className="text-[#3683F8]" /> Doctor rooms & OPD hours</h2>
            <p className="text-xs text-slate-500 font-semibold">{configured} of {doctors.length} doctors have a room set.</p>
          </div>
          <Link to="/hospital-admin/staff" className="text-xs font-bold text-[#3683F8] inline-flex items-center gap-1"><UserPlus size={14} /> Add a doctor</Link>
        </div>
        {doctors.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-slate-400">No doctors yet. Add doctors in Staff Management first.</p>
        ) : (
          <div className="divide-y divide-[#D8D8D8]/70">
            {doctors.map(d => {
              const row = rows[d.id];
              if (!row) return null;
              return (
                <div key={d.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold">{doctorTitle(d.name)}</div>
                      <div className="text-xs text-slate-500 font-semibold">{d.department || 'General'} · {d.status === 'Active' ? 'Available' : d.status === 'On Leave' ? 'On break' : 'Inactive'}</div>
                    </div>
                    {!row.dirty && row.roomNumber && <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={13} /> Saved</span>}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    <label className="space-y-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Room</span>
                      <div className="relative">
                        <DoorOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input aria-label={`Room for ${d.name}`} value={row.roomNumber} onChange={e => edit(d.id, { roomNumber: e.target.value })} placeholder="e.g. 101" className={`${inputCls} w-full pl-8`} />
                      </div>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">From</span>
                      <select aria-label={`OPD start for ${d.name}`} value={row.startTime} onChange={e => edit(d.id, { startTime: e.target.value })} className={`${inputCls} w-full`}>
                        {!TIMES.includes(row.startTime) && <option>{row.startTime}</option>}
                        {TIMES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">To</span>
                      <select aria-label={`OPD end for ${d.name}`} value={row.endTime} onChange={e => edit(d.id, { endTime: e.target.value })} className={`${inputCls} w-full`}>
                        {!TIMES.includes(row.endTime) && <option>{row.endTime}</option>}
                        {TIMES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Doctor's fee (₹)</span>
                      <input aria-label={`Fee for ${d.name}`} type="number" min={0} value={row.consultationFee} onChange={e => edit(d.id, { consultationFee: e.target.value })} placeholder={String(fees?.opdFee ?? '')} className={`${inputCls} w-full font-mono`} />
                    </label>
                    <button type="button" onClick={() => saveRow(d)} disabled={row.saving || !row.dirty} className="h-10 rounded-xl bg-[#060606] hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5">
                      <Save size={15} /> {row.saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">OPD days</span>
                    {DAYS.map(day => {
                      const on = row.days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={on}
                          aria-label={`${d.name} ${day}`}
                          onClick={() => edit(d.id, { days: on ? row.days.filter(x => x !== day) : [...row.days, day] })}
                          className={`h-8 w-11 rounded-lg border text-xs font-bold ${on ? 'bg-[#3683F8] border-[#3683F8] text-white' : 'bg-white border-[#D8D8D8] text-slate-500'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
