import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic, MicOff, Users, Clock, CheckCircle2, Printer, Search, Trash2, Plus, PauseCircle, PlayCircle,
  Stethoscope, History, RotateCcw, CalendarCheck, ClipboardList, Pill, Coffee, ChevronRight, Activity
} from 'lucide-react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { PatientHistory, PatientRecord, RxItem } from '../../store/useHospitalStore';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { doctorTitle } from '../../lib/utils';
import { ToastStack, formatWait, isToday, isVisitUnpaid, roomFor, useNow, useToasts } from './reception/receptionShared';
import {
  COMMON_ADVICE, COMMON_DIAGNOSES, DOSAGES, DURATIONS, FOLLOW_UPS, TIMINGS, addDaysYMD, buildCatalog, buildPrescriptionHtml,
  computeQty, newRxItem, parseDictation, prettyDate, printDocument, searchCatalog, type PrescriptionPrint
} from './doctor/doctorShared';

const REFRESH_MS = 10000;
const sameDoctor = (a?: string, b?: string) => {
  const n = (s?: string) => String(s || '').toLowerCase().replace(/^\s*dr(\.\s*|\s+)/, '').replace(/\s+/g, ' ').trim();
  return !!a && !!b && n(a) === n(b);
};

interface Draft {
  complaints: string;
  diagnosis: string;
  advice: string;
  followUpDate: string;
  items: RxItem[];
}
const emptyDraft = (): Draft => ({ complaints: '', diagnosis: '', advice: '', followUpDate: '', items: [] });
const draftKey = (id: string) => `rx_draft_${id}`;
const loadDraft = (id: string): Draft => {
  try { const raw = localStorage.getItem(draftKey(id)); return raw ? { ...emptyDraft(), ...JSON.parse(raw) } : emptyDraft(); } catch { return emptyDraft(); }
};

interface DoctorProfileInfo { name: string; department?: string; licenseNo?: string; signature?: string; status?: string }

