import { useMemo, useState } from 'react';
import { BarChart3, IndianRupee, Stethoscope, Pill, Clock, Users, UserPlus, Banknote, Smartphone, CreditCard, HelpCircle, Download } from 'lucide-react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import { doctorTitle } from '../../lib/utils';
import { BarList, RangePicker, TrendChart, buildTransactions, dailySeries, downloadCsv, inRange, money, type RangeKey } from './admin/adminReports';

const sameName = (a?: string, b?: string) => {
  const n = (s?: string) => String(s || '').toLowerCase().replace(/^\s*dr(\.\s*|\s+)/, '').replace(/\s+/g, ' ').trim();
  return n(a) === n(b);
};

export function HospitalAdminAnalytics() {
  const { staff, patients, invoices, hospitalName } = useHospitalStore();
  const { bills, prescriptions } = usePharmacyStore();
  const [range, setRange] = useState<RangeKey>('30');

  const txns = useMemo(() => buildTransactions(invoices, bills, patients), [invoices, bills, patients]);
  const inR = useMemo(() => txns.filter(t => inRange(t.date, range)), [txns, range]);
  const visits = useMemo(() => patients.filter(p => inRange(p.createdAt ? new Date(p.createdAt) : null, range)), [patients, range]);

  const opdPaid = inR.filter(t => t.kind === 'OPD' && t.status === 'Paid').reduce((s, t) => s + t.amount, 0);
  const pharmacy = inR.filter(t => t.kind === 'Pharmacy').reduce((s, t) => s + t.amount, 0);
  const dues = inR.filter(t => t.status === 'Pending').reduce((s, t) => s + t.amount, 0);
  const collected = opdPaid + pharmacy;

  // A visit is "new" when it is the person's first visit ever
  const firstVisit = useMemo(() => {
    const first = new Map<string, number>();
    patients.forEach(p => {
      const key = p.patientNo || `${p.phone}:${p.name.toLowerCase()}`;
      const t = new Date(p.createdAt || 0).getTime();
      if (!first.has(key) || t < first.get(key)!) first.set(key, t);
    });
    return first;
  }, [patients]);
  const newPatients = visits.filter(p => firstVisit.get(p.patientNo || `${p.phone}:${p.name.toLowerCase()}`) === new Date(p.createdAt || 0).getTime()).length;

  const trend = useMemo(() => dailySeries(txns, range), [txns, range]);

  // Revenue by department (OPD fees by the doctor's department) + pharmacy as its own line
  const departments = useMemo(() => {
    const totals = new Map<string, number>();
    inR.filter(t => t.kind === 'OPD' && t.status === 'Paid').forEach(t => {
      const doc = staff.find(s => s.role === 'Doctor' && sameName(s.name, t.doctorName));
      const dept = doc?.department || 'Unassigned';
      totals.set(dept, (totals.get(dept) || 0) + t.amount);
    });
    if (pharmacy > 0) totals.set('Pharmacy', pharmacy);
    return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [inR, staff, pharmacy]);

  const doctors = useMemo(() => staff.filter(s => s.role === 'Doctor').map(d => {
    const v = visits.filter(p => sameName(p.doctorName, d.name));
    const fee = inR.filter(t => t.kind === 'OPD' && t.status === 'Paid' && sameName(t.doctorName, d.name)).reduce((s, t) => s + t.amount, 0);
    const rxCodes = new Set(v.map(p => p.rxCode).filter(Boolean));
    const rxSales = inR.filter(t => t.kind === 'Pharmacy' && sameName(t.doctorName, d.name)).reduce((s, t) => s + t.amount, 0);
    return {
      id: d.id, name: d.name, department: d.department || '—',
      visits: v.length, completed: v.filter(p => p.status === 'Completed').length,
      fee, rx: rxCodes.size || prescriptions.filter(r => sameName(r.doctorName, d.name) && inRange(r.createdAt ? new Date(r.createdAt) : null, range)).length,
      rxSales
    };
  }).sort((a, b) => b.fee + b.rxSales - (a.fee + a.rxSales)), [staff, visits, inR, prescriptions, range]);

  const modes = ['Cash', 'UPI', 'Card', 'Not recorded'].map(mode => ({
    mode,
    amount: inR.filter(t => t.status === 'Paid' && t.paymentMode === mode).reduce((s, t) => s + t.amount, 0)
  }));
  const modeIcon: Record<string, typeof Banknote> = { Cash: Banknote, UPI: Smartphone, Card: CreditCard, 'Not recorded': HelpCircle };

  const exportDoctors = () => downloadCsv(
    `doctor-report-${range}.csv`,
    ['Doctor', 'Department', 'Visits', 'Completed', 'OPD fees collected', 'Prescriptions', 'Pharmacy sales from Rx'],
    doctors.map(d => [d.name, d.department, d.visits, d.completed, d.fee, d.rx, d.rxSales])
  );

  const empty = txns.length === 0 && patients.length === 0;

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><BarChart3 size={22} /> Reports</h1>
          <p className="text-blue-50 text-xs font-semibold mt-1">Collections, patients and doctor performance for {hospitalName}.</p>
        </div>
        <div className="bg-white rounded-xl p-1.5"><RangePicker value={range} onChange={setRange} /></div>
      </div>

      {empty ? (
        <div className="bg-white rounded-2xl border border-[#D8D8D8] p-10 text-center">
          <BarChart3 size={40} className="mx-auto text-slate-200" />
          <p className="text-sm font-bold text-slate-500 mt-3">No data yet. Reports fill in as soon as reception registers patients and the pharmacy makes sales.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { label: 'Collected', value: money(collected), icon: IndianRupee, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { label: 'OPD fees', value: money(opdPaid), icon: Stethoscope, tone: 'text-[#3683F8] bg-[#EBF3FE] border-blue-200' },
              { label: 'Pharmacy sales', value: money(pharmacy), icon: Pill, tone: 'text-orange-600 bg-orange-50 border-orange-200' },
              { label: 'Fees due', value: money(dues), icon: Clock, tone: 'text-rose-600 bg-rose-50 border-rose-200' },
              { label: 'Patient visits', value: visits.length, icon: Users, tone: 'text-slate-600 bg-slate-50 border-slate-200' },
              { label: 'New patients', value: newPatients, icon: UserPlus, tone: 'text-violet-600 bg-violet-50 border-violet-200' }
            ].map(k => (
              <div key={k.label} className="bg-white p-4 rounded-2xl border border-[#D8D8D8] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{k.label}</p>
                  <p className="text-xl font-extrabold tracking-tight">{k.value}</p>
                </div>
                <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${k.tone}`}><k.icon size={17} /></div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-[#D8D8D8] p-5">
              <h2 className="text-base font-extrabold">Daily collections</h2>
              <p className="text-xs text-slate-500 font-semibold mb-4">Money received each day{range === 'all' ? ' (last 30 days shown)' : ''}. Unpaid dues are not included.</p>
              <TrendChart data={trend} />
            </div>
            <div className="lg:col-span-4 bg-white rounded-2xl border border-[#D8D8D8] p-5">
              <h2 className="text-base font-extrabold">By department</h2>
              <p className="text-xs text-slate-500 font-semibold mb-4">OPD fees by the doctor's department, and pharmacy sales.</p>
              <BarList rows={departments} emptyText="No collections in this period." />
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
              <div className="p-5 border-b border-[#D8D8D8] flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">Doctors</h2>
                  <p className="text-xs text-slate-500 font-semibold">Visits, fees and pharmacy sales from each doctor's prescriptions.</p>
                </div>
                <button type="button" onClick={exportDoctors} className="h-9 px-3 rounded-xl border border-[#D8D8D8] text-xs font-bold inline-flex items-center gap-1.5"><Download size={14} /> CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EBF3FE]/60 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                    <tr><th className="px-4 py-3">Doctor</th><th className="px-4 py-3 text-right">Visits</th><th className="px-4 py-3 text-right">Completed</th><th className="px-4 py-3 text-right">OPD fees</th><th className="px-4 py-3 text-right">Rx</th><th className="px-4 py-3 text-right">Pharmacy from Rx</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8D8D8]/60">
                    {doctors.map(d => (
                      <tr key={d.id}>
                        <td className="px-4 py-3"><div className="font-extrabold text-sm">{doctorTitle(d.name)}</div><div className="text-[11px] text-slate-500">{d.department}</div></td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{d.visits}</td>
                        <td className="px-4 py-3 text-right font-mono">{d.completed}</td>
                        <td className="px-4 py-3 text-right font-bold">{money(d.fee)}</td>
                        <td className="px-4 py-3 text-right font-mono">{d.rx}</td>
                        <td className="px-4 py-3 text-right font-bold">{money(d.rxSales)}</td>
                      </tr>
                    ))}
                    {doctors.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm font-bold text-slate-400">No doctors yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="lg:col-span-4 bg-white rounded-2xl border border-[#D8D8D8] p-5">
              <h2 className="text-base font-extrabold mb-1">Payment modes</h2>
              <p className="text-xs text-slate-500 font-semibold mb-4">How collected money was received.</p>
              <div className="space-y-2">
                {modes.filter(m => m.mode !== 'Not recorded' || m.amount > 0).map(m => {
                  const Icon = modeIcon[m.mode];
                  return (
                    <div key={m.mode} className="flex items-center justify-between rounded-xl border border-[#D8D8D8] px-3 py-2.5">
                      <span className="text-sm font-bold inline-flex items-center gap-2"><Icon size={16} className="text-slate-500" /> {m.mode}</span>
                      <span className="text-sm font-extrabold">{money(m.amount)}</span>
                    </div>
                  );
                })}
              </div>
              {modes[3].amount > 0 && <p className="text-[11px] text-slate-400 mt-3">"Not recorded" is for fees collected before payment modes were tracked.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
