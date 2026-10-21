import { useEffect, useMemo, useState } from 'react';
import { Search, Users, History, Printer, Phone, Activity, Pill, CalendarCheck, FileText } from 'lucide-react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { PatientHistory, PatientRecord } from '../../store/useHospitalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { doctorTitle } from '../../lib/utils';
import { buildPrescriptionHtml, prettyDate, printDocument } from './doctor/doctorShared';

interface Person {
  key: string;
  latest: PatientRecord;
  visits: number;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function DoctorSearch() {
  const { patients, hospitalName, hospitalLogo, profileDetails, fetchPatientHistory } = useHospitalStore();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doctorInfo, setDoctorInfo] = useState<{ name: string; department?: string; licenseNo?: string; signature?: string } | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    fetch(`/api/hospital/staff/profile/details?email=${encodeURIComponent(user.email)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setDoctorInfo({ name: d.name, department: d.department, licenseNo: d.licenseNo, signature: d.signature }))
      .catch(() => {});
  }, [user?.email]);

  // One entry per person: patient number, or phone + name for older records
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    patients.forEach(p => {
      const key = p.patientNo ? `no:${p.patientNo}` : `p:${p.phone}:${p.name.trim().toLowerCase()}`;
      const cur = map.get(key);
      if (!cur) map.set(key, { key, latest: p, visits: 1 });
      else {
        cur.visits += 1;
        if (new Date(p.createdAt || 0) > new Date(cur.latest.createdAt || 0)) cur.latest = p;
      }
    });
    return [...map.values()].sort((a, b) => new Date(b.latest.createdAt || 0).getTime() - new Date(a.latest.createdAt || 0).getTime());
  }, [patients]);

  const myName = (doctorInfo?.name || user?.name || '').toLowerCase().replace(/^\s*dr(\.\s*|\s+)/, '').trim();
  const q = query.trim().toLowerCase();
  const results = people.filter(person => {
    const p = person.latest;
    if (onlyMine && p.doctorName.toLowerCase().replace(/^\s*dr(\.\s*|\s+)/, '').trim() !== myName) return false;
    if (!q) return true;
    return [p.name, p.phone, p.patientNo, p.diagnosis].some(v => (v || '').toLowerCase().includes(q));
  });

  const open = async (person: Person) => {
    setSelected(person);
    setHistory(null);
    setError('');
    if (!person.latest.patientNo) {
      setError('This is an older record without a patient number; only the latest visit is available.');
      return;
    }
    setLoading(true);
    try {
      setHistory(await fetchPatientHistory(person.latest.patientNo));
    } catch (err: any) {
      setError(err?.message || 'Could not load history.');
    } finally {
      setLoading(false);
    }
  };

  const visits = history?.visits || (selected ? [selected.latest] : []);

  const printVisit = (v: PatientRecord) => {
    const rx = history?.prescriptions.find(r => r.patientId === v.id) || history?.prescriptions.find(r => r.code === v.rxCode);
    printDocument(buildPrescriptionHtml({
      hospitalName: hospitalName || 'Hospital',
      hospitalAddress: profileDetails?.address,
      hospitalPhone: profileDetails?.adminPhone,
      logoUrl: hospitalLogo || undefined,
      doctor: { name: v.doctorName, ...(doctorInfo && doctorInfo.name === v.doctorName ? { department: doctorInfo.department, licenseNo: doctorInfo.licenseNo, qualifications: doctorInfo.signature } : {}) },
      patient: { name: v.name, patientNo: v.patientNo, age: v.age, gender: v.gender, phone: v.phone },
      vitals: v.vitals,
      complaints: v.complaints,
      diagnosis: v.diagnosis,
      advice: v.advice,
      followUpDate: v.followUpDate,
      items: rx?.items || [],
      rxCode: rx?.code || v.rxCode,
      date: fmt(v.consultedAt || v.createdAt)
    }));
  };

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><Users size={22} /> Patient records</h1>
        <p className="text-blue-50 text-xs font-semibold mt-1">Search any patient of this hospital and see every visit, diagnosis and prescription.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-4 bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
          <div className="p-4 border-b border-[#D8D8D8] space-y-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, phone, patient no. or diagnosis" className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#D8D8D8] text-sm focus:outline-none focus:border-[#3683F8]" />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
              <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} className="rounded border-[#D8D8D8]" /> Only my patients
            </label>
            <p className="text-[11px] text-slate-400 font-semibold">{results.length} of {people.length} patients</p>
          </div>
          <div className="max-h-[65vh] overflow-y-auto divide-y divide-[#D8D8D8]/70">
            {results.slice(0, 200).map(person => {
              const p = person.latest;
              const active = selected?.key === person.key;
              return (
                <button key={person.key} type="button" onClick={() => open(person)} className={`w-full text-left p-3 ${active ? 'bg-[#EBF3FE]' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold truncate">{p.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{person.visits} visit{person.visits === 1 ? '' : 's'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold">{p.patientNo || 'No patient no.'} · {p.age}{(p.gender || 'M')[0]} · {p.phone}</div>
                  <div className="text-[11px] text-slate-400">Last: {fmt(p.createdAt)} · {doctorTitle(p.doctorName)}</div>
                </button>
              );
            })}
            {results.length === 0 && <p className="p-6 text-center text-sm font-semibold text-slate-400">No patients match.</p>}
          </div>
        </div>

        <div className="xl:col-span-8">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-[#D8D8D8] p-10 text-center">
              <History size={40} className="mx-auto text-slate-200" />
              <p className="text-sm font-bold text-slate-400 mt-3">Choose a patient to see their history.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-[#EBF3FE] text-[#3683F8] flex items-center justify-center text-lg font-black">{selected.latest.name[0]}</div>
                <div>
                  <h2 className="text-xl font-extrabold">{selected.latest.name}</h2>
                  <p className="text-xs text-slate-500 font-semibold inline-flex items-center gap-1.5 flex-wrap">
                    {selected.latest.patientNo} · {selected.latest.age} yrs · {selected.latest.gender || 'Male'} · <Phone size={11} /> {selected.latest.phone}
                  </p>
                </div>
              </div>

              {error && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold p-3">{error}</div>}
              {loading && <div className="text-sm text-slate-400 font-semibold p-4">Loading history…</div>}

              {visits.map(v => {
                const rx = history?.prescriptions.find(r => r.patientId === v.id) || history?.prescriptions.find(r => r.code === v.rxCode);
                const bill = rx ? history?.bills.find(b => b.rxCode === rx.code) : undefined;
                return (
                  <div key={v.id} className="bg-white rounded-2xl border border-[#D8D8D8] p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-500">{fmt(v.consultedAt || v.createdAt)} · {doctorTitle(v.doctorName)} · Token {v.tokenNumber}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${v.status === 'Completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{v.status}</span>
                        {v.status === 'Completed' && (
                          <button type="button" onClick={() => printVisit(v)} className="h-8 px-2.5 rounded-lg border border-[#D8D8D8] text-[11px] font-bold text-[#3683F8] inline-flex items-center gap-1"><Printer size={13} /> Print</button>
                        )}
                      </div>
                    </div>
                    <div className="text-base font-extrabold flex items-center gap-2"><FileText size={15} className="text-[#3683F8]" /> {v.diagnosis || <span className="text-slate-400 font-semibold text-sm">No diagnosis recorded</span>}</div>
                    {v.complaints && <p className="text-sm text-slate-700"><span className="font-bold text-slate-500">Complaints: </span>{v.complaints}</p>}
                    {(v.vitals || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <Activity size={13} className="text-emerald-600 mt-1" />
                        {(v.vitals || []).map(x => <span key={x.name} className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 border border-[#D8D8D8]">{x.name}: {x.value}</span>)}
                      </div>
                    )}
                    {rx && (
                      <div className="rounded-xl bg-slate-50 border border-[#D8D8D8] p-3">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                          <span className="inline-flex items-center gap-1"><Pill size={12} /> {rx.code}</span>
                          <span className={rx.status === 'DISPENSED' ? 'text-emerald-700' : 'text-amber-700'}>
                            {rx.status === 'DISPENSED' ? `Dispensed${bill ? ` · ₹${bill.total} ${bill.paymentMode}` : ''}` : 'Not yet dispensed'}
                          </span>
                        </div>
                        <ul className="text-sm space-y-0.5">
                          {rx.items.map(i => <li key={i.name}><span className="font-bold">{i.name}</span> — {i.dosage}{i.timing ? `, ${i.timing}` : ''}, {i.duration} <span className="text-slate-400">({i.qty})</span></li>)}
                        </ul>
                      </div>
                    )}
                    {v.advice && <p className="text-sm text-slate-700"><span className="font-bold text-slate-500">Advice: </span>{v.advice}</p>}
                    {v.followUpDate && <p className="text-xs font-bold text-[#3683F8] inline-flex items-center gap-1"><CalendarCheck size={13} /> Follow-up {prettyDate(v.followUpDate)}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
