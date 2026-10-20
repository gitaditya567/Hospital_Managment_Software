import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Stethoscope, Pill, Users, Receipt, ChartColumn, ShieldCheck, Lock, Printer, Mic,
  Building2, CalendarClock, ClipboardList, Boxes, BellRing, ArrowRight, Check, CheckCircle2, Menu, X,
  ChevronDown, HeartPulse, Cloud, Smartphone, KeyRound, Database, FileText, Wallet, Clock,
  LayoutDashboard, Zap, Mail, Search, UserCheck, TrendingUp
} from 'lucide-react';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useAuthStore } from '../../store/useAuthStore';

interface PublicPlan {
  id: string;
  name: string;
  price: number;
  maxDoctors: number;
  maxReceptionists: number;
  maxPharmacists: number;
  maxStorage: number;
  durationMonths: number;
}

const limit = (n: number, noun: string) => (n === -1 ? `Unlimited ${noun}s` : `${n} ${noun}${n === 1 ? '' : 's'}`);

const roleHome: Record<string, string> = {
  SUPER_ADMIN: '/super-admin',
  HOSPITAL_ADMIN: '/hospital-admin',
  RECEPTIONIST: '/receptionist',
  DOCTOR: '/doctor',
  PHARMACY: '/pharmacy'
};

const MODULES = [
  {
    icon: UserCheck,
    tag: 'Front Desk',
    title: 'Reception & OPD Queue',
    text: 'Register a patient in seconds and send them straight into the right doctor\'s live queue.',
    points: [
      'Phone-number auto-lookup for returning patients',
      'Unique patient number (PAT-xxxx) kept for life',
      'Daily OPD tokens per doctor that reset every morning',
      'Collect consultation fee before check-in (no unpaid queue)',
      'Record vitals — BP, heart rate, temperature, SpO₂, sugar, weight',
      'Book future appointments by date and time slot'
    ]
  },
  {
    icon: Stethoscope,
    tag: 'Doctor',
    title: 'Doctor Workspace',
    text: 'A focused, full-screen consultation desk with the whole patient history one click away.',
    points: [
      'Live FIFO queue of today\'s paid patients',
      'Voice-to-text prescriptions (Indian English & Hinglish)',
      'Medicine, dosage and duration builder',
      'Previous visits, prescriptions and pharmacy bills',
      'Search any patient by name, phone or patient number',
      'Profile with consultation fee, registration no. and signature'
    ]
  },
  {
    icon: Pill,
    tag: 'Pharmacy',
    title: 'Pharmacy & Inventory',
    text: 'Prescriptions arrive at the pharmacy automatically — dispense, bill and update stock in one step.',
    points: [
      'E-prescription inbox: look up by Rx code, phone or patient no.',
      'Point-of-sale billing with Cash, Card and UPI',
      'Stock is deducted automatically on every sale',
      'Batch numbers, rack location and expiry tracking',
      'Low-stock and expiring-in-30-days alerts',
      'Restock entries with supplier and batch details'
    ]
  },
  {
    icon: Building2,
    tag: 'Hospital Admin',
    title: 'Hospital Administration',
    text: 'Set up your hospital once, then manage staff, departments and fees from a single dashboard.',
    points: [
      'Create Doctor, Receptionist and Pharmacist logins',
      'Role-change history for every staff member',
      'Departments, wings, beds and room allocation',
      'Doctor schedules with room and available days',
      'OPD, emergency and bed-charge fee configuration',
      'Hospital name, logo and contact branding'
    ]
  },
  {
    icon: Wallet,
    tag: 'Finance',
    title: 'Billing, Accounts & Analytics',
    text: 'Every rupee collected at the front desk and pharmacy lands in one ledger you can filter and print.',
    points: [
      'Sequential invoice numbers (INV-1001, INV-1002 …)',
      'Pending vs. collected fee tracking',
      'Master ledger across OPD and pharmacy sales',
      'Revenue by department and patient footfall charts',
      'Date-wise filters, search and printable reports',
      'Subscription status, plan usage and renewal in-app'
    ]
  },
  {
    icon: Printer,
    tag: 'Printing',
    title: 'Thermal Slips & Prints',
    text: 'Print-ready slips sized for 80 mm thermal printers or regular A4 paper.',
    points: [
      'OPD token slip for the patient',
      'OPD billing receipt',
      'Pharmacy bill with itemised medicines',
      'Prescription print with doctor details',
      'Custom logo, colours, font size and spacing',
      'Patient record print from the directory'
    ]
  }
];

