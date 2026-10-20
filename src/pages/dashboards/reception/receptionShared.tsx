import { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Smartphone, UserPlus, Check, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { DoctorSchedule, PatientRecord, PaymentMode, StaffMember, StandardFees } from '../../../store/useHospitalStore';
import { Modal } from '../../../components/ui/Modal';
import { doctorTitle } from '../../../lib/utils';
import { printIsolatedHtml } from '../../../utils/printHelper';
import { buildOpdQueueSlipHtml } from '../../../utils/thermalSlipTemplates';

// ───────── Dates ─────────

export const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const invoiceDateLabel = (d = new Date()) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

export const formatWait = (iso?: string, now = Date.now()) => {
  if (!iso) return '—';
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

// Re-renders every `ms` so relative times stay fresh
export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ───────── Fees & rooms ─────────

export interface FeeOption {
  key: string;
  label: string;
  feeType: string;
  amount: number;
}

export function feeOptionsFor(fees: StandardFees | undefined, doctor?: StaffMember): FeeOption[] {
  const opd = fees?.opdFee ?? 500;
  const options: FeeOption[] = [
    { key: 'opd', label: 'OPD consultation', feeType: 'OPD Consultation Fee', amount: opd }
  ];
  if (doctor?.consultationFee && doctor.consultationFee !== opd) {
    options.push({ key: 'doctor', label: `${doctorTitle(doctor.name)} fee`, feeType: 'Specialist Consultation Fee', amount: doctor.consultationFee });
  }
  options.push(
    { key: 'emergency', label: 'Emergency', feeType: 'Emergency Consultation Fee', amount: fees?.emergencyFee ?? 1200 },
    { key: 'followup', label: 'Free follow-up', feeType: 'Follow-up Visit (Free)', amount: 0 }
  );
  return options;
}

export function roomFor(schedules: DoctorSchedule[], doctor?: { id?: string; name?: string }) {
  if (!doctor) return '';
  const s = schedules.find(x => (doctor.id && x.doctorId === doctor.id) || (doctor.name && x.doctorName === doctor.name));
  return s?.roomNumber || '';
}

// ───────── People sharing one phone number ─────────

export interface KnownPerson {
  key: string;
  name: string;
  age: number;
  gender: string;
  patientNo?: string;
  lastVisit?: string;
}

// Distinct people (by name) who have visited with this phone number, most recent first
export function peopleForPhone(patients: PatientRecord[], phone: string): KnownPerson[] {
  if (phone.length !== 10) return [];
  const map = new Map<string, KnownPerson>();
  [...patients]
    .filter(p => p.phone === phone)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .forEach(p => {
      const key = p.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { key, name: p.name, age: p.age, gender: p.gender || 'Male', patientNo: p.patientNo, lastVisit: p.createdAt });
      }
    });
  return [...map.values()];
}

