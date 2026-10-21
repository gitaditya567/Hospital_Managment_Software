import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, Plus, Phone, Clock, CheckCircle2, XCircle, UserX, RotateCcw, CalendarDays, Search, AlertTriangle, X
} from 'lucide-react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { Appointment, PaymentMode } from '../../store/useHospitalStore';
import { Modal } from '../../components/ui/Modal';
import { doctorTitle } from '../../lib/utils';
import {
  PaymentModePicker, PersonPicker, ToastStack, feeOptionsFor, peopleForPhone, printOpdSlip, roomFor,
  slotsFor, timeToMinutes, toYMD, useToasts
} from './reception/receptionShared';

const DAYS_AHEAD = 15;

const statusStyle: Record<Appointment['status'], string> = {
  'Booked': 'bg-[#EBF3FE] text-[#3683F8] border-blue-200',
  'Checked In': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Cancelled': 'bg-slate-100 text-slate-500 border-slate-200',
  'No Show': 'bg-amber-50 text-amber-700 border-amber-200'
};

const fromYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

interface FormState {
  phone: string;
  personKey: string;
  name: string;
  age: string;
  gender: string;
  doctorId: string;
  date: string;
  time: string;
  notes: string;
}

export function ReceptionistAppointments() {
  const {
    patients, staff, schedules, fees, appointments,
    fetchAppointments, bookAppointment, updateAppointment, checkInAppointment
  } = useHospitalStore();
  const { toasts, push, dismiss } = useToasts();

  const doctors = useMemo(() => staff.filter(s => s.role === 'Doctor' && s.status === 'Active'), [staff]);
  const today = toYMD(new Date());
  const lastDay = toYMD(new Date(Date.now() + (DAYS_AHEAD - 1) * 86400000));

  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  }), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [doctorFilter, setDoctorFilter] = useState('All');
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAppointments(today, lastDay);
  }, [fetchAppointments, today, lastDay]);

  const bookedOn = (ymd: string) => appointments.filter(a => a.date === ymd && a.status === 'Booked').length;

  const list = appointments
    .filter(a => a.date === selectedDate)
    .filter(a => doctorFilter === 'All' || a.doctorName === doctorFilter)
    .filter(a => showClosed || a.status === 'Booked' || a.status === 'Checked In')
    .filter(a => {
      const q = search.trim().toLowerCase();
      return !q || a.patientName.toLowerCase().includes(q) || a.phone.includes(q);
    })
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  // ───────── Book / reschedule form ─────────
  const emptyForm = (): FormState => ({
    phone: '', personKey: 'new', name: '', age: '', gender: 'Male',
    doctorId: doctors[0]?.id || '', date: selectedDate, time: '', notes: ''
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const knownPeople = useMemo(() => peopleForPhone(patients, form.phone), [patients, form.phone]);
  const formDoctor = doctors.find(d => d.id === form.doctorId);
  const formSchedule = schedules.find(s => s.doctorId === form.doctorId || s.doctorName === formDoctor?.name);
  const { slots, worksThatDay, hoursLabel } = slotsFor(formSchedule, fromYMD(form.date));
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const takenSlots = new Set(
    appointments
      .filter(a => a.date === form.date && a.doctorName === formDoctor?.name && a.status === 'Booked' && a.id !== editing?.id)
      .map(a => a.time)
  );

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const openBook = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setFormOpen(true);
  };

  const openReschedule = (a: Appointment) => {
    setEditing(a);
    setForm({
      phone: a.phone, personKey: 'new', name: a.patientName, age: String(a.age), gender: a.gender,
      doctorId: doctors.find(d => d.name === a.doctorName)?.id || doctors[0]?.id || '',
      date: a.date < today ? today : a.date, time: a.time, notes: a.notes || ''
    });
    setFormError('');
    setFormOpen(true);
  };

  // Phone lookup pre-fills the most recent patient on this number
  useEffect(() => {
    if (editing || form.phone.length !== 10) return;
    const person = knownPeople[0];
    if (person) set({ personKey: person.key, name: person.name, age: String(person.age), gender: person.gender });
    else set({ personKey: 'new' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.phone.length === 10 ? form.phone : '']);

  const choosePerson = (key: string) => {
    const person = knownPeople.find(p => p.key === key);
    set(person
      ? { personKey: key, name: person.name, age: String(person.age), gender: person.gender }
      : { personKey: 'new', name: '', age: '', gender: 'Male' });
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!editing) {
      if (form.phone.length !== 10) return setFormError('Enter a 10-digit mobile number.');
      if (!form.name.trim()) return setFormError('Enter the patient name.');
      if (!form.age || Number(form.age) < 0 || Number(form.age) > 120) return setFormError('Enter a valid age (0–120).');
    }
    if (!formDoctor) return setFormError('Choose a doctor.');
    if (!form.time) return setFormError('Choose a time slot.');

    setSaving(true);
    try {
      if (editing) {
        await updateAppointment(editing.id, { date: form.date, time: form.time, doctorId: formDoctor.id, doctorName: formDoctor.name, notes: form.notes });
        push('success', `Appointment moved to ${fromYMD(form.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${form.time}.`);
      } else {
        await bookAppointment({
          patientName: form.name.trim(), phone: form.phone, age: Number(form.age), gender: form.gender,
          doctorId: formDoctor.id, doctorName: formDoctor.name, date: form.date, time: form.time, notes: form.notes
        });
        push('success', `Booked ${form.name.trim()} with ${doctorTitle(formDoctor.name)} on ${fromYMD(form.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${form.time}.`);
      }
      setSelectedDate(form.date);
      setFormOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Could not save the appointment.');
    } finally {
      setSaving(false);
    }
  };

  // ───────── Status changes ─────────
  const changeStatus = async (a: Appointment, status: Appointment['status'], label: string) => {
    if (status === 'Cancelled' && !window.confirm(`Cancel ${a.patientName}'s appointment at ${a.time}?`)) return;
    try {
      await updateAppointment(a.id, { status });
      push('success', `${a.patientName}: ${label}.`);
    } catch (err: any) {
      push('error', err?.message || 'Could not update the appointment.');
    }
  };

  // ───────── Check-in ─────────
  const [checkIn, setCheckIn] = useState<Appointment | null>(null);
  const [payNow, setPayNow] = useState(true);
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [feeKey, setFeeKey] = useState('opd');
  const [busy, setBusy] = useState(false);
  const checkInDoctor = checkIn ? doctors.find(d => d.name === checkIn.doctorName) : undefined;
  const checkInFees = feeOptionsFor(fees, checkInDoctor);
  const checkInFee = checkInFees.find(f => f.key === feeKey) || checkInFees[0];

  const openCheckIn = (a: Appointment) => {
    setCheckIn(a);
    setPayNow(true);
    setMode('Cash');
    const doc = doctors.find(d => d.name === a.doctorName);
    setFeeKey(feeOptionsFor(fees, doc).some(f => f.key === 'doctor') ? 'doctor' : 'opd');
  };

  const confirmCheckIn = async () => {
    if (!checkIn) return;
    setBusy(true);
    try {
      const visit = await checkInAppointment(checkIn.id, {
        payNow,
        fee: { amount: checkInFee.amount, feeType: checkInFee.feeType, paymentMode: mode }
      });
      const paid = visit.paymentStatus === 'Paid';
      printOpdSlip({
        tokenNumber: visit.tokenNumber, patientId: visit.id, patientNo: visit.patientNo, patientName: visit.name,
        phone: visit.phone, age: visit.age, gender: visit.gender || 'Male', doctorName: visit.doctorName,
        room: roomFor(schedules, checkInDoctor || { name: visit.doctorName }), feeType: checkInFee.feeType,
        amount: checkInFee.amount, paid, paymentMode: paid ? mode : undefined, invoiceNo: visit.invoice?.id
      });
      push('success', `${visit.name} checked in · Token ${visit.tokenNumber}${paid ? '' : ' · fee due'}`);
      setCheckIn(null);
    } catch (err: any) {
      push('error', err?.message || 'Check-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const dayAppointments = appointments.filter(a => a.date === selectedDate);
  const summary = {
    booked: dayAppointments.filter(a => a.status === 'Booked').length,
    checkedIn: dayAppointments.filter(a => a.status === 'Checked In').length,
    closed: dayAppointments.filter(a => a.status === 'Cancelled' || a.status === 'No Show').length
  };
  const isTodaySelected = selectedDate === today;

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#3683F8] p-5 sm:p-6 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><CalendarClock size={22} /> Appointments</h1>
          <p className="text-blue-50 text-xs mt-1">Book visits up to {DAYS_AHEAD} days ahead. Patients join the OPD queue when you check them in on the day.</p>
        </div>
        <button type="button" onClick={openBook} disabled={doctors.length === 0} className="h-11 px-5 rounded-xl bg-white text-[#3683F8] font-extrabold text-sm inline-flex items-center gap-2 hover:bg-blue-50 disabled:opacity-60">
          <Plus size={18} /> Book appointment
        </button>
      </div>

      {/* Date strip */}
      <div className="bg-white rounded-2xl border border-[#D8D8D8] p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map(d => {
            const ymd = toYMD(d);
            const active = ymd === selectedDate;
            const count = bookedOn(ymd);
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => setSelectedDate(ymd)}
                className={`shrink-0 w-[72px] rounded-xl border py-2 text-center transition-all ${active ? 'bg-[#060606] border-[#060606] text-white' : 'bg-white border-[#D8D8D8] hover:border-[#3683F8]'}`}
              >
                <div className={`text-[10px] font-bold uppercase ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                  {ymd === today ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}
                </div>
                <div className="text-lg font-black leading-tight">{d.getDate()}</div>
                <div className={`text-[10px] font-bold ${active ? 'text-slate-300' : 'text-slate-400'}`}>{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
                <div className={`mt-1 text-[10px] font-extrabold ${count > 0 ? (active ? 'text-[#7fb2ff]' : 'text-[#3683F8]') : 'opacity-0'}`}>{count} booked</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
        <div className="p-4 border-b border-[#D8D8D8] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold flex items-center gap-2">
              <CalendarDays size={17} className="text-[#3683F8]" />
              {fromYMD(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <p className="text-[11px] text-slate-500 font-semibold">{summary.booked} booked · {summary.checkedIn} checked in · {summary.closed} cancelled / no-show</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or phone" className="h-9 w-44 pl-8 pr-3 rounded-xl border border-[#D8D8D8] text-xs font-semibold focus:outline-none focus:border-[#3683F8]" />
            </div>
            <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="h-9 px-2 rounded-xl border border-[#D8D8D8] text-xs font-bold bg-white">
              <option value="All">All doctors</option>
              {doctors.map(d => <option key={d.id} value={d.name}>{doctorTitle(d.name)}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-pointer">
              <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="rounded border-[#D8D8D8]" />
              Show cancelled
            </label>
          </div>
        </div>

        <div className="divide-y divide-[#D8D8D8]/70">
          {list.map(a => (
            <div key={a.id} className={`p-4 flex flex-col md:flex-row md:items-center gap-3 ${a.status === 'Cancelled' ? 'opacity-60' : ''}`}>
              <div className="w-24 shrink-0">
                <div className="text-sm font-black text-[#3683F8] flex items-center gap-1"><Clock size={13} /> {a.time}</div>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${statusStyle[a.status]}`}>{a.status}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold truncate">{a.patientName} <span className="text-xs font-semibold text-slate-500">· {a.age}{(a.gender || 'M')[0]}</span></div>
                <div className="text-xs text-slate-500 font-semibold flex flex-wrap gap-x-3">
                  <span className="inline-flex items-center gap-1"><Phone size={11} /> {a.phone}</span>
                  <span>{doctorTitle(a.doctorName)}</span>
                  {a.notes && <span className="italic truncate">“{a.notes}”</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 md:justify-end">
                {a.status === 'Booked' && isTodaySelected && (
                  <button type="button" onClick={() => openCheckIn(a)} className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Check in
                  </button>
                )}
                {a.status === 'Booked' && (
                  <>
                    <button type="button" onClick={() => openReschedule(a)} className="h-9 px-3 rounded-xl border border-[#D8D8D8] text-xs font-bold text-slate-700 hover:border-[#3683F8] inline-flex items-center gap-1.5">
                      <CalendarClock size={14} /> Reschedule
                    </button>
                    {isTodaySelected && (
                      <button type="button" onClick={() => changeStatus(a, 'No Show', 'marked as no-show')} className="h-9 px-3 rounded-xl border border-[#D8D8D8] text-xs font-bold text-amber-700 hover:border-amber-400 inline-flex items-center gap-1.5">
                        <UserX size={14} /> No-show
                      </button>
                    )}
                    <button type="button" onClick={() => changeStatus(a, 'Cancelled', 'appointment cancelled')} className="h-9 px-3 rounded-xl border border-[#D8D8D8] text-xs font-bold text-rose-600 hover:border-rose-300 inline-flex items-center gap-1.5">
                      <XCircle size={14} /> Cancel
                    </button>
                  </>
                )}
                {(a.status === 'Cancelled' || a.status === 'No Show') && (
                  <button type="button" onClick={() => changeStatus(a, 'Booked', 'appointment restored')} className="h-9 px-3 rounded-xl border border-[#D8D8D8] text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <RotateCcw size={14} /> Restore
                  </button>
                )}
                {a.status === 'Checked In' && <span className="text-xs font-bold text-emerald-700">In today's OPD queue</span>}
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="py-14 text-center">
              <CalendarClock size={32} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm font-bold text-slate-400">No appointments for this day.</p>
              <button type="button" onClick={openBook} className="mt-3 text-xs font-bold text-[#3683F8]">+ Book one now</button>
            </div>
          )}
        </div>
      </div>

      {/* Book / reschedule */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Reschedule · ${editing.patientName}` : 'Book appointment'} className="max-w-xl">
        <form onSubmit={submitForm} className="space-y-4 max-h-[75vh] overflow-y-auto -mx-1 px-1">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex gap-2"><AlertTriangle size={15} className="shrink-0" /> {formError}</div>
          )}

          {!editing && (
            <div className="space-y-2">
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  inputMode="numeric"
                  placeholder="Mobile number (10 digits)"
                  value={form.phone}
                  onChange={e => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full h-11 pl-9 pr-9 rounded-xl border border-[#D8D8D8] text-sm font-mono font-bold focus:outline-none focus:border-[#3683F8]"
                />
                {form.phone && <button type="button" onClick={() => set({ phone: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Clear phone"><X size={15} /></button>}
              </div>
              {form.phone.length === 10 && knownPeople.length > 0 && <PersonPicker people={knownPeople} selectedKey={form.personKey} onSelect={choosePerson} />}
              <div className="grid grid-cols-6 gap-2">
                <input placeholder="Patient full name" value={form.name} onChange={e => set({ name: e.target.value })} className="col-span-6 sm:col-span-3 h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm font-semibold focus:outline-none focus:border-[#3683F8]" />
                <input type="number" min={0} max={120} placeholder="Age" value={form.age} onChange={e => set({ age: e.target.value })} className="col-span-2 sm:col-span-1 h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm font-semibold focus:outline-none focus:border-[#3683F8]" />
                <div className="col-span-4 sm:col-span-2 grid grid-cols-3 gap-1">
                  {['Male', 'Female', 'Other'].map(g => (
                    <button key={g} type="button" onClick={() => set({ gender: g })} className={`h-10 rounded-xl border text-[11px] font-bold ${form.gender === g ? 'bg-[#060606] text-white border-[#060606]' : 'border-[#D8D8D8] text-slate-600'}`}>{g === 'Other' ? 'Other' : g.slice(0, 4)}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Doctor</span>
              <select value={form.doctorId} onChange={e => set({ doctorId: e.target.value, time: '' })} className="w-full h-10 px-2 rounded-xl border border-[#D8D8D8] text-sm font-bold bg-white">
                {doctors.map(d => <option key={d.id} value={d.id}>{doctorTitle(d.name)} · {d.department || 'General'}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Date</span>
              <input type="date" min={today} max={lastDay} value={form.date} onChange={e => set({ date: e.target.value, time: '' })} className="w-full h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm font-bold" />
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Time slot</span>
              <span className="text-[11px] font-semibold text-slate-400">OPD hours: {hoursLabel}</span>
            </div>
            {!worksThatDay && (
              <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                {formDoctor ? doctorTitle(formDoctor.name) : 'This doctor'} is not scheduled on this day ({formSchedule?.days}). You can still book if needed.
              </p>
            )}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
              {slots.map(slot => {
                const past = form.date === today && timeToMinutes(slot) <= nowMinutes;
                const taken = takenSlots.has(slot);
                const active = form.time === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={past || taken}
                    onClick={() => set({ time: slot })}
                    title={taken ? 'Already booked' : past ? 'Time has passed' : ''}
                    className={`h-9 rounded-lg border text-[11px] font-bold transition-all ${active ? 'bg-[#3683F8] border-[#3683F8] text-white' : taken ? 'bg-slate-100 border-slate-200 text-slate-300 line-through' : past ? 'border-slate-100 text-slate-300' : 'border-[#D8D8D8] text-slate-700 hover:border-[#3683F8]'}`}
                  >
                    {slot.replace(' AM', 'a').replace(' PM', 'p')}
                  </button>
                );
              })}
            </div>
          </div>

          <input placeholder="Note (optional) — e.g. follow-up, reports to bring" value={form.notes} onChange={e => set({ notes: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm focus:outline-none focus:border-[#3683F8]" />

          <button type="submit" disabled={saving} className="w-full h-11 rounded-xl bg-[#3683F8] hover:bg-blue-600 disabled:opacity-60 text-white font-extrabold text-sm">
            {saving ? 'Saving…' : editing ? 'Save new time' : form.time ? `Book for ${form.time}` : 'Book appointment'}
          </button>
        </form>
      </Modal>

      {/* Check-in */}
      <Modal isOpen={!!checkIn} onClose={() => setCheckIn(null)} title="Check in appointment" className="max-w-sm">
        {checkIn && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-[#D8D8D8] p-4">
              <div className="text-sm font-extrabold">{checkIn.patientName}</div>
              <div className="text-xs text-slate-500 font-semibold">{checkIn.time} · {doctorTitle(checkIn.doctorName)}</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {checkInFees.map(f => (
                <button key={f.key} type="button" onClick={() => setFeeKey(f.key)} className={`text-left px-2.5 py-2 rounded-xl border text-xs font-bold ${feeKey === f.key ? 'border-[#3683F8] bg-[#EBF3FE]' : 'border-[#D8D8D8] text-slate-600'}`}>
                  <span className="block truncate">{f.label}</span><span className="text-[#3683F8]">₹{f.amount.toLocaleString('en-IN')}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setPayNow(true)} className={`h-10 rounded-xl border text-xs font-bold ${payNow ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#D8D8D8]'}`}>Paid now</button>
              <button type="button" onClick={() => setPayNow(false)} className={`h-10 rounded-xl border text-xs font-bold ${!payNow ? 'bg-rose-600 border-rose-600 text-white' : 'border-[#D8D8D8]'}`}>Pay later</button>
            </div>
            {payNow && checkInFee.amount > 0 && <PaymentModePicker value={mode} onChange={setMode} />}
            <button type="button" disabled={busy} onClick={confirmCheckIn} className="w-full h-11 rounded-xl bg-[#3683F8] hover:bg-blue-600 disabled:opacity-60 text-white font-extrabold text-sm">
              {busy ? 'Checking in…' : 'Check in & print token'}
            </button>
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