export function DoctorDashboard() {
  const { user } = useAuthStore();
  const {
    patients, schedules, hospitalName, hospitalLogo, profileDetails,
    updatePatientStatus, saveConsultation, fetchHospitalData, fetchPatientHistory
  } = useHospitalStore();
  const { inventory } = usePharmacyStore();
  const { toasts, push, dismiss } = useToasts();
  const now = useNow(30000);

  const [tab, setTab] = useState<'consult' | 'today'>('consult');
  const [profile, setProfile] = useState<DoctorProfileInfo | null>(null);
  const [onBreak, setOnBreak] = useState(false);

  // ───────── Doctor profile & availability ─────────
  useEffect(() => {
    if (!user?.email) return;
    fetch(`/api/hospital/staff/profile/details?email=${encodeURIComponent(user.email)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        setProfile({ name: d.name, department: d.department, licenseNo: d.licenseNo, signature: d.signature, status: d.status });
        setOnBreak(d.status === 'On Leave');
      })
      .catch(() => {});
  }, [user?.email]);

  const toggleBreak = async () => {
    const next = !onBreak;
    const res = await fetch('/api/hospital/staff/profile/details', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user?.email, status: next ? 'On Leave' : 'Active' })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return push('error', data.message || 'Could not change availability.');
    setOnBreak(next);
    push('success', next ? 'You are on break. Reception will not send you new patients.' : 'You are available again.');
  };

  // ───────── Live data ─────────
  const refresh = useCallback(() => {
    if (user?.hospitalId && document.visibilityState === 'visible') fetchHospitalData(user.hospitalId);
  }, [user?.hospitalId, fetchHospitalData]);
  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const doctorName = profile?.name || user?.name || '';
  const mine = useMemo(() => patients.filter(p => sameDoctor(p.doctorName, doctorName) && isToday(p.createdAt)), [patients, doctorName]);
  const inCabin = mine.find(p => p.status === 'In Consultation') || null;
  const waiting = mine
    .filter(p => p.status === 'Waiting' && !isVisitUnpaid(p))
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  const unpaidCount = mine.filter(p => p.status === 'Waiting' && isVisitUnpaid(p)).length;
  const seenToday = mine.filter(p => p.status === 'Completed').sort((a, b) => new Date(b.consultedAt || b.createdAt || 0).getTime() - new Date(a.consultedAt || a.createdAt || 0).getTime());
  const room = roomFor(schedules, { name: doctorName });

  // ───────── Calling patients ─────────
  const [calling, setCalling] = useState(false);
  const callIn = async (p: PatientRecord) => {
    if (calling) return;
    setCalling(true);
    try {
      await updatePatientStatus(p.id, 'In Consultation');
      push('success', `${p.name} (${p.tokenNumber}) called in.`);
    } catch (err: any) {
      push('error', err?.message || 'Could not call this patient.');
    } finally {
      setCalling(false);
    }
  };
  const callNext = () => { if (waiting[0]) callIn(waiting[0]); };

  const holdPatient = async () => {
    if (!inCabin) return;
    try {
      await updatePatientStatus(inCabin.id, 'Waiting');
      push('success', `${inCabin.name} sent back to the waiting room. Notes are kept as a draft.`);
    } catch (err: any) {
      push('error', err?.message || 'Could not put the patient on hold.');
    }
  };

  // ───────── Consultation draft (kept per patient, survives refresh) ─────────
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const draftOwner = useRef<string | null>(null);
  useEffect(() => {
    if (!inCabin) { draftOwner.current = null; return; }
    if (draftOwner.current !== inCabin.id) {
      draftOwner.current = inCabin.id;
      setDraft(loadDraft(inCabin.id));
    }
  }, [inCabin]);
  const updateDraft = (patch: Partial<Draft>) => {
    setDraft(d => {
      const next = { ...d, ...patch };
      if (draftOwner.current) {
        try { localStorage.setItem(draftKey(draftOwner.current), JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  };
  const setItems = (fn: (items: RxItem[]) => RxItem[]) => setDraft(d => {
    const next = { ...d, items: fn(d.items) };
    if (draftOwner.current) {
      try { localStorage.setItem(draftKey(draftOwner.current), JSON.stringify(next)); } catch { /* ignore */ }
    }
    return next;
  });

  // ───────── History of the patient in the cabin ─────────
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    setHistory(null);
    if (!inCabin?.patientNo) return;
    fetchPatientHistory(inCabin.patientNo).then(setHistory).catch(() => setHistory(null));
  }, [inCabin?.id, inCabin?.patientNo, fetchPatientHistory]);
  const previousVisits = (history?.visits || []).filter(v => v.id !== inCabin?.id && v.status === 'Completed');
  const rxForVisit = (visitId: string) => history?.prescriptions.find(rx => rx.patientId === visitId);

  // ───────── Medicines ─────────
  const catalog = useMemo(() => buildCatalog(inventory), [inventory]);
  const [query, setQuery] = useState('');
  const suggestions = useMemo(() => searchCatalog(catalog, query), [catalog, query]);
  const stockFor = (name: string) => inventory.find(m => m.name.toLowerCase() === name.toLowerCase());

  const addItem = (item: RxItem) => {
    if (draft.items.some(i => i.name.toLowerCase() === item.name.toLowerCase())) {
      push('error', `${item.name} is already in the prescription.`);
      return;
    }
    setItems(items => [...items, item]);
  };
  const updateItem = (index: number, patch: Partial<RxItem>) => setItems(items => items.map((it, i) => {
    if (i !== index) return it;
    const next = { ...it, ...patch };
    if (patch.dosage !== undefined || patch.duration !== undefined) next.qty = computeQty(next.dosage, next.duration);
    return next;
  }));
  const repeatPrescription = (items: RxItem[]) => {
    const fresh = items.filter(it => !draft.items.some(d => d.name.toLowerCase() === it.name.toLowerCase()))
      .map(it => ({ name: it.name, dosage: it.dosage, timing: it.timing || '', duration: it.duration, qty: it.qty || computeQty(it.dosage, it.duration) }));
    setItems(current => [...current, ...fresh]);
    push('success', `${fresh.length} medicine${fresh.length === 1 ? '' : 's'} copied from the previous visit.`);
  };

  // ───────── Voice dictation ─────────
  const SpeechRecognitionImpl = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  };

  const startListening = () => {
    if (!SpeechRecognitionImpl) return;
    const rec = new SpeechRecognitionImpl();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setHeard((finalText || interim).trim());
      if (finalText.trim()) {
        const items = parseDictation(finalText, catalog);
        if (items.length) {
          setItems(current => [...current, ...items.filter(it => !current.some(c => c.name.toLowerCase() === it.name.toLowerCase()))]);
        }
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') push('error', 'Microphone permission was denied. Allow it in the browser address bar.');
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try { rec.start(); setListening(true); setHeard(''); } catch { setListening(false); }
  };
  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* ignore */ } }, []);
  useEffect(() => { if (!inCabin && listening) stopListening(); }, [inCabin, listening]);

  // ───────── Save & print ─────────
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState<{ print: PrescriptionPrint; rxCode?: string; name: string } | null>(null);

  const printData = (p: PatientRecord, d: Draft, rxCode?: string, date?: string): PrescriptionPrint => ({
    hospitalName: hospitalName || 'Hospital',
    hospitalAddress: profileDetails?.address,
    hospitalPhone: profileDetails?.adminPhone,
    logoUrl: hospitalLogo || undefined,
    doctor: { name: doctorName, department: profile?.department, licenseNo: profile?.licenseNo, qualifications: profile?.signature },
    patient: { name: p.name, patientNo: p.patientNo, age: p.age, gender: p.gender, phone: p.phone, tokenNumber: p.tokenNumber },
    vitals: p.vitals,
    complaints: d.complaints,
    diagnosis: d.diagnosis,
    advice: d.advice,
    followUpDate: d.followUpDate,
    items: d.items,
    rxCode,
    date
  });

  const saveAndComplete = async () => {
    if (!inCabin || saving) return;
    if (!draft.diagnosis.trim() && draft.items.length === 0) {
      push('error', 'Add a diagnosis or at least one medicine before completing.');
      return;
    }
    if (draft.items.some(i => !i.name.trim() || !(i.qty > 0))) {
      push('error', 'Every medicine needs a name and a quantity.');
      return;
    }
    stopListening();
    setSaving(true);
    try {
      const patient = inCabin;
      const result = await saveConsultation(patient.id, { ...draft, medicines: draft.items, complete: true });
      try { localStorage.removeItem(draftKey(patient.id)); } catch { /* ignore */ }
      setCompleted({ print: printData(patient, draft, result.prescription?.code), rxCode: result.prescription?.code, name: patient.name });
      setDraft(emptyDraft());
    } catch (err: any) {
      push('error', err?.message || 'Could not save the consultation.');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+Enter saves, Alt+N calls the next patient
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); document.getElementById('rx-save-btn')?.click(); }
      if (e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); document.getElementById('call-next-btn')?.click(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const reprint = (p: PatientRecord) => {
    const rx = { complaints: p.complaints || '', diagnosis: p.diagnosis || '', advice: p.advice || '', followUpDate: p.followUpDate || '', items: [] as RxItem[] };
    fetchPatientHistory(p.patientNo || '')
      .then(h => {
        const pres = h.prescriptions.find(r => r.patientId === p.id) || h.prescriptions.find(r => r.code === p.rxCode);
        printDocument(buildPrescriptionHtml(printData(p, { ...rx, items: pres?.items || [] }, p.rxCode || pres?.code)));
      })
      .catch(() => printDocument(buildPrescriptionHtml(printData(p, rx, p.rxCode))));
  };

  const inputCls = 'w-full rounded-xl border border-[#D8D8D8] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]';
  const chip = (active: boolean) => `px-2.5 h-7 rounded-lg border text-[11px] font-bold transition-colors ${active ? 'bg-[#3683F8] border-[#3683F8] text-white' : 'bg-white border-[#D8D8D8] text-slate-600 hover:border-[#3683F8] hover:text-[#3683F8]'}`;

  return (
    <div className="space-y-5 font-sans pb-16">
      {/* Header */}
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">{doctorTitle(doctorName)}</h1>
          <p className="text-blue-50 text-xs font-semibold mt-1">
            {profile?.department || 'OPD'}{room ? ` · ${/room/i.test(room) ? room : `Room ${room}`}` : ''} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Waiting', value: waiting.length, icon: Clock },
            { label: 'Seen today', value: seenToday.length, icon: CheckCircle2 }
          ].map(s => (
            <div key={s.label} className="bg-white/15 border border-white/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <s.icon size={16} />
              <div className="leading-tight"><div className="text-lg font-black">{s.value}</div><div className="text-[10px] font-bold uppercase tracking-wider text-blue-100">{s.label}</div></div>
            </div>
          ))}
          <button
            type="button"
            onClick={toggleBreak}
            className={`h-12 px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-2 border ${onBreak ? 'bg-amber-400 border-amber-300 text-amber-950' : 'bg-white text-[#3683F8] border-white'}`}
          >
            {onBreak ? <><PlayCircle size={16} /> On break — resume</> : <><Coffee size={16} /> Take a break</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([['consult', 'Consultation', Stethoscope], ['today', `Today's patients (${seenToday.length})`, ClipboardList]] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`h-10 px-4 rounded-xl text-sm font-bold inline-flex items-center gap-2 border ${tab === key ? 'bg-[#060606] text-white border-[#060606]' : 'bg-white text-slate-600 border-[#D8D8D8]'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {onBreak && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 flex items-center gap-2">
          <Coffee size={16} /> You are on break. Reception will not assign new patients to you; patients already waiting stay in your queue.
        </div>
      )}

      {tab === 'consult' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Waiting room */}
          <aside className="xl:col-span-3 bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden xl:sticky xl:top-4">
            <div className="p-4 border-b border-[#D8D8D8] space-y-3">
              <h2 className="text-sm font-extrabold flex items-center gap-2"><Users size={16} className="text-[#3683F8]" /> Waiting room</h2>
              <button
                id="call-next-btn"
                type="button"
                onClick={callNext}
                disabled={!waiting.length || !!inCabin || calling}
                title={inCabin ? 'Finish or hold the current patient first' : 'Alt+N'}
                className="w-full h-11 rounded-xl bg-[#3683F8] hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2"
              >
                Call next patient <ChevronRight size={16} />
              </button>
              {unpaidCount > 0 && <p className="text-[11px] font-semibold text-rose-600">{unpaidCount} more registered — fee pending at front desk.</p>}
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#D8D8D8]/70">
              {inCabin && (
                <div className="p-3 bg-[#EBF3FE]">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-[#060606] text-white font-mono text-[11px] font-bold">{inCabin.tokenNumber}</span>
                    <span className="text-[10px] font-extrabold text-[#3683F8] uppercase">In cabin</span>
                  </div>
                  <div className="text-sm font-extrabold mt-1">{inCabin.name}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{inCabin.age}{(inCabin.gender || 'M')[0]} · {inCabin.patientNo}</div>
                </div>
              )}
              {waiting.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => !inCabin && callIn(p)}
                  disabled={!!inCabin}
                  className="w-full text-left p-3 hover:bg-slate-50 disabled:hover:bg-white disabled:cursor-default"
                  title={inCabin ? 'Finish or hold the current patient first' : 'Call this patient in'}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[11px] font-bold">{p.tokenNumber}</span>
                    <span className="text-[10px] font-bold text-slate-400">{i === 0 ? 'Next' : `#${i + 1}`} · {formatWait(p.createdAt, now)}</span>
                  </div>
                  <div className="text-sm font-bold mt-1 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                    {p.age}{(p.gender || 'M')[0]}{(p.vitals || []).length > 0 && <span className="inline-flex items-center gap-0.5 text-emerald-600"><Activity size={11} /> vitals</span>}
                  </div>
                </button>
              ))}
              {!inCabin && waiting.length === 0 && (
                <div className="p-6 text-center text-xs font-semibold text-slate-400">No patients waiting.</div>
              )}
            </div>
          </aside>

          {/* Consultation */}
          <section className="xl:col-span-9">
            {!inCabin ? (
              <div className="bg-white rounded-2xl border border-[#D8D8D8] p-10 text-center">
                <Stethoscope size={40} className="mx-auto text-slate-200" />
                <h2 className="text-lg font-extrabold mt-3">{waiting.length ? `${waiting.length} patient${waiting.length === 1 ? '' : 's'} waiting` : 'Your cabin is free'}</h2>
                <p className="text-sm text-slate-500 mt-1">{waiting.length ? 'Call the next patient to start the consultation.' : 'New patients appear here automatically once reception collects their fee.'}</p>
                {waiting.length > 0 && (
                  <button type="button" onClick={callNext} disabled={calling} className="mt-5 h-11 px-6 rounded-xl bg-[#3683F8] text-white font-extrabold text-sm inline-flex items-center gap-2">
                    Call {waiting[0].name} ({waiting[0].tokenNumber}) <ChevronRight size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Patient header */}
                <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-2xl bg-[#EBF3FE] text-[#3683F8] flex items-center justify-center text-lg font-black shrink-0">{inCabin.name[0]}</div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-extrabold truncate">{inCabin.name}</h2>
                      <p className="text-xs text-slate-500 font-semibold">
                        {inCabin.patientNo} · {inCabin.age} yrs · {inCabin.gender || 'Male'} · {inCabin.phone} · Token {inCabin.tokenNumber}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${previousVisits.length ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                      {previousVisits.length ? `Returning · ${previousVisits.length} visit${previousVisits.length === 1 ? '' : 's'}` : 'First visit'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => printDocument(buildPrescriptionHtml(printData(inCabin, draft)))} className="h-10 px-3 rounded-xl border border-[#D8D8D8] text-xs font-bold inline-flex items-center gap-1.5 hover:border-[#3683F8]">
                      <Printer size={15} /> Print draft
                    </button>
                    <button type="button" onClick={holdPatient} className="h-10 px-3 rounded-xl border border-amber-200 text-amber-700 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-amber-50">
                      <PauseCircle size={15} /> Hold
                    </button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-5 items-start">
                  {/* Clinical context */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4">
                      <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Vitals (from reception)</h3>
                      {(inCabin.vitals || []).length ? (
                        <div className="grid grid-cols-2 gap-2">
                          {(inCabin.vitals || []).map(v => (
                            <div key={v.name} className="rounded-xl bg-slate-50 border border-[#D8D8D8] px-2.5 py-1.5">
                              <div className="text-[10px] font-bold text-slate-400">{v.name}</div>
                              <div className="text-sm font-extrabold font-mono">{v.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-slate-400 font-semibold">No vitals recorded.</p>}
                      {inCabin.pastDiagnoses && (
                        <div className="mt-3 text-xs"><span className="font-bold text-slate-500">History noted at desk: </span>{inCabin.pastDiagnoses}</div>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><History size={13} /> Previous visits</h3>
                        {previousVisits.length > 0 && <button type="button" onClick={() => setHistoryOpen(true)} className="text-[11px] font-bold text-[#3683F8]">Full history</button>}
                      </div>
                      {previousVisits.length === 0 ? (
                        <p className="text-xs text-slate-400 font-semibold">{history ? 'No earlier visits.' : 'Loading…'}</p>
                      ) : (
                        <div className="space-y-2.5">
                          {previousVisits.slice(0, 3).map(v => {
                            const rx = rxForVisit(v.id);
                            return (
                              <div key={v.id} className="rounded-xl border border-[#D8D8D8] p-2.5">
                                <div className="text-[11px] font-bold text-slate-500">{new Date(v.createdAt || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {doctorTitle(v.doctorName)}</div>
                                <div className="text-sm font-extrabold">{v.diagnosis || 'No diagnosis recorded'}</div>
                                {rx && <div className="text-[11px] text-slate-600 mt-0.5">{rx.items.map(i => i.name).join(', ')}</div>}
                                {rx && rx.items.length > 0 && (
                                  <button type="button" onClick={() => repeatPrescription(rx.items)} className="mt-1.5 text-[11px] font-bold text-[#3683F8] inline-flex items-center gap-1"><RotateCcw size={12} /> Repeat these medicines</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes + prescription */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4 space-y-3">
                      <label className="block space-y-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Complaints / findings</span>
                        <textarea rows={2} value={draft.complaints} onChange={e => updateDraft({ complaints: e.target.value })} placeholder="e.g. Fever and body ache for 3 days" className={`${inputCls} py-2 resize-y`} />
                      </label>
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Diagnosis</span>
                        <input value={draft.diagnosis} onChange={e => updateDraft({ diagnosis: e.target.value })} placeholder="Diagnosis" className={`${inputCls} h-10 font-semibold`} />
                        <div className="flex flex-wrap gap-1.5">
                          {COMMON_DIAGNOSES.map(d => <button key={d} type="button" onClick={() => updateDraft({ diagnosis: d })} className={chip(draft.diagnosis === d)}>{d}</button>)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold flex items-center gap-2"><Pill size={16} className="text-[#3683F8]" /> Prescription {draft.items.length > 0 && <span className="text-xs text-slate-400">({draft.items.length})</span>}</h3>
                        <button
                          type="button"
                          onClick={listening ? stopListening : startListening}
                          disabled={!SpeechRecognitionImpl}
                          title={SpeechRecognitionImpl ? 'Dictate medicines, e.g. "Dolo 650 twice a day for 3 days and Pan D before food 10 days"' : 'Voice typing needs Google Chrome or Microsoft Edge'}
                          className={`h-9 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border disabled:opacity-40 ${listening ? 'bg-rose-600 border-rose-600 text-white animate-pulse' : 'bg-white border-[#D8D8D8] text-slate-700 hover:border-[#3683F8]'}`}
                        >
                          {listening ? <><MicOff size={15} /> Stop</> : <><Mic size={15} /> Dictate</>}
                        </button>
                      </div>
                      {listening && (
                        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800">
                          <span className="font-bold">Listening…</span> {heard || 'Say the medicine, dose and duration.'}
                        </div>
                      )}

                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={query}
                          onChange={e => setQuery(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); addItem(newRxItem(suggestions[0])); setQuery(''); }
                          }}
                          placeholder="Search medicine (type 3 letters, Enter adds the first match)"
                          className={`${inputCls} h-10 pl-9`}
                          aria-label="Search medicine"
                        />
                        {query && (
                          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D8D8D8] rounded-xl shadow-xl overflow-hidden">
                            {suggestions.map(m => (
                              <button key={m.name} type="button" onClick={() => { addItem(newRxItem(m)); setQuery(''); }} className="w-full text-left px-3 py-2 hover:bg-[#EBF3FE] flex items-center justify-between gap-3">
                                <span>
                                  <span className="text-sm font-bold">{m.name}</span>
                                  <span className="block text-[11px] text-slate-500">{m.category} · {m.dosage} · {m.duration}</span>
                                </span>
                                {m.stock !== undefined
                                  ? <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${m.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{m.stock > 0 ? `${m.stock} in stock` : 'Out of stock'}</span>
                                  : <span className="text-[10px] font-bold text-slate-400">not stocked</span>}
                              </button>
                            ))}
                            {query.trim().length >= 2 && (
                              <button type="button" onClick={() => { addItem({ name: query.trim(), dosage: '1-0-1', timing: 'After food', duration: '5 days', qty: 10 }); setQuery(''); }} className="w-full text-left px-3 py-2 border-t border-[#D8D8D8] text-sm font-bold text-[#3683F8] inline-flex items-center gap-1.5">
                                <Plus size={14} /> Add “{query.trim()}” as written
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {draft.items.length === 0 ? (
                        <p className="text-xs text-slate-400 font-semibold py-3 text-center">No medicines yet. Search above or use Dictate.</p>
                      ) : (
                        <div className="space-y-2">
                          {draft.items.map((it, i) => {
                            const stock = stockFor(it.name);
                            const short = stock && stock.stock < it.qty;
                            return (
                              <div key={`${it.name}-${i}`} className="rounded-xl border border-[#D8D8D8] p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-sm font-extrabold">{i + 1}. {it.name}</span>
                                    {stock ? (
                                      <span className={`ml-2 text-[10px] font-extrabold ${short ? 'text-rose-600' : 'text-emerald-600'}`}>{short ? `only ${stock.stock} in stock` : `₹${stock.price} · in stock`}</span>
                                    ) : <span className="ml-2 text-[10px] font-bold text-slate-400">outside pharmacy</span>}
                                  </div>
                                  <button type="button" aria-label={`Remove ${it.name}`} onClick={() => setItems(items => items.filter((_, idx) => idx !== i))} className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 inline-flex items-center justify-center"><Trash2 size={15} /></button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  <select aria-label="Dose" value={DOSAGES.includes(it.dosage) ? it.dosage : '__custom'} onChange={e => e.target.value !== '__custom' && updateItem(i, { dosage: e.target.value })} className={`${inputCls} h-9 font-mono font-bold`}>
                                    {DOSAGES.map(d => <option key={d} value={d}>{d}</option>)}
                                    {!DOSAGES.includes(it.dosage) && <option value="__custom">{it.dosage}</option>}
                                  </select>
                                  <select aria-label="When" value={it.timing || ''} onChange={e => updateItem(i, { timing: e.target.value })} className={`${inputCls} h-9`}>
                                    <option value="">—</option>
                                    {TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  <select aria-label="Duration" value={DURATIONS.includes(it.duration) ? it.duration : '__custom'} onChange={e => e.target.value !== '__custom' && updateItem(i, { duration: e.target.value })} className={`${inputCls} h-9`}>
                                    {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                    {!DURATIONS.includes(it.duration) && <option value="__custom">{it.duration}</option>}
                                  </select>
                                  <label className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Qty</span>
                                    <input aria-label="Quantity" type="number" min={1} value={it.qty} onChange={e => updateItem(i, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} className={`${inputCls} h-9 pl-9 font-mono font-bold`} />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4 space-y-3">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Advice</span>
                        <textarea rows={2} value={draft.advice} onChange={e => updateDraft({ advice: e.target.value })} placeholder="Advice for the patient" className={`${inputCls} py-2 resize-y`} />
                        <div className="flex flex-wrap gap-1.5">
                          {COMMON_ADVICE.map(a => (
                            <button key={a} type="button" onClick={() => updateDraft({ advice: draft.advice.includes(a) ? draft.advice : [draft.advice.trim(), a].filter(Boolean).join('\n') })} className={chip(draft.advice.includes(a))}>+ {a}</button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><CalendarCheck size={13} /> Follow-up</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button type="button" onClick={() => updateDraft({ followUpDate: '' })} className={chip(!draft.followUpDate)}>None</button>
                          {FOLLOW_UPS.map(f => <button key={f.label} type="button" onClick={() => updateDraft({ followUpDate: addDaysYMD(f.days) })} className={chip(draft.followUpDate === addDaysYMD(f.days))}>{f.label}</button>)}
                          <input type="date" aria-label="Follow-up date" min={addDaysYMD(1)} value={draft.followUpDate} onChange={e => updateDraft({ followUpDate: e.target.value })} className={`${inputCls} h-8 w-auto text-xs font-bold`} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                      <span className="text-[11px] text-slate-400 font-semibold sm:mr-auto">Draft saves automatically · Ctrl+Enter to complete</span>
                      <button
                        id="rx-save-btn"
                        type="button"
                        onClick={saveAndComplete}
                        disabled={saving}
                        className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-md"
                      >
                        <CheckCircle2 size={18} /> {saving ? 'Saving…' : draft.items.length ? 'Complete & send Rx to pharmacy' : 'Complete consultation'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
          <div className="p-4 border-b border-[#D8D8D8]">
            <h2 className="text-base font-extrabold">Patients seen today</h2>
            <p className="text-[11px] text-slate-500 font-semibold">{seenToday.length} consultations · {seenToday.filter(p => p.rxCode).length} prescriptions sent · {seenToday.filter(p => p.followUpDate).length} follow-ups booked</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EBF3FE]/60 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Diagnosis</th><th className="px-4 py-3">Prescription</th><th className="px-4 py-3">Follow-up</th><th className="px-4 py-3 text-right">Print</th></tr>
              </thead>
              <tbody className="divide-y divide-[#D8D8D8]/60">
                {seenToday.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-semibold text-slate-500 whitespace-nowrap">{new Date(p.consultedAt || p.createdAt || '').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3"><div className="font-extrabold text-sm">{p.name}</div><div className="text-[11px] text-slate-500">{p.patientNo} · {p.tokenNumber}</div></td>
                    <td className="px-4 py-3 font-semibold">{p.diagnosis || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 font-mono font-bold">{p.rxCode || <span className="text-slate-400 font-sans">No medicines</span>}</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{p.followUpDate ? prettyDate(p.followUpDate) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => reprint(p)} className="h-8 px-3 rounded-lg border border-[#D8D8D8] text-[11px] font-bold text-[#3683F8] inline-flex items-center gap-1"><Printer size={13} /> Reprint</button>
                    </td>
                  </tr>
                ))}
                {seenToday.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm font-bold text-slate-400">No consultations completed yet today.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Completed */}
      <Modal isOpen={!!completed} onClose={() => setCompleted(null)} title="Consultation complete" className="max-w-sm">
        {completed && (
          <div className="space-y-4 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center"><CheckCircle2 size={30} /></div>
            <div>
              <div className="text-base font-extrabold">{completed.name}</div>
              <div className="text-sm text-slate-500">{completed.rxCode ? <>Prescription <span className="font-mono font-bold text-[#060606]">{completed.rxCode}</span> sent to the pharmacy.</> : 'Consultation notes saved.'}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => printDocument(buildPrescriptionHtml(completed.print))} className="h-11 rounded-xl border border-[#D8D8D8] text-sm font-bold inline-flex items-center justify-center gap-1.5"><Printer size={16} /> Print</button>
              <button type="button" disabled={!waiting.length} onClick={() => { setCompleted(null); callNext(); }} className="h-11 rounded-xl bg-[#3683F8] disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-1">Next patient <ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </Modal>

      {/* Full history */}
      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title={`History · ${inCabin?.name || ''}`} className="max-w-2xl">
        <div className="max-h-[70vh] overflow-y-auto space-y-3">
          {previousVisits.map(v => {
            const rx = rxForVisit(v.id);
            return (
              <div key={v.id} className="rounded-xl border border-[#D8D8D8] p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">{new Date(v.createdAt || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {doctorTitle(v.doctorName)}</span>
                  {rx && <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${rx.status === 'DISPENSED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{rx.code} · {rx.status === 'DISPENSED' ? 'Dispensed' : 'Not yet dispensed'}</span>}
                </div>
                <div className="text-sm font-extrabold">{v.diagnosis || 'No diagnosis recorded'}</div>
                {v.complaints && <div className="text-xs text-slate-600">Complaints: {v.complaints}</div>}
                {(v.vitals || []).length > 0 && <div className="text-[11px] text-slate-500">{(v.vitals || []).map(x => `${x.name}: ${x.value}`).join(' · ')}</div>}
                {rx && (
                  <ul className="text-xs text-slate-700 list-disc pl-5">
                    {rx.items.map(i => <li key={i.name}>{i.name} — {i.dosage}{i.timing ? `, ${i.timing}` : ''}, {i.duration} ({i.qty})</li>)}
                  </ul>
                )}
                {v.advice && <div className="text-xs text-slate-600">Advice: {v.advice}</div>}
                {rx && rx.items.length > 0 && (
                  <button type="button" onClick={() => { repeatPrescription(rx.items); setHistoryOpen(false); }} className="text-[11px] font-bold text-[#3683F8] inline-flex items-center gap-1"><RotateCcw size={12} /> Repeat these medicines</button>
                )}
              </div>
            );
          })}
          {previousVisits.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No earlier visits.</p>}
        </div>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