const FLOW = [
  { icon: UserCheck, label: 'Reception', sub: 'Register & collect fee' },
  { icon: ClipboardList, label: 'OPD Queue', sub: 'Token issued' },
  { icon: Stethoscope, label: 'Doctor', sub: 'Consult & prescribe' },
  { icon: Pill, label: 'Pharmacy', sub: 'Dispense & bill' },
  { icon: ChartColumn, label: 'Admin', sub: 'Ledger & analytics' }
];

const SECURITY = [
  { icon: Database, title: 'Isolated hospital data', text: 'Every request is locked to your own hospital on the server. No other hospital can ever read or change your records.' },
  { icon: KeyRound, title: 'Role-based access', text: 'Doctors, receptionists, pharmacists and admins each see only the tools they need. Staff cannot change settings or fees.' },
  { icon: Lock, title: 'Encrypted passwords & sessions', text: 'Passwords are hashed with bcrypt, sessions use signed tokens, and repeated wrong logins trigger a 5-minute lockout.' },
  { icon: ShieldCheck, title: 'Audit trail', text: 'Role changes, password resets and subscription events are logged, with e-mail alerts to the hospital admin.' }
];

const FAQS = [
  { q: 'Do I need to install anything?', a: 'No. The software runs in any modern browser on desktop, laptop or tablet. Your data is stored securely in the cloud, so every counter in your hospital sees the same live information.' },
  { q: 'How does the free trial work?', a: 'Register your hospital and you are signed in immediately on a free trial with all features of the plan you choose. No card is required. Before the trial ends you can activate a paid plan with a license key.' },
  { q: 'What happens when my subscription ends?', a: 'Your data is never deleted. Staff logins pause, while the hospital admin can still sign in, view records and renew the plan with a new license key — everything resumes instantly.' },
  { q: 'How many staff accounts can I create?', a: 'It depends on your plan. Each plan has a limit for doctors, receptionists and pharmacists; the Enterprise plan is unlimited. You can upgrade at any time.' },
  { q: 'Can patients be shared between two hospitals?', a: 'No. Each hospital is a separate, isolated account. Patient numbers, invoices and stock are private to your hospital.' },
  { q: 'Does it work with thermal printers?', a: 'Yes. Token slips, OPD receipts, prescriptions and pharmacy bills are formatted for 80 mm thermal printers, and also print cleanly on A4.' },
  { q: 'I already received a license key from your team. What do I do?', a: 'Choose "I have a license key" on the registration page and enter it. Your hospital is activated on that paid plan straight away.' }
];

