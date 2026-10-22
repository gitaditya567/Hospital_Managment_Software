import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Search, Download, Users, CheckCircle2, Clock, IndianRupee, AlertTriangle, CalendarClock } from 'lucide-react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { PatientRecord } from '../../store/useHospitalStore';
import { doctorTitle } from '../../lib/utils';
import { downloadCsv, money } from './admin/adminReports';

const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function HospitalAdminAppointments() {
  const { patients, invoices, staff, appointments, fetchAppointments } = useHospitalStore();
  const [date, setDate] = useState(toYMD(new Date()));
  const [status, setStatus] = useState<'All' | PatientRecord['status'] | 'Unpaid'>('All');
  const [doctor, setDoctor] = useState('All');
  const [query, setQuery] = useState('');

  useEffect(() => { fetchAppointments(date, date); }, [date, fetchAppointments]);

  const doctors = staff.filter(s => s.role === 'Doctor');
  const dayVisits = useMemo(() => patients
    .filter(p => p.createdAt && toYMD(new Date(p.createdAt)) === date)
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()), [patients, date]);

  const invoiceFor = (p: PatientRecord) => invoices.find(i => i.patientId === p.id) || invoices.find(i => !i.patientId && i.patientPhone === p.phone && i.patientName === p.name);
  const unpaid = (p: PatientRecord) => p.paymentStatus === 'Unpaid' || p.paymentStatus === 'Pending';

  const q = query.trim().toLowerCase();
  const rows = dayVisits.filter(p =>
    (doctor === 'All' || p.doctorName === doctor) &&
    (status === 'All' || (status === 'Unpaid' ? unpaid(p) : p.status === status)) &&
    (!q || [p.name, p.phone, p.patientNo, p.tokenNumber, p.diagnosis].some(v => (v || '').toLowerCase().includes(q)))
  );

  const collected = dayVisits.reduce((s, p) => { const i = invoiceFor(p); return s + (i && i.status === 'Paid' ? i.amount : 0); }, 0);
  const due = dayVisits.reduce((s, p) => { const i = invoiceFor(p); return s + (i && i.status === 'Pending' ? i.amount : 0); }, 0);
  const booked = appointments.filter(a => a.date === date);

  const exportCsv = () => downloadCsv(`opd-register-${date}.csv`,
    ['Token', 'Time', 'Patient', 'Patient no', 'Age', 'Gender', 'Phone', 'Doctor', 'Status', 'Fee', 'Payment', 'Diagnosis', 'Rx'],
    rows.map(p => {
      const i = invoiceFor(p);
      return [p.tokenNumber, p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '', p.name, p.patientNo || '', p.age, p.gender || '', p.phone, p.doctorName, p.status,
        i?.amount ?? '', i ? (i.status === 'Paid' ? `Paid ${i.paymentMode || ''}`.trim() : 'Due') : '', p.diagnosis || '', p.rxCode || ''];
    }));

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><ClipboardList size={22} /> OPD register</h1>
          <p className="text-blue-50 text-xs font-semibold mt-1">Every OPD visit of the day with fee, status, diagnosis and prescription.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" aria-label="Register date" value={date} max={toYMD(new Date())} onChange={e => e.target.value && setDate(e.target.value)} className="h-11 px-3 rounded-xl text-sm font-bold text-[#060606]" />
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="h-11 px-4 rounded-xl bg-white text-[#3683F8] font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60"><Download size={16} /> CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Visits', value: dayVisits.length, icon: Users },
          { label: 'Completed', value: dayVisits.filter(p => p.status === 'Completed').length, icon: CheckCircle2 },
          { label: 'Waiting / with doctor', value: dayVisits.filter(p => p.status !== 'Completed').length, icon: Clock },
          { label: 'Collected', value: money(collected), icon: IndianRupee },
          { label: 'Fees due', value: money(due), icon: AlertTriangle },
          { label: 'Appointments booked', value: booked.filter(a => a.status !== 'Cancelled').length, icon: CalendarClock }
        ].map(k => (
          <div key={k.label} className="bg-white p-4 rounded-2xl border border-[#D8D8D8] flex items-center justify-between gap-2">
            <div className="min-w-0"><p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{k.label}</p><p className="text-xl font-extrabold">{k.value}</p></div>
            <k.icon size={18} className="text-[#3683F8] shrink-0" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
        <div className="p-4 border-b border-[#D8D8D8] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(['All', 'Waiting', 'In Consultation', 'Completed', 'Unpaid'] as const).map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`h-8 px-3 rounded-lg text-xs font-bold border ${status === s ? 'bg-[#060606] border-[#060606] text-white' : 'bg-white border-[#D8D8D8] text-slate-600'}`}>{s === 'In Consultation' ? 'With doctor' : s === 'Unpaid' ? 'Fee due' : s}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Doctor" value={doctor} onChange={e => setDoctor(e.target.value)} className="h-9 px-2 rounded-lg border border-[#D8D8D8] text-xs font-bold bg-white">
              <option value="All">All doctors</option>
              {doctors.map(d => <option key={d.id} value={d.name}>{doctorTitle(d.name)}</option>)}
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, phone, token, diagnosis" className="h-9 w-56 pl-8 pr-3 rounded-xl border border-[#D8D8D8] text-xs font-semibold focus:outline-none focus:border-[#3683F8]" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#EBF3FE]/60 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
              <tr><th className="px-4 py-3">Token</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Doctor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Fee</th><th className="px-4 py-3">Diagnosis</th><th className="px-4 py-3">Rx</th></tr>
            </thead>
            <tbody className="divide-y divide-[#D8D8D8]/60">
              {rows.map(p => {
                const inv = invoiceFor(p);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded-lg bg-[#060606] text-white font-mono font-bold text-[11px] whitespace-nowrap">{p.tokenNumber}</span><div className="text-[10px] text-slate-400 mt-1">{p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</div></td>
                    <td className="px-4 py-3"><div className="font-extrabold text-sm">{p.name}</div><div className="text-[11px] text-slate-500">{p.patientNo} · {p.age}{(p.gender || 'M')[0]} · {p.phone}</div></td>
                    <td className="px-4 py-3 font-semibold">{doctorTitle(p.doctorName)}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap ${p.status === 'Completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : p.status === 'In Consultation' ? 'bg-[#EBF3FE] border-blue-200 text-[#3683F8]' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{p.status === 'In Consultation' ? 'With doctor' : p.status}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">{inv ? <span className={`font-bold ${inv.status === 'Paid' ? 'text-emerald-700' : 'text-rose-600'}`}>{money(inv.amount)} · {inv.status === 'Paid' ? (inv.paymentMode || 'Paid') : 'Due'}</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 font-semibold">{p.diagnosis || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 font-mono font-bold">{p.rxCode || <span className="text-slate-400 font-sans">—</span>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm font-bold text-slate-400">No visits for this day.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {booked.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4">
          <h2 className="text-sm font-extrabold mb-3 flex items-center gap-2"><CalendarClock size={16} className="text-[#3683F8]" /> Appointments booked for this day ({booked.length})</h2>
          <div className="flex flex-wrap gap-2">
            {booked.map(a => (
              <div key={a.id} className="rounded-xl border border-[#D8D8D8] px-3 py-2 text-xs">
                <div className="font-black text-[#3683F8]">{a.time}</div>
                <div className="font-bold">{a.patientName}</div>
                <div className="text-slate-500">{doctorTitle(a.doctorName)} · {a.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
