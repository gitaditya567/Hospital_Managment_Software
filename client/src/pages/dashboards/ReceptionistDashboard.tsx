import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, Clock, Printer, CreditCard, CheckCircle2, Keyboard, Trash2, Activity, Users, Search,
  RefreshCw, Stethoscope, IndianRupee, CalendarClock, ArrowRight, AlertTriangle, DoorOpen, Phone, X
} from 'lucide-react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { PatientRecord, PaymentMode } from '../../store/useHospitalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Modal } from '../../components/ui/Modal';
import { VitalsModal } from '../../components/VitalsModal';
import { doctorTitle } from '../../lib/utils';
import {
  CollectFeeModal, PaymentModePicker, PersonPicker, ToastStack, feeOptionsFor, formatWait, invoiceDateLabel,
  isToday, isVisitUnpaid, peopleForPhone, printOpdSlip, roomFor, timeToMinutes, toYMD, useDoctorLoad, useNow, useToasts,
  type SlipData
} from './reception/receptionShared';

type QueueTab = 'Waiting' | 'In Consultation' | 'Completed' | 'Unpaid' | 'All';

const AUTO_PRINT_KEY = 'reception_auto_print';
const REFRESH_MS = 15000;

const statusStyle: Record<PatientRecord['status'], string> = {
  'Waiting': 'bg-amber-50 text-amber-700 border-amber-200',
  'In Consultation': 'bg-[#EBF3FE] text-[#3683F8] border-blue-200',
  'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export function ReceptionistDashboard() {
  const {
    patients, staff, fees, invoices, schedules, appointments,
    registerPatient, updatePatientStatus, collectPatientFeeDirectly, cancelPatient,
    fetchHospitalData, fetchAppointments, checkInAppointment
  } = useHospitalStore();
  const { user } = useAuthStore();
  const { searchQuery } = useSuperAdminStore();
  const { toasts, push, dismiss } = useToasts();
  const now = useNow(30000);

  const doctors = useMemo(() => staff.filter(s => s.role === 'Doctor' && s.status === 'Active'), [staff]);
  const doctorLoad = useDoctorLoad(patients);

  // ───────── Registration form ─────────
  const [phone, setPhone] = useState('');
  const [personKey, setPersonKey] = useState('new');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [doctorId, setDoctorId] = useState('');
  const [feeKey, setFeeKey] = useState('opd');
  const [amount, setAmount] = useState('');
  const [payNow, setPayNow] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [vitals, setVitals] = useState<Array<{ name: string; value: string }>>([]);
  const [pastDiagnoses, setPastDiagnoses] = useState('');
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [autoPrint, setAutoPrint] = useState(() => {
    try { return localStorage.getItem(AUTO_PRINT_KEY) === '1'; } catch { return false; }
  });
  const phoneRef = useRef<HTMLInputElement>(null);

  const selectedDoctor = doctors.find(d => d.id === doctorId);
  const feeOptions = useMemo(() => feeOptionsFor(fees, selectedDoctor), [fees, selectedDoctor]);
  const selectedFee = feeOptions.find(f => f.key === feeKey) || feeOptions[0];
  const knownPeople = useMemo(() => peopleForPhone(patients, phone), [patients, phone]);

  useEffect(() => {
    if (!doctorId && doctors.length > 0) setDoctorId(doctors[0].id);
  }, [doctors, doctorId]);

  // Amount follows the selected fee option (still editable)
  useEffect(() => {
    if (!feeOptions.some(f => f.key === feeKey)) setFeeKey('opd');
    else if (selectedFee) setAmount(String(selectedFee.amount));
  }, [feeKey, feeOptions, selectedFee]);

  const choosePerson = (key: string) => {
    setPersonKey(key);
    const person = knownPeople.find(p => p.key === key);
    if (person) {
      setName(person.name);
      setAge(String(person.age));
      setGender(person.gender);
    } else {
      setName('');
      setAge('');
      setGender('Male');
    }
  };

  // Phone lookup: pre-select the most recent person on this number
  useEffect(() => {
    if (knownPeople.length > 0) choosePerson(knownPeople[0].key);
    else choosePerson('new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone.length === 10 ? phone : '']);


  const resetForm = () => {
    setPhone('');
    setPersonKey('new');
    setName('');
    setAge('');
    setGender('Male');
    setFeeKey('opd');
    setPayNow(true);
    setPaymentMode('Cash');
    setVitals([]);
    setPastDiagnoses('');
    setFormError('');
    phoneRef.current?.focus();
  };

  const toggleAutoPrint = (on: boolean) => {
    setAutoPrint(on);
    try { localStorage.setItem(AUTO_PRINT_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  };

  // ───────── Slip preview ─────────
  const [slip, setSlip] = useState<SlipData | null>(null);

  const showSlip = (data: SlipData) => {
    if (autoPrint) {
      printOpdSlip(data);
      push('success', `Token ${data.tokenNumber} printed for ${data.patientName}.`);
    } else {
      setSlip(data);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setFormError('');
    if (phone.length !== 10) return setFormError('Enter a 10-digit mobile number.');
    if (!name.trim()) return setFormError('Enter the patient name.');
    if (!age || Number(age) < 0 || Number(age) > 120) return setFormError('Enter a valid age (0–120).');
    if (!selectedDoctor) return setFormError('No doctor is on duty. Ask the admin to activate a doctor.');
    const fee = Math.max(0, Number(amount) || 0);

    setSubmitting(true);
    try {
      const visit = await registerPatient({
        name: name.trim(),
        phone,
        age: Number(age),
        gender,
        doctorName: selectedDoctor.name,
        vitals,
        pastDiagnoses,
        appointmentDate: new Date().toDateString(),
        appointmentTime: '',
        payNow,
        fee: { amount: fee, feeType: selectedFee.feeType, paymentMode }
      });
      const paid = visit.paymentStatus === 'Paid';
      showSlip({
        tokenNumber: visit.tokenNumber,
        patientId: visit.id,
        patientNo: visit.patientNo,
        patientName: visit.name,
        phone: visit.phone,
        age: visit.age,
        gender: visit.gender || gender,
        doctorName: visit.doctorName,
        room: roomFor(schedules, selectedDoctor),
        feeType: selectedFee.feeType,
        amount: fee,
        paid,
        paymentMode: paid && fee > 0 ? paymentMode : undefined,
        invoiceNo: visit.invoice?.id
      });
      if (!autoPrint) push('success', `${visit.name} registered · Token ${visit.tokenNumber}${paid ? '' : ' · fee due'}`);
      resetForm();
    } catch (err: any) {
      setFormError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // F9 registers, F2 jumps to the phone box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') { e.preventDefault(); document.getElementById('register-submit-btn')?.click(); }
      if (e.key === 'F2') { e.preventDefault(); phoneRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ───────── Live refresh ─────────
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSync, setLastSync] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const today = toYMD(new Date());

  const refresh = async () => {
    if (!user?.hospitalId) return;
    setRefreshing(true);
    await Promise.all([fetchHospitalData(user.hospitalId), fetchAppointments(today, today)]);
    setLastSync(Date.now());
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAppointments(today, today);
  }, [fetchAppointments, today]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, user?.hospitalId]);

  // ───────── Today's queue ─────────
  const [tab, setTab] = useState<QueueTab>('Waiting');
  const [doctorFilter, setDoctorFilter] = useState('All');
  const [search, setSearch] = useState('');

  const todays = useMemo(
    () => patients
      .filter(p => isToday(p.createdAt))
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [patients]
  );

  const invoiceFor = (p: PatientRecord) =>
    invoices.find(i => i.patientId === p.id) ||
    invoices.find(i => !i.patientId && i.patientPhone === p.phone && i.status === 'Pending');

  const counts = {
    Waiting: todays.filter(p => p.status === 'Waiting' && !isVisitUnpaid(p)).length,
    'In Consultation': todays.filter(p => p.status === 'In Consultation').length,
    Completed: todays.filter(p => p.status === 'Completed').length,
    Unpaid: todays.filter(isVisitUnpaid).length,
    All: todays.length
  };

  const todayLabel = invoiceDateLabel();
  const todayInvoices = invoices.filter(i => i.date === todayLabel);
  const collectedToday = todayInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const dueToday = todayInvoices.filter(i => i.status === 'Pending').reduce((s, i) => s + i.amount, 0);

  const query = (search || searchQuery).trim().toLowerCase();
  const rows = todays.filter(p => {
    if (doctorFilter !== 'All' && p.doctorName !== doctorFilter) return false;
    if (tab === 'Unpaid' && !isVisitUnpaid(p)) return false;
    if (tab === 'Waiting' && (p.status !== 'Waiting' || isVisitUnpaid(p))) return false;
    if ((tab === 'In Consultation' || tab === 'Completed') && p.status !== tab) return false;
    if (!query) return true;
    return [p.name, p.phone, p.tokenNumber, p.patientNo].some(v => (v || '').toLowerCase().includes(query));
  });

  // Position in each doctor's paid waiting line
  const positionOf = (p: PatientRecord) =>
    todays.filter(x => x.doctorName === p.doctorName && x.status === 'Waiting' && !isVisitUnpaid(x)).findIndex(x => x.id === p.id) + 1;

  const slipFor = (p: PatientRecord): SlipData => {
    const inv = invoiceFor(p);
    const doc = doctors.find(d => d.name === p.doctorName);
    return {
      tokenNumber: p.tokenNumber,
      patientId: p.id,
      patientNo: p.patientNo,
      patientName: p.name,
      phone: p.phone,
      age: p.age,
      gender: p.gender || 'Male',
      doctorName: p.doctorName,
      room: roomFor(schedules, doc || { name: p.doctorName }),
      feeType: inv?.feeType || 'OPD Consultation Fee',
      amount: inv?.amount ?? 0,
      paid: !isVisitUnpaid(p),
      paymentMode: inv?.paymentMode || undefined,
      invoiceNo: inv?.id
    };
  };

  // ───────── Row actions ─────────
  const [collectTarget, setCollectTarget] = useState<PatientRecord | null>(null);
  const [detail, setDetail] = useState<PatientRecord | null>(null);
  const detailLive = detail ? patients.find(p => p.id === detail.id) || detail : null;

  const confirmCollect = async (mode: PaymentMode) => {
    if (!collectTarget) return;
    const inv = invoiceFor(collectTarget);
    const result = await collectPatientFeeDirectly(collectTarget.id, inv?.amount ?? fees?.opdFee, inv?.feeType, mode);
    if (result) {
      push('success', `₹${result.amount.toLocaleString('en-IN')} received from ${collectTarget.name} (${mode}). Sent to doctor queue.`);
      showSlip({ ...slipFor(collectTarget), paid: true, paymentMode: mode, amount: result.amount, invoiceNo: result.id });
    } else {
      push('error', 'Could not record the payment. Please try again.');
    }
    setCollectTarget(null);
  };

  const cancelVisit = async (p: PatientRecord) => {
    const paid = !isVisitUnpaid(p) && (invoiceFor(p)?.amount || 0) > 0;
    const msg = paid
      ? `Cancel ${p.name}'s check-in (${p.tokenNumber})?\n\nThe fee was already collected — it stays in the accounts, so refund it manually if needed.`
      : `Cancel ${p.name}'s check-in (${p.tokenNumber})?`;
    if (!window.confirm(msg)) return;
    await cancelPatient(p.id);
    setDetail(null);
    push('success', `Check-in for ${p.name} cancelled.`);
  };

  const setStatus = async (p: PatientRecord, status: PatientRecord['status']) => {
    if (status !== 'Waiting' && isVisitUnpaid(p)) {
      push('error', `${p.name} has not paid yet. Collect the fee first.`);
      return;
    }
    await updatePatientStatus(p.id, status);
    push('success', `${p.name} → ${status}`);
  };

  // ───────── Today's appointments ─────────
  const todaysAppointments = appointments.filter(a => a.date === today && a.status === 'Booked').sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const [apptTarget, setApptTarget] = useState<typeof todaysAppointments[number] | null>(null);
  const [apptPayNow, setApptPayNow] = useState(true);
  const [apptMode, setApptMode] = useState<PaymentMode>('Cash');
  const [apptBusy, setApptBusy] = useState(false);
  const apptDoctor = apptTarget ? doctors.find(d => d.name === apptTarget.doctorName) : undefined;
  const apptFee = feeOptionsFor(fees, apptDoctor)[apptDoctor?.consultationFee && apptDoctor.consultationFee !== fees?.opdFee ? 1 : 0];

  const confirmApptCheckIn = async () => {
    if (!apptTarget) return;
    setApptBusy(true);
    try {
      const visit = await checkInAppointment(apptTarget.id, {
        payNow: apptPayNow,
        fee: { amount: apptFee.amount, feeType: apptFee.feeType, paymentMode: apptMode }
      });
      const paid = visit.paymentStatus === 'Paid';
      showSlip({
        tokenNumber: visit.tokenNumber, patientId: visit.id, patientNo: visit.patientNo, patientName: visit.name,
        phone: visit.phone, age: visit.age, gender: visit.gender || 'Male', doctorName: visit.doctorName,
        room: roomFor(schedules, apptDoctor || { name: visit.doctorName }), feeType: apptFee.feeType, amount: apptFee.amount,
        paid, paymentMode: paid ? apptMode : undefined, invoiceNo: visit.invoice?.id
      });
      push('success', `${visit.name} checked in · Token ${visit.tokenNumber}`);
      setApptTarget(null);
    } catch (err: any) {
      push('error', err?.message || 'Check-in failed.');
    } finally {
      setApptBusy(false);
    }
  };

  const syncedAgo = Math.max(0, Math.round((now - lastSync) / 1000));

  return (
    <div className="space-y-5 font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#3683F8] p-5 sm:p-6 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">OPD Front Desk</h1>
          <p className="text-blue-50 text-xs font-medium mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Register patients, collect fees and manage today's queue
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <span className="hidden sm:inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-xl px-3 py-2">
            <Keyboard size={13} /> F2 phone · F9 register
          </span>
          <Link to="/receptionist/appointments" className="inline-flex items-center gap-1.5 bg-white text-[#3683F8] rounded-xl px-3 py-2 hover:bg-blue-50">
            <CalendarClock size={14} /> Book appointment
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Today's patients", value: counts.All, icon: Users, tone: 'text-[#3683F8] bg-[#EBF3FE] border-blue-200' },
          { label: 'Waiting', value: counts.Waiting, icon: Clock, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'With doctor', value: counts['In Consultation'], icon: Stethoscope, tone: 'text-[#3683F8] bg-[#EBF3FE] border-blue-200' },
          { label: 'Collected today', value: `₹${collectedToday.toLocaleString('en-IN')}`, icon: IndianRupee, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: 'Fees due today', value: `₹${dueToday.toLocaleString('en-IN')}`, icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50 border-rose-200' }
        ].map(k => (
          <div key={k.label} className="bg-white p-4 rounded-2xl border border-[#D8D8D8] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{k.label}</p>
              <p className="text-2xl font-extrabold text-[#060606] tracking-tight">{k.value}</p>
            </div>
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${k.tone}`}><k.icon size={19} /></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ───── Registration ───── */}
        <form onSubmit={handleRegister} className="xl:col-span-4 bg-white rounded-2xl border border-[#D8D8D8] p-5 space-y-4 xl:sticky xl:top-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold flex items-center gap-2"><UserPlus size={18} className="text-[#3683F8]" /> New OPD check-in</h2>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-pointer" title="Print the token slip automatically after registration">
              <input type="checkbox" checked={autoPrint} onChange={e => toggleAutoPrint(e.target.checked)} className="rounded border-[#D8D8D8] text-[#3683F8]" />
              Auto-print slip
            </label>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex gap-2">
              <AlertTriangle size={15} className="shrink-0" /> {formError}
            </div>
          )}

          {/* 1. Phone */}
          <div className="space-y-1.5">
            <label htmlFor="rx-phone" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">1 · Mobile number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="rx-phone"
                ref={phoneRef}
                autoFocus
                inputMode="numeric"
                placeholder="10-digit mobile"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full h-11 pl-9 pr-9 rounded-xl border border-[#D8D8D8] text-sm font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
              />
              {phone && (
                <button type="button" onClick={() => setPhone('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear phone"><X size={15} /></button>
              )}
            </div>
            {phone.length === 10 && (knownPeople.length > 0
              ? <PersonPicker people={knownPeople} selectedKey={personKey} onSelect={choosePerson} />
              : <p className="text-[11px] font-bold text-amber-700">New patient — fill in the details below.</p>)}
          </div>

          {/* 2. Patient */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">2 · Patient</span>
            <input
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
            />
            <div className="grid grid-cols-5 gap-2">
              <input
                type="number"
                min={0}
                max={120}
                placeholder="Age"
                value={age}
                onChange={e => setAge(e.target.value)}
                className="col-span-2 h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
              />
              <div className="col-span-3 grid grid-cols-3 gap-1">
                {['Male', 'Female', 'Other'].map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)} className={`h-10 rounded-xl border text-[11px] font-bold ${gender === g ? 'bg-[#060606] text-white border-[#060606]' : 'bg-white border-[#D8D8D8] text-slate-600'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVitalsOpen(true)}
              className={`w-full h-9 px-3 rounded-xl border flex items-center justify-between text-xs font-bold ${vitals.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-dashed border-[#D8D8D8] text-slate-500 hover:border-[#3683F8] hover:text-[#3683F8]'}`}
            >
              <span className="flex items-center gap-1.5"><Activity size={14} /> {vitals.length > 0 ? `${vitals.length} vitals recorded` : 'Add vitals & history (optional)'}</span>
              <span>{vitals.length > 0 ? 'Edit' : '+'}</span>
            </button>
          </div>

          {/* 3. Doctor */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">3 · Doctor</span>
            {doctors.length === 0 ? (
              <p className="text-xs font-semibold text-rose-600">No active doctors. Ask the hospital admin to add or activate a doctor.</p>
            ) : (
              <div className="grid gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                {doctors.map(d => {
                  const room = roomFor(schedules, d);
                  const active = d.id === doctorId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDoctorId(d.id)}
                      className={`text-left px-3 py-2 rounded-xl border transition-all ${active ? 'border-[#3683F8] bg-[#EBF3FE] ring-2 ring-[#3683F8]/15' : 'border-[#D8D8D8] hover:border-slate-400'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold truncate">{doctorTitle(d.name)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${(doctorLoad[d.name] || 0) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {doctorLoad[d.name] || 0} waiting
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold truncate">
                        {d.department || 'General'}{room ? ` · ${/room/i.test(room) ? room : `Room ${room}`}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Fee */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">4 · Fee</span>
            <div className="grid grid-cols-2 gap-1.5">
              {feeOptions.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFeeKey(f.key)}
                  className={`text-left px-2.5 py-2 rounded-xl border text-xs font-bold ${feeKey === f.key ? 'border-[#3683F8] bg-[#EBF3FE] text-[#060606]' : 'border-[#D8D8D8] text-slate-600 hover:border-slate-400'}`}
                >
                  <span className="block truncate">{f.label}</span>
                  <span className="text-[#3683F8]">₹{f.amount.toLocaleString('en-IN')}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  aria-label="Fee amount"
                  className="w-full h-10 pl-7 pr-3 rounded-xl border border-[#D8D8D8] text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                />
              </div>
              <div className="grid grid-cols-2 gap-1 w-[150px]">
                <button type="button" onClick={() => setPayNow(true)} className={`h-10 rounded-xl border text-[11px] font-bold ${payNow ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-[#D8D8D8] text-slate-600'}`}>Paid now</button>
                <button type="button" onClick={() => setPayNow(false)} className={`h-10 rounded-xl border text-[11px] font-bold ${!payNow ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-[#D8D8D8] text-slate-600'}`}>Pay later</button>
              </div>
            </div>
            {payNow && Number(amount) > 0 && <PaymentModePicker value={paymentMode} onChange={setPaymentMode} />}
            {!payNow && <p className="text-[11px] font-semibold text-rose-600">The patient joins the doctor's queue only after the fee is collected.</p>}
          </div>

          <button
            id="register-submit-btn"
            type="submit"
            disabled={submitting || doctors.length === 0}
            className="w-full h-12 rounded-xl bg-[#3683F8] hover:bg-blue-600 disabled:opacity-60 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-md shadow-[#3683F8]/25"
          >
            <Printer size={17} /> {submitting ? 'Registering…' : 'Register & get token (F9)'}
          </button>
        </form>

        {/* ───── Queue ───── */}
        <div className="xl:col-span-8 space-y-5">
          {todaysAppointments.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#D8D8D8] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold flex items-center gap-2"><CalendarClock size={16} className="text-[#3683F8]" /> Today's appointments ({todaysAppointments.length})</h3>
                <Link to="/receptionist/appointments" className="text-xs font-bold text-[#3683F8] inline-flex items-center gap-1">All appointments <ArrowRight size={13} /></Link>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {todaysAppointments.map(a => (
                  <div key={a.id} className="shrink-0 w-56 rounded-xl border border-[#D8D8D8] p-3">
                    <div className="text-xs font-black text-[#3683F8]">{a.time}</div>
                    <div className="text-sm font-extrabold truncate">{a.patientName}</div>
                    <div className="text-[11px] text-slate-500 font-semibold truncate">{doctorTitle(a.doctorName)} · {a.phone}</div>
                    <button
                      type="button"
                      onClick={() => { setApptTarget(a); setApptPayNow(true); setApptMode('Cash'); }}
                      className="mt-2 w-full h-8 rounded-lg bg-[#060606] hover:bg-slate-800 text-white text-[11px] font-bold"
                    >
                      Patient arrived — check in
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
            <div className="p-4 border-b border-[#D8D8D8] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold">Today's OPD queue</h2>
                <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  {autoRefresh ? `Live · updated ${syncedAgo < 5 ? 'just now' : `${syncedAgo}s ago`}` : 'Auto-refresh paused'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Name, phone, token…"
                    className="h-9 w-44 sm:w-56 pl-8 pr-3 rounded-xl border border-[#D8D8D8] text-xs font-semibold focus:outline-none focus:border-[#3683F8]"
                  />
                </div>
                <button type="button" onClick={() => setAutoRefresh(!autoRefresh)} className={`h-9 px-3 rounded-xl border text-[11px] font-bold ${autoRefresh ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#D8D8D8] text-slate-500'}`}>
                  {autoRefresh ? 'Live on' : 'Live off'}
                </button>
                <button type="button" onClick={refresh} title="Refresh now" className="h-9 w-9 rounded-xl border border-[#D8D8D8] flex items-center justify-center text-slate-600 hover:border-[#3683F8] hover:text-[#3683F8]">
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-[#D8D8D8] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex gap-1.5 overflow-x-auto">
                {(['Waiting', 'In Consultation', 'Completed', 'Unpaid', 'All'] as QueueTab[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`shrink-0 h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border ${tab === t
                      ? t === 'Unpaid' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-[#060606] border-[#060606] text-white'
                      : t === 'Unpaid' && counts.Unpaid > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-[#D8D8D8] text-slate-600'}`}
                  >
                    {t === 'In Consultation' ? 'With doctor' : t === 'Unpaid' ? 'Fee due' : t}
                    <span className={`text-[10px] px-1.5 rounded ${tab === t ? 'bg-white/20' : 'bg-slate-100'}`}>{counts[t]}</span>
                  </button>
                ))}
              </div>
              <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="h-8 px-2 rounded-lg border border-[#D8D8D8] text-xs font-bold bg-white">
                <option value="All">All doctors</option>
                {doctors.map(d => <option key={d.id} value={d.name}>{doctorTitle(d.name)}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EBF3FE]/60 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Doctor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Fee</th>
                    <th className="px-4 py-3">Waiting</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8D8D8]/60">
                  {rows.map(p => {
                    const inv = invoiceFor(p);
                    const unpaid = isVisitUnpaid(p);
                    const pos = p.status === 'Waiting' && !unpaid ? positionOf(p) : 0;
                    return (
                      <tr key={p.id} onClick={() => setDetail(p)} className="cursor-pointer hover:bg-[#EBF3FE]/30">
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-lg bg-[#060606] text-white font-mono font-bold text-[11px] whitespace-nowrap">{p.tokenNumber}</span>
                          {pos > 0 && <span className="block text-[10px] font-bold text-slate-400 mt-1">{pos === 1 ? 'Next in line' : `#${pos} in line`}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-[#060606] text-sm">{p.name}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">{p.patientNo} · {p.age}{(p.gender || 'M')[0]} · {p.phone}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">{doctorTitle(p.doctorName)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-extrabold whitespace-nowrap ${statusStyle[p.status]}`}>{p.status === 'In Consultation' ? 'With doctor' : p.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {unpaid
                            ? <span className="font-extrabold text-rose-600 whitespace-nowrap">₹{(inv?.amount ?? 0).toLocaleString('en-IN')} due</span>
                            : <span className="font-bold text-emerald-700 whitespace-nowrap">{(inv?.amount ?? 0) > 0 ? `₹${inv!.amount.toLocaleString('en-IN')}` : 'Free'}{inv?.paymentMode ? ` · ${inv.paymentMode}` : ''}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-semibold whitespace-nowrap">{p.status === 'Completed' ? '—' : formatWait(p.createdAt, now)}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-1">
                            {unpaid && (
                              <button type="button" onClick={() => setCollectTarget(p)} className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap">
                                <CreditCard size={13} /> Collect ₹{(inv?.amount ?? 0).toLocaleString('en-IN')}
                              </button>
                            )}
                            <button type="button" onClick={() => setSlip(slipFor(p))} title="Print token slip" className="h-8 w-8 rounded-lg hover:bg-[#EBF3FE] text-[#3683F8] inline-flex items-center justify-center">
                              <Printer size={15} />
                            </button>
                            {p.status === 'Waiting' && (
                              <button type="button" onClick={() => cancelVisit(p)} title="Cancel check-in" className="h-8 w-8 rounded-lg hover:bg-rose-50 text-rose-600 inline-flex items-center justify-center">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-14 text-center">
                        <Users size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-sm font-bold text-slate-400">
                          {todays.length === 0 ? 'No patients registered yet today.' : query ? 'No patients match your search.' : 'No patients in this list.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Patient detail */}
      <Modal isOpen={!!detailLive} onClose={() => setDetail(null)} title={detailLive ? `${detailLive.name} · ${detailLive.tokenNumber}` : ''} className="max-w-lg">
        {detailLive && (() => {
          const inv = invoiceFor(detailLive);
          const unpaid = isVisitUnpaid(detailLive);
          const room = roomFor(schedules, doctors.find(d => d.name === detailLive.doctorName) || { name: detailLive.doctorName });
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Patient no.', detailLive.patientNo || '—'],
                  ['Age / gender', `${detailLive.age} / ${detailLive.gender || 'Male'}`],
                  ['Phone', detailLive.phone],
                  ['Doctor', doctorTitle(detailLive.doctorName)],
                  ['Room', room || '—'],
                  ['Waiting', detailLive.status === 'Completed' ? '—' : formatWait(detailLive.createdAt, now)]
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-slate-50 border border-[#D8D8D8] px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</div>
                    <div className="font-bold truncate">{v}</div>
                  </div>
                ))}
              </div>

              {(detailLive.vitals || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(detailLive.vitals || []).map(v => (
                    <span key={v.name} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">{v.name}: {v.value}</span>
                  ))}
                </div>
              )}

              <div className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${unpaid ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{inv?.feeType || 'Consultation fee'}{inv ? ` · ${inv.id}` : ''}</div>
                  <div className={`font-extrabold ${unpaid ? 'text-rose-700' : 'text-emerald-700'}`}>
                    ₹{(inv?.amount ?? 0).toLocaleString('en-IN')} {unpaid ? 'due' : `paid${inv?.paymentMode ? ` by ${inv.paymentMode}` : ''}`}
                  </div>
                </div>
                {unpaid && (
                  <button type="button" onClick={() => setCollectTarget(detailLive)} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold">Collect fee</button>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Queue status</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Waiting', 'In Consultation', 'Completed'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(detailLive, s)}
                      className={`h-9 rounded-xl border text-xs font-bold ${detailLive.status === s ? 'bg-[#3683F8] border-[#3683F8] text-white' : 'bg-white border-[#D8D8D8] text-slate-600 hover:border-slate-400'}`}
                    >
                      {s === 'In Consultation' ? 'With doctor' : s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setSlip(slipFor(detailLive))} className="flex-1 h-10 rounded-xl border border-[#D8D8D8] text-xs font-bold text-[#3683F8] inline-flex items-center justify-center gap-1.5">
                  <Printer size={15} /> Print slip
                </button>
                {detailLive.status === 'Waiting' && (
                  <button type="button" onClick={() => cancelVisit(detailLive)} className="flex-1 h-10 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 inline-flex items-center justify-center gap-1.5">
                    <Trash2 size={15} /> Cancel check-in
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Slip preview */}
      <Modal isOpen={!!slip} onClose={() => setSlip(null)} title="Token slip" className="max-w-sm">
        {slip && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center font-mono">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">OPD token</div>
              <div className="text-4xl font-black text-[#3683F8] my-1">{slip.tokenNumber}</div>
              <div className="text-sm font-bold">{doctorTitle(slip.doctorName)}</div>
              {slip.room && <div className="text-xs text-slate-500 inline-flex items-center gap-1 mt-1"><DoorOpen size={12} /> {/room/i.test(slip.room) ? slip.room : `Room ${slip.room}`}</div>}
              <div className="mt-3 pt-3 border-t border-dashed border-slate-300 text-left text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Patient</span><span className="font-bold">{slip.patientName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Patient no.</span><span className="font-bold">{slip.patientNo}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{slip.feeType}</span><span className="font-bold">₹{slip.amount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Payment</span><span className={`font-black ${slip.paid ? 'text-emerald-600' : 'text-rose-600'}`}>{slip.paid ? `PAID${slip.paymentMode ? ` · ${slip.paymentMode}` : ''}` : 'FEE DUE'}</span></div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { printOpdSlip(slip); setSlip(null); }} className="flex-1 h-11 rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5">
                <Printer size={16} /> Print
              </button>
              <button type="button" onClick={() => setSlip(null)} className="flex-1 h-11 rounded-xl border border-[#D8D8D8] font-bold text-sm">Close</button>
            </div>
            {!autoPrint && (
              <button type="button" onClick={() => toggleAutoPrint(true)} className="w-full text-[11px] font-bold text-slate-500 hover:text-[#3683F8] inline-flex items-center justify-center gap-1">
                <CheckCircle2 size={12} /> Always print automatically after registration
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Appointment check-in */}
      <Modal isOpen={!!apptTarget} onClose={() => setApptTarget(null)} title="Check in appointment" className="max-w-sm">
        {apptTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-[#D8D8D8] p-4">
              <div className="text-sm font-extrabold">{apptTarget.patientName}</div>
              <div className="text-xs text-slate-500 font-semibold">{apptTarget.time} · {doctorTitle(apptTarget.doctorName)}</div>
              <div className="text-xs text-slate-500 font-semibold mt-1">{apptFee.feeType}: <span className="font-extrabold text-[#060606]">₹{apptFee.amount.toLocaleString('en-IN')}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setApptPayNow(true)} className={`h-10 rounded-xl border text-xs font-bold ${apptPayNow ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#D8D8D8]'}`}>Paid now</button>
              <button type="button" onClick={() => setApptPayNow(false)} className={`h-10 rounded-xl border text-xs font-bold ${!apptPayNow ? 'bg-rose-600 border-rose-600 text-white' : 'border-[#D8D8D8]'}`}>Pay later</button>
            </div>
            {apptPayNow && apptFee.amount > 0 && <PaymentModePicker value={apptMode} onChange={setApptMode} />}
            <button type="button" disabled={apptBusy} onClick={confirmApptCheckIn} className="w-full h-11 rounded-xl bg-[#3683F8] hover:bg-blue-600 disabled:opacity-60 text-white font-extrabold text-sm">
              {apptBusy ? 'Checking in…' : 'Check in & issue token'}
            </button>
          </div>
        )}
      </Modal>

      <CollectFeeModal
        open={!!collectTarget}
        onClose={() => setCollectTarget(null)}
        patientName={collectTarget?.name || ''}
        amount={collectTarget ? invoiceFor(collectTarget)?.amount ?? fees?.opdFee ?? 0 : 0}
        feeType={collectTarget ? invoiceFor(collectTarget)?.feeType || 'OPD Consultation Fee' : ''}
        onConfirm={confirmCollect}
      />

      <VitalsModal
        isOpen={isVitalsOpen}
        onClose={() => setIsVitalsOpen(false)}
        onSave={(v, dx) => { setVitals(v); setPastDiagnoses(dx); }}
        initialVitals={vitals}
        initialPastDiagnoses={pastDiagnoses}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