export function PersonPicker({ people, selectedKey, onSelect }: { people: KnownPerson[]; selectedKey: string; onSelect: (key: string) => void }) {
  if (people.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-emerald-700">
        {people.length === 1 ? 'Returning patient found on this number' : `${people.length} patients use this number — choose one`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {people.map(person => (
          <button
            key={person.key}
            type="button"
            onClick={() => onSelect(person.key)}
            className={`text-left px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${selectedKey === person.key ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-400'}`}
          >
            {person.name} <span className="font-semibold opacity-80">· {person.age}{person.gender?.[0] || ''}</span>
            {person.patientNo && <span className="block text-[10px] font-mono opacity-80">{person.patientNo}</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelect('new')}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition-all ${selectedKey === 'new' ? 'bg-[#3683F8] border-[#3683F8] text-white' : 'bg-white border-[#D8D8D8] text-slate-600 hover:border-[#3683F8]'}`}
        >
          <UserPlus size={13} /> New person
        </button>
      </div>
    </div>
  );
}

// ───────── Payment ─────────

const MODES: Array<{ mode: PaymentMode; icon: typeof Banknote }> = [
  { mode: 'Cash', icon: Banknote },
  { mode: 'UPI', icon: Smartphone },
  { mode: 'Card', icon: CreditCard }
];

export function PaymentModePicker({ value, onChange, disabled }: { value: PaymentMode; onChange: (m: PaymentMode) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {MODES.map(({ mode, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={`h-9 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${value === mode ? 'bg-[#060606] border-[#060606] text-white' : 'bg-white border-[#D8D8D8] text-slate-600 hover:border-slate-400'}`}
        >
          <Icon size={14} /> {mode}
        </button>
      ))}
    </div>
  );
}

export function CollectFeeModal({
  open, onClose, patientName, amount, feeType, onConfirm
}: {
  open: boolean;
  onClose: () => void;
  patientName: string;
  amount: number;
  feeType: string;
  onConfirm: (mode: PaymentMode) => Promise<void>;
}) {
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setMode('Cash'); setBusy(false); }
  }, [open]);

  return (
    <Modal isOpen={open} onClose={onClose} title="Collect fee" className="max-w-sm">
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-50 border border-[#D8D8D8] p-4">
          <div className="text-xs text-slate-500 font-semibold">{patientName}</div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-slate-700">{feeType}</span>
            <span className="text-2xl font-black">₹{amount.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Payment received by</span>
          <PaymentModePicker value={mode} onChange={setMode} />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(mode); } finally { setBusy(false); } }}
          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
        >
          <Check size={16} /> {busy ? 'Saving…' : `Mark ₹${amount.toLocaleString('en-IN')} as received`}
        </button>
      </div>
    </Modal>
  );
}

// ───────── Slip printing ─────────

export interface SlipData {
  tokenNumber: string;
  patientId: string;
  patientNo?: string;
  patientName: string;
  phone: string;
  age: number | string;
  gender: string;
  doctorName: string;
  room?: string;
  feeType: string;
  amount: number;
  paid: boolean;
  paymentMode?: string;
  invoiceNo?: string;
  date?: string;
}

export function printOpdSlip(slip: SlipData) {
  const html = buildOpdQueueSlipHtml({
    tokenNumber: slip.tokenNumber,
    patientName: slip.patientName,
    patientId: slip.patientId,
    patientNo: slip.patientNo,
    age: slip.age,
    gender: slip.gender,
    phone: slip.phone,
    doctorName: slip.doctorName,
    feeType: slip.feeType,
    amount: slip.amount,
    date: slip.date || invoiceDateLabel(),
    billNo: slip.invoiceNo || slip.patientNo,
    paymentStatus: slip.paid ? 'Paid' : 'Due',
    paymentMode: slip.paid ? slip.paymentMode : undefined,
    footerText: slip.room ? `Please wait outside ${/room/i.test(slip.room) ? slip.room : `Room ${slip.room}`} until your token is called` : 'Please wait until your token number is called'
  });
  printIsolatedHtml('OPD Token Slip', html);
}

// ───────── Toasts ─────────

export interface Toast { id: number; tone: 'success' | 'error'; text: string }

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, tone, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'error' ? 6000 : 3500);
  };
  const dismiss = (id: number) => setToasts(t => t.filter(x => x.id !== id));
  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-[60] space-y-2 w-[min(360px,calc(100vw-2.5rem))]">
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-xl text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 ${t.tone === 'success' ? 'bg-white border-emerald-200 text-emerald-800' : 'bg-white border-rose-200 text-rose-700'}`}
        >
          {t.tone === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-500" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-500" />}
          <span className="flex-1">{t.text}</span>
          <button type="button" onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

// Patients who are still unpaid for this visit
export const isVisitUnpaid = (p: PatientRecord) => p.paymentStatus === 'Unpaid' || p.paymentStatus === 'Pending';

export function useDoctorLoad(patients: PatientRecord[]) {
  return useMemo(() => {
    const load: Record<string, number> = {};
    patients.forEach(p => {
      if (isToday(p.createdAt) && p.status === 'Waiting') load[p.doctorName] = (load[p.doctorName] || 0) + 1;
    });
    return load;
  }, [patients]);
}

// ───────── Appointment slots ─────────

export const timeToMinutes = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(t.trim());
  if (!m) return 0;
  let h = parseInt(m[1], 10) % 12;
  if (m[3] && m[3].toUpperCase() === 'PM') h += 12;
  if (!m[3] && parseInt(m[1], 10) === 12) h = 12;
  return h * 60 + parseInt(m[2], 10);
};

export const minutesToTime = (mins: number) => {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
};

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Reads a doctor's schedule ("10:00 AM - 02:00 PM", "Mon, Wed, Fri") into bookable 15-minute slots
export function slotsFor(schedule: DoctorSchedule | undefined, date: Date): { slots: string[]; worksThatDay: boolean; hoursLabel: string } {
  let start = 9 * 60;
  let end = 20 * 60;
  let hoursLabel = '9:00 AM – 8:00 PM';
  let worksThatDay = true;

  if (schedule) {
    const times = (schedule.availability || '').match(/\d{1,2}:\d{2}\s*(?:AM|PM)?/gi);
    if (times && times.length >= 2) {
      const s = timeToMinutes(times[0]);
      const e = timeToMinutes(times[1]);
      if (e > s) { start = s; end = e; hoursLabel = `${times[0]} – ${times[1]}`; }
    }
    const days = (schedule.days || '').toLowerCase();
    if (days && !/daily|all|every|mon\s*-\s*sun/.test(days)) {
      const dayName = DAY_NAMES[date.getDay()];
      const listed = DAY_NAMES.filter(d => days.includes(d));
      if (/mon\s*-\s*sat/.test(days)) worksThatDay = date.getDay() !== 0;
      else if (/mon\s*-\s*fri/.test(days)) worksThatDay = date.getDay() !== 0 && date.getDay() !== 6;
      else if (listed.length > 0) worksThatDay = listed.includes(dayName);
    }
  }

  const slots: string[] = [];
  for (let m = start; m + 15 <= end; m += 15) slots.push(minutesToTime(m));
  return { slots, worksThatDay, hoursLabel };
}
