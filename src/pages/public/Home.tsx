import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Stethoscope, Pill, Users, Receipt, ChartColumn, ShieldCheck, Lock, Printer, Mic,
  Building2, CalendarClock, ClipboardList, Boxes, BellRing, ArrowRight, ArrowUp, Check, CheckCircle2, Menu, X,
  ChevronDown, HeartPulse, KeyRound, Database, FileText, Wallet, Clock,
  LayoutDashboard, Mail, Search, UserCheck, TrendingUp, UserPlus, Sparkles
} from 'lucide-react';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Reveal, CountUp, TiltCard, useScrollProgress } from '../../components/landing/Motion';

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

const SCREEN = (name: string) => `/images/screens/${name}.jpg`;

// Real screens of the software (captured with demo data)
const TOUR = [
  {
    key: 'reception', icon: UserCheck, label: 'Reception', image: SCREEN('reception'),
    title: 'OPD front desk & live queue',
    text: 'Search by phone, register the patient, collect the fee and issue a token — the patient appears on the doctor\'s screen instantly.',
    points: ['Walk-in check-in with phone auto-lookup', 'Live waiting / in-consultation / completed counts', 'Vitals & history captured at the desk']
  },
  {
    key: 'doctor', icon: Stethoscope, label: 'Doctor', image: SCREEN('doctor'),
    title: 'Doctor consultation workstation',
    text: 'The waiting room on the left, the current patient with vitals in the middle, and voice dictation to write the prescription.',
    points: ['FIFO waiting room of paid patients', 'One-click voice prescription (Hinglish)', 'Recall later, complete & close in one tap']
  },
  {
    key: 'pharmacy', icon: Pill, label: 'Pharmacy', image: SCREEN('inventory'),
    title: 'Pharmacy inventory master',
    text: 'Every medicine with batch, rack location, stock and expiry — low-stock and expiring items are flagged automatically.',
    points: ['Batch & rack-wise stock', 'Low stock and 30-day expiry warnings', 'Stock deducted on every POS sale']
  },
  {
    key: 'billing', icon: Receipt, label: 'Billing', image: SCREEN('billing'),
    title: 'OPD billing & receipts ledger',
    text: 'Sequential invoices, pending dues and one-click thermal receipt printing for every consultation and emergency fee.',
    points: ['INV-1001 style sequential numbering', 'Collect pending dues in one click', 'Print 80 mm thermal or A4 slips']
  },
  {
    key: 'analytics', icon: ChartColumn, label: 'Analytics', image: SCREEN('analytics'),
    title: 'Analytics & revenue insights',
    text: 'Collected revenue, outstanding dues and department-wise share — filter by today, this week, this month or a custom range.',
    points: ['OPD + pharmacy revenue together', 'Department revenue share', 'Date-wise filters and audited ledger']
  },
  {
    key: 'admin', icon: Building2, label: 'Admin', image: SCREEN('admin'),
    title: 'Hospital admin command centre',
    text: 'Today\'s revenue, OPD check-ins, active doctors and pending bills at a glance, with footfall trends for the week.',
    points: ['Staff, departments & fees in one place', 'Weekly patient footfall chart', 'Subscription status & renewal']
  }
];