export function Home() {
  const { settings, loadPublicConfig } = useSuperAdminStore();
  const { isAuthenticated, user } = useAuthStore();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const platformName = settings?.platformName && !settings.platformName.includes('Central')
    ? settings.platformName
    : 'Smart Hospital Management Software';
  const trialDays = settings?.trialDays || 14;
  const allowSignup = settings?.allowSelfSignup !== false;
  const dashboardPath = user?.role ? roleHome[user.role] : '/login';

  useEffect(() => {
    document.title = `${platformName} — Cloud Hospital Management`;
  }, [platformName]);

  useEffect(() => {
    loadPublicConfig();
    fetch('/api/public/plans')
      .then(res => (res.ok ? res.json() : []))
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoaded(true));
  }, [loadPublicConfig]);

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#workflow', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' }
  ];

  const highlightIndex = plans.length >= 3 ? 1 : -1;

  return (
    <div className="min-h-screen bg-white text-[#060606] font-sans">
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#D8D8D8]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-[#3683F8] text-white flex items-center justify-center font-black text-lg shadow-md shadow-[#3683F8]/30 shrink-0">✚</div>
            <span className="font-extrabold tracking-tight text-sm sm:text-base truncate">{platformName}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="hover:text-[#3683F8] transition-colors">{link.label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <Link to={dashboardPath} className="h-10 px-5 inline-flex items-center gap-2 rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white text-sm font-bold shadow-md shadow-[#3683F8]/25 transition-colors">
                Open Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="h-10 px-4 inline-flex items-center rounded-xl text-sm font-bold text-slate-700 hover:text-[#3683F8] transition-colors">Sign in</Link>
                {allowSignup && (
                  <Link to="/register" className="h-10 px-5 inline-flex items-center gap-2 rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white text-sm font-bold shadow-md shadow-[#3683F8]/25 transition-colors">
                    Start free trial <ArrowRight size={16} />
                  </Link>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-xl border border-[#D8D8D8]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-[#D8D8D8] bg-white px-4 py-4 space-y-1">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-semibold text-slate-700">{link.label}</a>
            ))}
            <div className="pt-3 grid grid-cols-2 gap-2">
              {isAuthenticated ? (
                <Link to={dashboardPath} className="col-span-2 h-11 inline-flex items-center justify-center rounded-xl bg-[#3683F8] text-white text-sm font-bold">Open Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="h-11 inline-flex items-center justify-center rounded-xl border border-[#D8D8D8] text-sm font-bold">Sign in</Link>
                  <Link to="/register" className="h-11 inline-flex items-center justify-center rounded-xl bg-[#3683F8] text-white text-sm font-bold">Free trial</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#EBF3FE]">
        <div className="absolute inset-0 bg-[radial-gradient(#3683F8_1px,transparent_1px)] [background-size:26px_26px] opacity-[0.12] pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-[520px] h-[520px] bg-[#3683F8]/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#3683F8] bg-white border border-blue-200 px-3 py-1.5 rounded-full">
              <Cloud size={14} /> Cloud hospital software · Made for Indian hospitals
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black leading-[1.08] tracking-tight">
              Run your entire hospital from <span className="text-[#3683F8]">one secure dashboard</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              OPD registration, live doctor queues, voice e-prescriptions, pharmacy billing with automatic stock updates, and complete
              accounts — connected in real time for every counter in your hospital or clinic.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {allowSignup && (
                <Link to="/register" className="h-12 px-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white font-extrabold shadow-lg shadow-[#3683F8]/30 transition-all hover:-translate-y-0.5">
                  Start {trialDays}-day free trial <ArrowRight size={18} />
                </Link>
              )}
              <a href="#features" className="h-12 px-7 inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#D8D8D8] hover:border-[#3683F8] text-[#060606] font-bold transition-colors">
                Explore features
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-600">
              {['No credit card required', 'Set up in 5 minutes', 'Works on any device'].map(item => (
                <li key={item} className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> {item}</li>
              ))}
            </ul>
          </div>

          {/* Product preview */}
          <div className="relative">
            <div className="bg-white rounded-3xl border border-[#D8D8D8] shadow-2xl shadow-[#3683F8]/15 overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#D8D8D8] bg-slate-50">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-[11px] font-bold text-slate-400">Today's Live Doctor Queue</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Waiting', value: '12', color: 'text-amber-600 bg-amber-50 border-amber-100' },
                    { label: 'In consult', value: '2', color: 'text-[#3683F8] bg-[#EBF3FE] border-blue-100' },
                    { label: 'Completed', value: '34', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
                  ].map(stat => (
                    <div key={stat.label} className={`rounded-2xl border p-3 ${stat.color}`}>
                      <div className="text-2xl font-black">{stat.value}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { token: 'OPD-101', name: 'Ramesh Kumar', meta: '45 Y · Male · Paid', status: 'In consultation', tone: 'bg-[#3683F8] text-white' },
                    { token: 'OPD-102', name: 'Sunita Verma', meta: '32 Y · Female · Paid', status: 'Waiting', tone: 'bg-amber-100 text-amber-700' },
                    { token: 'OPD-103', name: 'Mohd. Arif', meta: '58 Y · Male · Paid', status: 'Waiting', tone: 'bg-amber-100 text-amber-700' }
                  ].map(row => (
                    <div key={row.token} className="flex items-center gap-3 p-3 rounded-2xl border border-[#D8D8D8]">
                      <div className="h-10 w-14 rounded-xl bg-[#060606] text-white text-[11px] font-black flex items-center justify-center shrink-0">{row.token}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate">{row.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{row.meta}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${row.tone}`}>{row.status}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#EBF3FE] border border-blue-100">
                  <div className="h-9 w-9 rounded-xl bg-[#3683F8] text-white flex items-center justify-center shrink-0"><Mic size={18} /></div>
                  <div className="text-xs font-semibold text-slate-700 leading-snug">
                    “Tab Paracetamol 650, one tablet twice daily for five days…”
                    <span className="block text-[10px] text-[#3683F8] font-bold mt-0.5">Voice prescription · converting to Rx</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex absolute -bottom-6 -left-6 bg-white border border-[#D8D8D8] rounded-2xl shadow-xl px-4 py-3 items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Receipt size={18} /></div>
              <div>
                <div className="text-xs font-black">INV-1048 · ₹500 collected</div>
                <div className="text-[10px] text-slate-500 font-semibold">Thermal slip printed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value strip */}
      <section className="border-b border-[#D8D8D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: LayoutDashboard, title: '5 role-based workspaces', text: 'Admin, reception, doctor, pharmacy & platform operator' },
            { icon: Zap, title: 'Real-time sync', text: 'Every counter sees the same live queue and stock' },
            { icon: Smartphone, title: 'Any device', text: 'Desktop, laptop or tablet — just open the browser' },
            { icon: HeartPulse, title: 'Built for OPD speed', text: 'Patient check-in to OPD token in a few clicks' }
          ].map(item => (
            <div key={item.title} className="flex gap-3">
              <div className="h-11 w-11 rounded-2xl bg-[#EBF3FE] text-[#3683F8] flex items-center justify-center shrink-0"><item.icon size={20} /></div>
              <div>
                <div className="text-sm font-extrabold">{item.title}</div>
                <div className="text-xs text-slate-500 font-medium leading-relaxed">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features / modules */}
      <section id="features" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Everything in one place</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Every department, fully connected</h2>
          <p className="text-slate-600 mt-3 leading-relaxed">
            Each staff member gets a dedicated workspace. A patient registered at reception appears in the doctor's queue,
            the prescription reaches the pharmacy, and every payment lands in the admin's ledger — automatically.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map(mod => (
            <article key={mod.title} className="group rounded-3xl border border-[#D8D8D8] p-6 hover:border-[#3683F8] hover:shadow-xl hover:shadow-[#3683F8]/10 transition-all bg-white">
              <div className="flex items-center justify-between mb-5">
                <div className="h-12 w-12 rounded-2xl bg-[#EBF3FE] text-[#3683F8] group-hover:bg-[#3683F8] group-hover:text-white flex items-center justify-center transition-colors">
                  <mod.icon size={22} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{mod.tag}</span>
              </div>
              <h3 className="text-lg font-extrabold">{mod.title}</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{mod.text}</p>
              <ul className="mt-5 space-y-2.5">
                {mod.points.map(point => (
                  <li key={point} className="flex gap-2.5 text-sm text-slate-700">
                    <Check size={16} className="text-[#3683F8] shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="scroll-mt-20 bg-gradient-to-br from-[#060606] via-[#101928] to-[#0A1424] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">How it works</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2 text-white">From the front desk to the pharmacy counter</h2>
            <p className="text-slate-300 mt-3 leading-relaxed">One patient journey, zero paper slips passed by hand.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {FLOW.map((step, i) => (
              <div key={step.label} className="relative">
                <div className="h-full rounded-2xl bg-white/5 border border-white/10 p-5">
                  <div className="text-[10px] font-black text-[#3683F8] mb-3">STEP {i + 1}</div>
                  <step.icon size={24} className="text-white mb-3" />
                  <div className="font-extrabold text-white">{step.label}</div>
                  <div className="text-xs text-slate-400 font-medium mt-1">{step.sub}</div>
                </div>
                {i < FLOW.length - 1 && (
                  <ArrowRight size={18} className="hidden sm:block absolute top-1/2 -right-3 -translate-y-1/2 text-[#3683F8] z-10" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {[
              { icon: Building2, title: '1. Register your hospital', text: 'Enter your hospital details and create the admin login. You are inside the dashboard in under a minute.' },
              { icon: Users, title: '2. Add staff & set fees', text: 'Create logins for doctors, receptionists and pharmacists, add departments and set your OPD fees.' },
              { icon: Activity, title: '3. Start your OPD', text: 'Reception registers the first patient and the token appears instantly on the doctor\'s screen.' }
            ].map(step => (
              <div key={step.title} className="flex gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#3683F8] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#3683F8]/30"><step.icon size={22} /></div>
                <div>
                  <h3 className="font-extrabold text-white">{step.title}</h3>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Extra capabilities */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Daily operations</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Small details that save hours every day</h2>
            <p className="text-slate-600 mt-3 leading-relaxed">
              Designed with hospital front desks and pharmacies, so the common tasks take one click instead of five.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Search, title: 'Instant patient search', text: 'Find anyone by name, phone or patient number across all visits.' },
              { icon: CalendarClock, title: 'Appointments', text: 'Date-wise booking with time slots and doctor availability.' },
              { icon: Boxes, title: 'Batch & expiry control', text: 'Know which batch is on which rack and when it expires.' },
              { icon: BellRing, title: 'Smart alerts', text: 'Low stock, expiring medicines and subscription reminders.' },
              { icon: FileText, title: 'Complete patient record', text: 'Vitals, diagnoses, prescriptions and bills on one printable page.' },
              { icon: TrendingUp, title: 'Revenue insights', text: 'Footfall and revenue by department, day and doctor.' },
              { icon: Clock, title: 'Daily token reset', text: 'OPD tokens start again from 101 for each doctor every day.' },
              { icon: Mail, title: 'E-mail notifications', text: 'Welcome credentials and security alerts sent automatically.' }
            ].map(item => (
              <div key={item.title} className="rounded-2xl border border-[#D8D8D8] p-4 flex gap-3">
                <item.icon size={20} className="text-[#3683F8] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-extrabold">{item.title}</div>
                  <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="bg-[#EBF3FE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Security & privacy</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Patient data stays private to your hospital</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SECURITY.map(item => (
              <div key={item.title} className="rounded-3xl bg-white border border-blue-100 p-6">
                <div className="h-11 w-11 rounded-2xl bg-[#3683F8] text-white flex items-center justify-center mb-4"><item.icon size={20} /></div>
                <h3 className="font-extrabold">{item.title}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Pricing</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Simple plans that grow with your hospital</h2>
          <p className="text-slate-600 mt-3">Every plan includes all modules. Plans differ only in staff accounts and storage.{allowSignup ? ` Try any plan free for ${trialDays} days.` : ''}</p>
        </div>

        {!plansLoaded ? (
          <div className="grid md:grid-cols-3 gap-5">
            {[0, 1, 2].map(i => <div key={i} className="h-96 rounded-3xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center rounded-3xl border border-dashed border-[#D8D8D8] p-10 text-slate-500">
            Plans are being updated. Please contact us{settings?.supportEmail ? ` at ${settings.supportEmail}` : ''} for pricing.
          </div>
        ) : (
          <div className={`grid gap-5 ${plans.length === 1 ? 'max-w-md mx-auto' : plans.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-3'}`}>
            {plans.map((plan, i) => {
              const featured = i === highlightIndex;
              return (
                <div key={plan.id} className={`relative rounded-3xl p-7 flex flex-col ${featured ? 'bg-[#060606] text-white shadow-2xl shadow-[#3683F8]/20 md:-translate-y-3' : 'bg-white border border-[#D8D8D8]'}`}>
                  {featured && (
                    <span className="absolute -top-3 left-7 text-[10px] font-black uppercase tracking-widest bg-[#3683F8] text-white px-3 py-1 rounded-full">Most popular</span>
                  )}
                  <h3 className={`text-lg font-extrabold ${featured ? 'text-white' : ''}`}>{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className={`text-4xl font-black ${featured ? 'text-white' : ''}`}>₹{plan.price.toLocaleString('en-IN')}</span>
                    <span className={`text-sm font-semibold ${featured ? 'text-slate-400' : 'text-slate-500'}`}>
                      / {plan.durationMonths === 12 ? 'year' : `${plan.durationMonths} months`}
                    </span>
                  </div>
                  <ul className="mt-6 space-y-3 flex-1">
                    {[
                      limit(plan.maxDoctors, 'doctor login'),
                      limit(plan.maxReceptionists, 'receptionist login'),
                      limit(plan.maxPharmacists, 'pharmacist login'),
                      `${plan.maxStorage} GB secure cloud storage`,
                      'All modules included',
                      'Thermal & A4 printing',
                      'E-mail support'
                    ].map(feature => (
                      <li key={feature} className={`flex gap-2.5 text-sm ${featured ? 'text-slate-200' : 'text-slate-700'}`}>
                        <Check size={16} className="text-[#3683F8] shrink-0 mt-0.5" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={allowSignup ? `/register?plan=${encodeURIComponent(plan.id)}` : '/register?mode=license'}
                    className={`mt-8 h-12 inline-flex items-center justify-center gap-2 rounded-xl font-extrabold text-sm transition-colors ${featured ? 'bg-[#3683F8] hover:bg-blue-500 text-white' : 'bg-[#EBF3FE] hover:bg-[#3683F8] hover:text-white text-[#3683F8]'}`}
                  >
                    {allowSignup ? 'Start free trial' : 'Activate with license'} <ArrowRight size={16} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-center text-xs text-slate-500 mt-6">Prices in Indian Rupees. Applicable taxes extra.</p>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-slate-50 border-y border-[#D8D8D8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Frequently asked questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="rounded-2xl bg-white border border-[#D8D8D8] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-bold text-sm sm:text-base"
                    aria-expanded={open}
                  >
                    {item.q}
                    <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="rounded-[2rem] bg-[#3683F8] text-white px-6 sm:px-12 py-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px] opacity-10 pointer-events-none" />
          <h2 className="relative text-3xl sm:text-4xl font-black tracking-tight text-white">Ready to go paperless?</h2>
          <p className="relative mt-3 text-blue-100 max-w-xl mx-auto">
            Register your hospital today and run your first digital OPD in minutes.
          </p>
          <div className="relative mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {allowSignup && (
              <Link to="/register" className="h-12 px-7 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#3683F8] font-extrabold hover:bg-blue-50 transition-colors">
                Register your hospital <ArrowRight size={18} />
              </Link>
            )}
            <Link to="/login" className="h-12 px-7 inline-flex items-center justify-center rounded-xl border border-white/50 text-white font-bold hover:bg-white/10 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D8D8D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#3683F8] text-white flex items-center justify-center font-black">✚</div>
            <div>
              <div className="text-sm font-extrabold">{platformName}</div>
              <div className="text-xs text-slate-500">© {new Date().getFullYear()} twinsCloud. All rights reserved.</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-[#3683F8]">Features</a>
            <a href="#pricing" className="hover:text-[#3683F8]">Pricing</a>
            <Link to="/login" className="hover:text-[#3683F8]">Sign in</Link>
            <Link to="/register?mode=license" className="hover:text-[#3683F8]">Activate license</Link>
            {settings?.supportEmail && (
              <a href={`mailto:${settings.supportEmail}`} className="hover:text-[#3683F8] inline-flex items-center gap-1.5"><Mail size={14} /> {settings.supportEmail}</a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