const MODULES = [
  {
    icon: UserCheck, tag: 'Front Desk', title: 'Reception & OPD Queue',
    text: 'Register a patient in seconds and send them straight into the right doctor\'s live queue.',
    points: ['Phone-number auto-lookup for returning patients', 'Unique patient number (PAT-xxxx) kept for life', 'Daily OPD tokens per doctor that reset every morning', 'Collect consultation fee before check-in (no unpaid queue)', 'Record vitals — BP, heart rate, temperature, SpO₂, sugar, weight', 'Book future appointments by date and time slot']
  },
  {
    icon: Stethoscope, tag: 'Doctor', title: 'Doctor Workspace',
    text: 'A focused, full-screen consultation desk with the whole patient history one click away.',
    points: ['Live FIFO queue of today\'s paid patients', 'Voice-to-text prescriptions (Indian English & Hinglish)', 'Medicine, dosage and duration builder', 'Previous visits, prescriptions and pharmacy bills', 'Search any patient by name, phone or patient number', 'Profile with consultation fee, registration no. and signature']
  },
  {
    icon: Pill, tag: 'Pharmacy', title: 'Pharmacy & Inventory',
    text: 'Prescriptions arrive at the pharmacy automatically — dispense, bill and update stock in one step.',
    points: ['E-prescription inbox: look up by Rx code, phone or patient no.', 'Point-of-sale billing with Cash, Card and UPI', 'Stock is deducted automatically on every sale', 'Batch numbers, rack location and expiry tracking', 'Low-stock and expiring-in-30-days alerts', 'Restock entries with supplier and batch details']
  },
  {
    icon: Building2, tag: 'Hospital Admin', title: 'Hospital Administration',
    text: 'Set up your hospital once, then manage staff, departments and fees from a single dashboard.',
    points: ['Create Doctor, Receptionist and Pharmacist logins', 'Role-change history for every staff member', 'Departments, wings, beds and room allocation', 'Doctor schedules with room and available days', 'OPD, emergency and bed-charge fee configuration', 'Hospital name, logo and contact branding']
  },
  {
    icon: Wallet, tag: 'Finance', title: 'Billing, Accounts & Analytics',
    text: 'Every rupee collected at the front desk and pharmacy lands in one ledger you can filter and print.',
    points: ['Sequential invoice numbers (INV-1001, INV-1002 …)', 'Pending vs. collected fee tracking', 'Master ledger across OPD and pharmacy sales', 'Revenue by department and patient footfall charts', 'Date-wise filters, search and printable reports', 'Subscription status, plan usage and renewal in-app']
  },
  {
    icon: Printer, tag: 'Printing', title: 'Thermal Slips & Prints',
    text: 'Print-ready slips sized for 80 mm thermal printers or regular A4 paper.',
    points: ['OPD token slip for the patient', 'OPD billing receipt', 'Pharmacy bill with itemised medicines', 'Prescription print with doctor details', 'Custom logo, colours, font size and spacing', 'Patient record print from the directory']
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

// Illustrative activity feed shown in the hero
const LIVE_EVENTS = [
  { icon: UserPlus, tone: 'bg-[#EBF3FE] text-[#3683F8]', title: 'Priya Nair checked in', sub: 'Token OPD-104 · Dr. Kabir Sen' },
  { icon: Receipt, tone: 'bg-emerald-50 text-emerald-600', title: '₹500 collected · INV-1012', sub: 'Thermal receipt printed' },
  { icon: Mic, tone: 'bg-violet-50 text-violet-600', title: 'Voice prescription saved', sub: 'Sent to pharmacy · RX-7Q2A' },
  { icon: Pill, tone: 'bg-teal-50 text-teal-600', title: 'Prescription dispensed', sub: 'Stock updated · UPI ₹61' },
  { icon: BellRing, tone: 'bg-amber-50 text-amber-600', title: 'Low stock: Metformin 500mg', sub: '9 units left · reorder' }
];

const MARQUEE = [
  { icon: UserPlus, label: 'OPD Registration' }, { icon: ClipboardList, label: 'Live Doctor Queue' },
  { icon: Mic, label: 'Voice e-Prescription' }, { icon: Pill, label: 'Pharmacy POS' },
  { icon: Boxes, label: 'Batch & Expiry Tracking' }, { icon: Printer, label: 'Thermal Slips' },
  { icon: Receipt, label: 'Sequential Invoices' }, { icon: ChartColumn, label: 'Revenue Analytics' },
  { icon: Users, label: 'Staff & Roles' }, { icon: Building2, label: 'Departments & Beds' },
  { icon: CalendarClock, label: 'Doctor Schedules' }, { icon: Search, label: 'Patient Master Directory' }
];

const TOUR_MS = 6000;

export function Home() {
  const { settings, loadPublicConfig } = useSuperAdminStore();
  const { isAuthenticated, user } = useAuthStore();
  const { progress, scrolled } = useScrollProgress();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [eventIndex, setEventIndex] = useState(0);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourCycle, setTourCycle] = useState(0);

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

  // Hero live activity ticker
  useEffect(() => {
    const id = setInterval(() => setEventIndex(i => (i + 1) % LIVE_EVENTS.length), 2800);
    return () => clearInterval(id);
  }, []);

  // Product tour auto-advance (pauses while hovered)
  useEffect(() => {
    if (tourPaused) return;
    const id = setTimeout(() => setTourIndex(i => (i + 1) % TOUR.length), TOUR_MS);
    return () => clearTimeout(id);
  }, [tourIndex, tourPaused, tourCycle]);

  const selectTour = (i: number) => {
    setTourIndex(i);
    setTourCycle(c => c + 1);
  };

  const navLinks = [
    { href: '#tour', label: 'Product tour' },
    { href: '#features', label: 'Features' },
    { href: '#workflow', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' }
  ];

  const highlightIndex = plans.length >= 3 ? 1 : -1;
  const liveEvent = LIVE_EVENTS[eventIndex];
  const activeTour = TOUR[tourIndex];

  return (
    <div className="min-h-screen bg-white text-[#060606] font-sans overflow-x-hidden">
      {/* Scroll progress */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-50 pointer-events-none">
        <div className="h-full bg-gradient-to-r from-[#3683F8] to-cyan-400 origin-left" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* Navigation */}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md border-b border-[#D8D8D8]/70 shadow-sm' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
            <div className="h-9 w-9 rounded-xl bg-[#3683F8] text-white flex items-center justify-center font-black text-lg shadow-md shadow-[#3683F8]/30 shrink-0 transition-transform duration-500 group-hover:rotate-90">✚</div>
            <span className="font-extrabold tracking-tight text-sm sm:text-base truncate">{platformName}</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="relative hover:text-[#3683F8] transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-full after:bg-[#3683F8] after:scale-x-0 hover:after:scale-x-100 after:origin-left after:transition-transform">{link.label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <Link to={dashboardPath} className="btn-shine h-10 px-5 inline-flex items-center gap-2 rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white text-sm font-bold shadow-md shadow-[#3683F8]/25 transition-colors">
                Open Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="h-10 px-4 inline-flex items-center rounded-xl text-sm font-bold text-slate-700 hover:text-[#3683F8] transition-colors">Sign in</Link>
                {allowSignup && (
                  <Link to="/register" className="btn-shine group h-10 px-5 inline-flex items-center gap-2 rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white text-sm font-bold shadow-md shadow-[#3683F8]/25 transition-colors">
                    Start free trial <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-xl border border-[#D8D8D8] bg-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className={`md:hidden grid transition-[grid-template-rows] duration-300 ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="border-t border-[#D8D8D8] bg-white px-4 py-4 space-y-1">
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
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative -mt-16 pt-16 overflow-hidden bg-[#EBF3FE]">
        <div className="absolute inset-0 bg-[radial-gradient(#3683F8_1px,transparent_1px)] [background-size:26px_26px] opacity-[0.12] pointer-events-none" />
        <div className="blob-drift absolute -top-40 -right-24 w-[560px] h-[560px] bg-[#3683F8]/25 rounded-full blur-[140px] pointer-events-none" />
        <div className="blob-drift-slow absolute -bottom-48 -left-32 w-[480px] h-[480px] bg-cyan-300/30 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-20 grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          <div className="lg:col-span-5 space-y-7">
            <Reveal>
              <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#3683F8] bg-white/80 backdrop-blur border border-blue-200 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Cloud hospital software · Made for India
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.3rem] font-black leading-[1.08] tracking-tight">
                Run your entire hospital from <span className="gradient-text">one secure dashboard</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                OPD registration, live doctor queues, voice e-prescriptions, pharmacy billing with automatic stock updates, and complete
                accounts — connected in real time for every counter in your hospital or clinic.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="flex flex-col sm:flex-row gap-3">
                {allowSignup && (
                  <Link to="/register" className="btn-shine group h-12 px-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white font-extrabold shadow-lg shadow-[#3683F8]/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#3683F8]/40">
                    Start {trialDays}-day free trial <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                <a href="#tour" className="group h-12 px-7 inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#D8D8D8] hover:border-[#3683F8] text-[#060606] font-bold transition-all hover:-translate-y-0.5">
                  <Sparkles size={16} className="text-[#3683F8] transition-transform group-hover:rotate-12" /> See it in action
                </a>
              </div>
            </Reveal>
            <Reveal delay={400}>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-600">
                {['No credit card required', 'Set up in 5 minutes', 'Works on any device'].map(item => (
                  <li key={item} className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> {item}</li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Real product screenshot with live activity */}
          <Reveal variant="zoom" delay={150} className="lg:col-span-7">
            <div className="relative lg:pl-6">
              <TiltCard max={5}>
                <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#D8D8D8] shadow-2xl shadow-[#3683F8]/25 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#D8D8D8] bg-slate-50">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-3 flex-1 max-w-xs h-6 rounded-md bg-white border border-[#D8D8D8] text-[10px] text-slate-400 font-semibold flex items-center px-2.5 truncate">
                      <Lock size={10} className="mr-1.5 text-emerald-500" /> your-hospital · Doctor workstation
                    </span>
                  </div>
                  <img
                    src={SCREEN('doctor')}
                    alt="Doctor consultation workstation showing the waiting room, patient vitals and voice prescription"
                    width={1440}
                    height={900}
                    className="w-full h-auto block"
                    fetchPriority="high"
                  />
                </div>
              </TiltCard>

              {/* Rotating live activity toast */}
              <div className="absolute -bottom-6 left-0 sm:-left-2 lg:-left-6 w-[260px] sm:w-[290px]">
                <div key={eventIndex} className="toast-in bg-white/95 backdrop-blur border border-[#D8D8D8] rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${liveEvent.tone}`}><liveEvent.icon size={18} /></div>
                  <div className="min-w-0">
                    <div className="text-xs font-black truncate">{liveEvent.title}</div>
                    <div className="text-[11px] text-slate-500 font-semibold truncate">{liveEvent.sub}</div>
                  </div>
                  <span className="ml-auto text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">Live</span>
                </div>
              </div>

              {/* Floating stat chip */}
              <div className="hidden sm:flex absolute -top-5 right-4 lg:-right-4 animate-float bg-white border border-[#D8D8D8] rounded-2xl shadow-xl px-4 py-2.5 items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#3683F8] text-white flex items-center justify-center"><HeartPulse size={16} /></div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's OPD</div>
                  <div className="text-sm font-black">10 patients · 3 doctors</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Module marquee */}
        <div className="relative border-y border-blue-100 bg-white/70 backdrop-blur py-4 mt-6">
          <div className="marquee-mask overflow-hidden" aria-label="Modules included">
            <div className="marquee-track gap-4 pr-4">
              {[...MARQUEE, ...MARQUEE].map((item, i) => (
                <span
                  key={i}
                  aria-hidden={i >= MARQUEE.length}
                  className="group flex items-center gap-2 h-10 px-4 rounded-full bg-white border border-blue-100 text-sm font-bold text-slate-600 whitespace-nowrap shadow-sm transition-colors hover:border-[#3683F8] hover:text-[#3683F8]"
                >
                  <item.icon size={16} className="text-[#3683F8] transition-transform group-hover:scale-125" /> {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value strip with counters */}
      <section className="border-b border-[#D8D8D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: LayoutDashboard, to: 5, suffix: '', title: 'Role-based workspaces', text: 'Admin, reception, doctor, pharmacy & operator' },
            { icon: HeartPulse, to: 7, suffix: '', title: 'Vitals tracked', text: 'BP, heart rate, temperature, SpO₂, sugar & more' },
            { icon: Printer, to: 4, suffix: '', title: 'Ready-to-print slips', text: 'Token, OPD receipt, prescription & pharmacy bill' },
            { icon: Database, to: 100, suffix: '%', title: 'Private hospital data', text: 'Every hospital is fully isolated on the server' }
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 100} className="flex gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[#EBF3FE] text-[#3683F8] flex items-center justify-center shrink-0"><item.icon size={22} /></div>
              <div>
                <div className="text-2xl font-black text-[#3683F8] leading-none"><CountUp to={item.to} suffix={item.suffix} /></div>
                <div className="text-sm font-extrabold mt-1">{item.title}</div>
                <div className="text-xs text-slate-500 font-medium leading-relaxed">{item.text}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Product tour */}
      <section id="tour" className="scroll-mt-20 relative py-20 overflow-hidden">
        <div className="absolute top-20 -left-40 w-[420px] h-[420px] bg-[#3683F8]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Product tour</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">See the real software, screen by screen</h2>
            <p className="text-slate-600 mt-3">These are actual screens from the platform — click any module to explore.</p>
          </Reveal>

          <Reveal delay={100}>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:justify-center mb-8 [scrollbar-width:none]">
              {TOUR.map((tab, i) => {
                const active = i === tourIndex;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => selectTour(i)}
                    className={`relative shrink-0 overflow-hidden h-11 px-4 rounded-xl text-sm font-bold inline-flex items-center gap-2 border transition-all duration-300 ${active ? 'bg-[#060606] text-white border-[#060606] shadow-lg' : 'bg-white text-slate-600 border-[#D8D8D8] hover:border-[#3683F8] hover:text-[#3683F8]'}`}
                  >
                    <tab.icon size={16} /> {tab.label}
                    {active && (
                      <span
                        key={`${tourIndex}-${tourCycle}-${tourPaused}`}
                        className={`absolute left-0 bottom-0 h-0.5 bg-[#3683F8] ${tourPaused ? 'w-full' : 'tour-progress'}`}
                        style={{ '--tour-duration': `${TOUR_MS}ms` } as CSSProperties}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Reveal>

          <div
            className="grid lg:grid-cols-12 gap-8 items-center"
            onMouseEnter={() => setTourPaused(true)}
            onMouseLeave={() => setTourPaused(false)}
          >
            <Reveal variant="left" className="lg:col-span-4 order-2 lg:order-1">
              <div key={activeTour.key} className="toast-in space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-[#3683F8] text-white flex items-center justify-center shadow-lg shadow-[#3683F8]/30"><activeTour.icon size={22} /></div>
                <h3 className="text-2xl font-black">{activeTour.title}</h3>
                <p className="text-slate-600 leading-relaxed">{activeTour.text}</p>
                <ul className="space-y-2.5">
                  {activeTour.points.map(point => (
                    <li key={point} className="flex gap-2.5 text-sm font-semibold text-slate-700">
                      <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Check size={13} /></span>
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 pt-2">
                  {TOUR.map((tab, i) => (
                    <button key={tab.key} type="button" aria-label={`Show ${tab.label}`} onClick={() => selectTour(i)} className={`h-2 rounded-full transition-all duration-300 ${i === tourIndex ? 'w-8 bg-[#3683F8]' : 'w-2 bg-slate-300 hover:bg-slate-400'}`} />
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal variant="right" delay={100} className="lg:col-span-8 order-1 lg:order-2">
              <TiltCard max={3}>
                <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#D8D8D8] shadow-2xl shadow-slate-900/10 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#D8D8D8] bg-slate-50">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-3 text-[11px] font-bold text-slate-400">{activeTour.title}</span>
                  </div>
                  <div className="relative aspect-[16/10] bg-slate-100">
                    {TOUR.map((tab, i) => (
                      <img
                        key={tab.key}
                        src={tab.image}
                        alt={`${tab.title} screen`}
                        width={1440}
                        height={900}
                        loading="lazy"
                        className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-700 ease-out ${i === tourIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.03]'}`}
                      />
                    ))}
                  </div>
                </div>
              </TiltCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Features / modules */}
      <section id="features" className="scroll-mt-20 bg-slate-50 border-y border-[#D8D8D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <Reveal className="max-w-2xl mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Everything in one place</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Every department, fully connected</h2>
            <p className="text-slate-600 mt-3 leading-relaxed">
              Each staff member gets a dedicated workspace. A patient registered at reception appears in the doctor's queue,
              the prescription reaches the pharmacy, and every payment lands in the admin's ledger — automatically.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map((mod, i) => (
              <Reveal key={mod.title} as="article" delay={(i % 3) * 120} className="group">
                <div className="h-full rounded-3xl border border-[#D8D8D8] p-6 bg-white transition-all duration-500 hover:-translate-y-1.5 hover:border-[#3683F8] hover:shadow-2xl hover:shadow-[#3683F8]/15">
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-[#EBF3FE] text-[#3683F8] group-hover:bg-[#3683F8] group-hover:text-white group-hover:rotate-6 group-hover:scale-110 flex items-center justify-center transition-all duration-500">
                      <mod.icon size={22} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-[#3683F8] transition-colors">{mod.tag}</span>
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
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="scroll-mt-20 relative bg-gradient-to-br from-[#060606] via-[#101928] to-[#0A1424] text-white overflow-hidden">
        <div className="blob-drift absolute -top-32 right-0 w-[460px] h-[460px] bg-[#3683F8]/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <Reveal className="max-w-2xl mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">How it works</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2 text-white">From the front desk to the pharmacy counter</h2>
            <p className="text-slate-300 mt-3 leading-relaxed">One patient journey, zero paper slips passed by hand.</p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {FLOW.map((step, i) => (
              <Reveal key={step.label} delay={i * 150} className="relative">
                <div className="group h-full rounded-2xl bg-white/5 border border-white/10 p-5 transition-all duration-500 hover:bg-white/10 hover:border-[#3683F8]/60 hover:-translate-y-1">
                  <div className="text-[10px] font-black text-[#3683F8] mb-3">STEP {i + 1}</div>
                  <div className="h-11 w-11 rounded-xl bg-[#3683F8]/15 text-white flex items-center justify-center mb-3 transition-all duration-500 group-hover:bg-[#3683F8] group-hover:scale-110">
                    <step.icon size={22} />
                  </div>
                  <div className="font-extrabold text-white">{step.label}</div>
                  <div className="text-xs text-slate-400 font-medium mt-1">{step.sub}</div>
                </div>
                {i < FLOW.length - 1 && (
                  <ArrowRight size={18} className="hidden sm:block absolute top-1/2 -right-3 -translate-y-1/2 text-[#3683F8] z-10 animate-pulse" />
                )}
              </Reveal>
            ))}
          </div>

          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {[
              { icon: Building2, title: '1. Register your hospital', text: 'Enter your hospital details and create the admin login. You are inside the dashboard in under a minute.' },
              { icon: Users, title: '2. Add staff & set fees', text: 'Create logins for doctors, receptionists and pharmacists, add departments and set your OPD fees.' },
              { icon: Activity, title: '3. Start your OPD', text: 'Reception registers the first patient and the token appears instantly on the doctor\'s screen.' }
            ].map((step, i) => (
              <Reveal key={step.title} delay={i * 150} className="flex gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#3683F8] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#3683F8]/30 pulse-ring"><step.icon size={22} /></div>
                <div>
                  <h3 className="font-extrabold text-white">{step.title}</h3>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Screens gallery + extra capabilities */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal variant="left">
            <div className="relative h-[340px] sm:h-[420px]">
              <div className="absolute left-0 top-0 w-[78%] rounded-2xl overflow-hidden border border-[#D8D8D8] shadow-2xl transition-transform duration-700 hover:-translate-y-2 hover:rotate-0 -rotate-2">
                <img src={SCREEN('billing')} alt="OPD billing and receipts ledger" width={1440} height={900} loading="lazy" className="w-full h-auto block" />
              </div>
              <div className="absolute right-0 bottom-0 w-[72%] rounded-2xl overflow-hidden border border-[#D8D8D8] shadow-2xl transition-transform duration-700 hover:-translate-y-2 hover:rotate-0 rotate-2 animate-float-slow">
                <img src={SCREEN('inventory')} alt="Pharmacy inventory with batch and expiry tracking" width={1440} height={900} loading="lazy" className="w-full h-auto block" />
              </div>
            </div>
          </Reveal>
          <div>
            <Reveal>
              <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Daily operations</span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Small details that save hours every day</h2>
              <p className="text-slate-600 mt-3 leading-relaxed">
                Designed with hospital front desks and pharmacies, so the common tasks take one click instead of five.
              </p>
            </Reveal>
            <div className="grid sm:grid-cols-2 gap-3 mt-8">
              {[
                { icon: Search, title: 'Instant patient search', text: 'Find anyone by name, phone or patient number.' },
                { icon: CalendarClock, title: 'Appointments', text: 'Date-wise booking with time slots.' },
                { icon: Boxes, title: 'Batch & expiry control', text: 'Know which batch is on which rack.' },
                { icon: BellRing, title: 'Smart alerts', text: 'Low stock, expiry and renewal reminders.' },
                { icon: FileText, title: 'Complete patient record', text: 'Vitals, Rx and bills on one printable page.' },
                { icon: TrendingUp, title: 'Revenue insights', text: 'Footfall and revenue by department.' },
                { icon: Clock, title: 'Daily token reset', text: 'Tokens restart from 101 every day.' },
                { icon: Mail, title: 'E-mail notifications', text: 'Credentials and security alerts.' }
              ].map((item, i) => (
                <Reveal key={item.title} delay={(i % 2) * 80 + Math.floor(i / 2) * 60}>
                  <div className="group h-full rounded-2xl border border-[#D8D8D8] p-4 flex gap-3 transition-all duration-300 hover:border-[#3683F8] hover:bg-[#EBF3FE]/50 hover:-translate-y-0.5">
                    <item.icon size={20} className="text-[#3683F8] shrink-0 mt-0.5 transition-transform group-hover:scale-125" />
                    <div>
                      <div className="text-sm font-extrabold">{item.title}</div>
                      <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{item.text}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="relative bg-[#EBF3FE] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#3683F8_1px,transparent_1px)] [background-size:26px_26px] opacity-[0.08] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <Reveal className="max-w-2xl mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Security & privacy</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Patient data stays private to your hospital</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SECURITY.map((item, i) => (
              <Reveal key={item.title} delay={i * 120}>
                <div className="group h-full rounded-3xl bg-white border border-blue-100 p-6 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#3683F8]/15">
                  <div className="h-11 w-11 rounded-2xl bg-[#3683F8] text-white flex items-center justify-center mb-4 transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110"><item.icon size={20} /></div>
                  <h3 className="font-extrabold">{item.title}</h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Pricing</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Simple plans that grow with your hospital</h2>
          <p className="text-slate-600 mt-3">Every plan includes all modules. Plans differ only in staff accounts and storage.{allowSignup ? ` Try any plan free for ${trialDays} days.` : ''}</p>
        </Reveal>

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
                <Reveal key={plan.id} delay={i * 120} variant="zoom">
                  <div className={`relative h-full rounded-3xl p-7 flex flex-col transition-all duration-500 hover:-translate-y-2 ${featured ? 'bg-[#060606] text-white shadow-2xl shadow-[#3683F8]/25 md:-translate-y-3 md:hover:-translate-y-5' : 'bg-white border border-[#D8D8D8] hover:border-[#3683F8] hover:shadow-xl hover:shadow-[#3683F8]/10'}`}>
                    {featured && (
                      <span className="absolute -top-3 left-7 text-[10px] font-black uppercase tracking-widest bg-[#3683F8] text-white px-3 py-1 rounded-full shadow-lg shadow-[#3683F8]/40">Most popular</span>
                    )}
                    <h3 className={`text-lg font-extrabold ${featured ? 'text-white' : ''}`}>{plan.name}</h3>
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className={`text-4xl font-black ${featured ? 'text-white' : ''}`}><CountUp to={plan.price} prefix="₹" duration={1200} /></span>
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
                      className={`btn-shine group mt-8 h-12 inline-flex items-center justify-center gap-2 rounded-xl font-extrabold text-sm transition-colors ${featured ? 'bg-[#3683F8] hover:bg-blue-500 text-white' : 'bg-[#EBF3FE] hover:bg-[#3683F8] hover:text-white text-[#3683F8]'}`}
                    >
                      {allowSignup ? 'Start free trial' : 'Activate with license'} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
        <p className="text-center text-xs text-slate-500 mt-6">Prices in Indian Rupees. Applicable taxes extra.</p>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-slate-50 border-y border-[#D8D8D8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <Reveal className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">Frequently asked questions</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={item.q} delay={i * 60}>
                  <div className={`rounded-2xl bg-white border overflow-hidden transition-all duration-300 ${open ? 'border-[#3683F8] shadow-lg shadow-[#3683F8]/10' : 'border-[#D8D8D8] hover:border-slate-300'}`}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-bold text-sm sm:text-base"
                      aria-expanded={open}
                    >
                      {item.q}
                      <span className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${open ? 'bg-[#3683F8] text-white rotate-180' : 'bg-slate-100 text-slate-500'}`}>
                        <ChevronDown size={16} />
                      </span>
                    </button>
                    <div className="faq-panel" data-open={open}>
                      <div>
                        <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{item.a}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <Reveal variant="zoom">
          <div className="rounded-[2rem] bg-[#3683F8] text-white px-6 sm:px-12 py-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px] opacity-10 pointer-events-none" />
            <div className="blob-drift absolute -top-24 -left-24 w-80 h-80 bg-cyan-300/40 rounded-full blur-[100px] pointer-events-none" />
            <div className="blob-drift-slow absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-500/40 rounded-full blur-[100px] pointer-events-none" />
            <h2 className="relative text-3xl sm:text-4xl font-black tracking-tight text-white">Ready to go paperless?</h2>
            <p className="relative mt-3 text-blue-100 max-w-xl mx-auto">
              Register your hospital today and run your first digital OPD in minutes.
            </p>
            <div className="relative mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              {allowSignup && (
                <Link to="/register" className="btn-shine group h-12 px-7 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#3683F8] font-extrabold hover:bg-blue-50 transition-all hover:-translate-y-0.5 hover:shadow-xl">
                  Register your hospital <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              <Link to="/login" className="h-12 px-7 inline-flex items-center justify-center rounded-xl border border-white/50 text-white font-bold hover:bg-white/10 transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </Reveal>
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
            <a href="#features" className="hover:text-[#3683F8] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#3683F8] transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-[#3683F8] transition-colors">Sign in</Link>
            <Link to="/register?mode=license" className="hover:text-[#3683F8] transition-colors">Activate license</Link>
            {settings?.supportEmail && (
              <a href={`mailto:${settings.supportEmail}`} className="hover:text-[#3683F8] inline-flex items-center gap-1.5 transition-colors"><Mail size={14} /> {settings.supportEmail}</a>
            )}
          </div>
        </div>
      </footer>

      {/* Back to top */}
      <button
        type="button"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-5 right-5 z-40 h-11 w-11 rounded-full bg-[#060606] text-white shadow-xl flex items-center justify-center transition-all duration-300 hover:bg-[#3683F8] hover:-translate-y-1 ${progress > 0.15 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
}
