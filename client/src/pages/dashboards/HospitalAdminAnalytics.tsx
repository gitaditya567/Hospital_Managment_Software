import { useState, useMemo } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  PieChart as PieIcon,
  Calendar,
  CheckCircle2,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Users,
  Briefcase,
  Receipt,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  FolderHeart,
  Eye,
  Printer
} from 'lucide-react';

interface UnifiedTransaction {
  id: string;
  patientName: string;
  patientPhone: string;
  department: string;
  amount: number;
  operatorName: string;
  date: string;
  status: 'Paid' | 'Pending';
  type: 'OPD' | 'Pharmacy';
}

export function HospitalAdminAnalytics() {
  const { staff, invoices, departments, hospitalName } = useHospitalStore();
  const { bills } = usePharmacyStore();

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState<'month' | 'year'>('month');

  // Helpers for date filtering
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const isThisMonth = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  };

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.toDateString() === now.toDateString();
  };

  // Helper to get selected date string in YYYY-MM-DD format for default state
  const todayStr = useMemo(() => {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [now]);

  // State for transaction table date filter. Default to "today" (todayStr)
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State for selected receipt modal details
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calculations for KPIs
  const kpis = useMemo(() => {
    // 1. This Month Revenue (OPD Paid/Pending + Pharmacy)
    const thisMonthOPD = invoices
      .filter(inv => isThisMonth(inv.date))
      .reduce((sum, inv) => sum + inv.amount, 0);

    const thisMonthPharmacy = bills
      .filter(b => isThisMonth(b.date))
      .reduce((sum, b) => sum + b.total, 0);

    const thisMonthTotal = thisMonthOPD + thisMonthPharmacy;

    // 2. Collected (Paid Invoices overall + Pharmacy overall)
    const collectedOPDOverall = invoices
      .filter(inv => inv.status === 'Paid')
      .reduce((sum, inv) => sum + inv.amount, 0);

    const collectedPharmacyOverall = bills.reduce((sum, b) => sum + b.total, 0);

    const collectedOverall = collectedOPDOverall + collectedPharmacyOverall;

    const collectedThisMonth = invoices
      .filter(inv => inv.status === 'Paid' && isThisMonth(inv.date))
      .reduce((sum, inv) => sum + inv.amount, 0) +
      bills.filter(b => isThisMonth(b.date)).reduce((sum, b) => sum + b.total, 0);

    // 3. Pending (Pending Invoices overall)
    const pendingOverall = invoices
      .filter(inv => inv.status === 'Pending')
      .reduce((sum, inv) => sum + inv.amount, 0);

    const pendingThisMonth = invoices
      .filter(inv => inv.status === 'Pending' && isThisMonth(inv.date))
      .reduce((sum, inv) => sum + inv.amount, 0);

    // 4. Today (OPD + Pharmacy today)
    const todayOPD = invoices
      .filter(inv => isToday(inv.date))
      .reduce((sum, inv) => sum + inv.amount, 0);

    const todayPharmacy = bills
      .filter(b => isToday(b.date))
      .reduce((sum, b) => sum + b.total, 0);

    const todayTotal = todayOPD + todayPharmacy;

    // Percentage of collected over total invoiced
    const totalOPDOverall = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalSaaSOverall = totalOPDOverall + collectedPharmacyOverall;
    const collectedPercentage = totalSaaSOverall > 0
      ? Math.round((collectedOverall / totalSaaSOverall) * 100)
      : 100;

    return {
      thisMonthTotal,
      thisMonthOPD,
      thisMonthPharmacy,
      collectedOverall,
      collectedThisMonth,
      collectedPercentage,
      pendingOverall,
      pendingThisMonth,
      todayTotal,
      todayOPD,
      todayPharmacy
    };
  }, [invoices, bills]);

  // Calculations for Department-wise Revenue Share
  const departmentRevenueData = useMemo(() => {
    const deptRevenue: Record<string, number> = {};

    // Standard departments preset to guarantee clean rendering
    const presetDepts = ['Cardiology', 'Pediatrics', 'Orthopedics', 'General Medicine', 'Pharmacy'];
    presetDepts.forEach(dept => {
      deptRevenue[dept] = 0;
    });

    // Populate OPD invoices
    invoices.forEach(inv => {
      if (inv.status === 'Paid') {
        const doctorDoc = staff.find(
          s => s.role === 'Doctor' && s.name.toLowerCase() === inv.doctorName.toLowerCase()
        );
        const dept = doctorDoc?.department || 'General Medicine';
        deptRevenue[dept] = (deptRevenue[dept] || 0) + inv.amount;
      }
    });

    // Populate Pharmacy invoices
    const totalPharmacyRevenue = bills.reduce((sum, b) => sum + b.total, 0);
    if (totalPharmacyRevenue > 0) {
      deptRevenue['Pharmacy'] = (deptRevenue['Pharmacy'] || 0) + totalPharmacyRevenue;
    }

    // Convert to list & filter empty ones
    let chartList = Object.entries(deptRevenue)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);

    // Dynamic mock fallback if there's literally no billing data to show (for ultimate visuals)
    const hasActiveBilling = chartList.length > 0;
    if (!hasActiveBilling) {
      chartList = [
        { name: 'Cardiology', value: 34500 },
        { name: 'Pediatrics', value: 18200 },
        { name: 'Orthopedics', value: 27900 },
        { name: 'General Medicine', value: 21600 },
        { name: 'Pharmacy', value: 41200 }
      ];
    }

    const totalSum = chartList.reduce((sum, d) => sum + d.value, 0);

    // Calculate sectors coordinates
    let accumulatedPercent = 0;
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e'];

    const sectors = chartList.map((item, index) => {
      const startPercent = accumulatedPercent;
      const percent = totalSum > 0 ? item.value / totalSum : 0;
      accumulatedPercent += percent;

      // Mathematical angle calculation (start angle -0.25 to start at 12 o'clock position)
      const startAngle = 2 * Math.PI * (startPercent - 0.25);
      const endAngle = 2 * Math.PI * (accumulatedPercent - 0.25);

      const startX = Math.cos(startAngle);
      const startY = Math.sin(startAngle);
      const endX = Math.cos(endAngle);
      const endY = Math.sin(endAngle);

      const largeArcFlag = percent > 0.5 ? 1 : 0;
      const color = colors[index % colors.length];

      // Explode slice coordinates (bisector calculations)
      const bisectorPercent = startPercent + percent / 2;
      const bisectorAngle = 2 * Math.PI * (bisectorPercent - 0.25);
      const dx = Math.cos(bisectorAngle) * 5; // Explode out by 5px
      const dy = Math.sin(bisectorAngle) * 5;

      return {
        ...item,
        percent,
        startX,
        startY,
        endX,
        endY,
        largeArcFlag,
        color,
        dx,
        dy
      };
    });

    return {
      sectors,
      totalSum,
      hasActiveBilling
    };
  }, [invoices, bills, staff]);

  // Dynamic lookup of billing operators (Emily for Receptionist, Michael for Pharmacy)
  const receptionistName = useMemo(() => {
    return staff.find(s => s.role === 'Receptionist')?.name || 'Emily White';
  }, [staff]);

  const pharmacistName = useMemo(() => {
    return staff.find(s => s.role === 'Pharmacy')?.name || 'Michael Brown';
  }, [staff]);

  // Unified Transaction Records list
  const unifiedTransactions = useMemo(() => {
    const list: UnifiedTransaction[] = [];

    // Process OPD Invoices
    invoices.forEach(inv => {
      const doc = staff.find(s => s.role === 'Doctor' && s.name.toLowerCase() === inv.doctorName.toLowerCase());
      const dept = doc?.department || 'General Medicine';

      list.push({
        id: inv.id,
        patientName: inv.patientName,
        patientPhone: inv.patientPhone,
        department: dept,
        amount: inv.amount,
        operatorName: receptionistName,
        date: inv.date,
        status: inv.status,
        type: 'OPD'
      });
    });

    // Process Pharmacy Bills
    bills.forEach(b => {
      list.push({
        id: b.id,
        patientName: b.patientName,
        patientPhone: b.patientPhone,
        department: 'Pharmacy',
        amount: b.total,
        operatorName: pharmacistName,
        date: b.date,
        status: 'Paid',
        type: 'Pharmacy'
      });
    });

    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, bills, staff, receptionistName, pharmacistName]);

  // Compare if two dates fall on the same day (robust formatter mapping)
  const isSameDay = (dateStr1: string, dateStr2: string) => {
    if (!dateStr1 || !dateStr2) return false;
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Filtered transactions for the ledger table
  const filteredTransactions = useMemo(() => {
    let result = unifiedTransactions;

    // Apply selected date filter
    if (filterDate) {
      result = result.filter(tx => isSameDay(tx.date, filterDate));
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(tx =>
        tx.id.toLowerCase().includes(q) ||
        tx.patientName.toLowerCase().includes(q) ||
        tx.patientPhone.includes(q) ||
        tx.department.toLowerCase().includes(q) ||
        tx.operatorName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [unifiedTransactions, filterDate, searchQuery]);

  // Find currently selected transaction details for the modal
  const selectedTransaction = useMemo(() => {
    if (!selectedTxId) return null;
    return unifiedTransactions.find(tx => tx.id === selectedTxId) || null;
  }, [selectedTxId, unifiedTransactions]);

  // Extract Pharmacy items details if selected transaction is Pharmacy billing
  const pharmacyBillDetails = useMemo(() => {
    if (!selectedTransaction || selectedTransaction.type !== 'Pharmacy') return null;
    return bills.find(b => b.id === selectedTransaction.id) || null;
  }, [selectedTransaction, bills]);

  // Selected or hovered department detail block
  const currentSelectedDept = hoveredIndex !== null ? departmentRevenueData.sectors[hoveredIndex] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header telemetry band */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
              <Sparkles size={12} /> Live Performance Telemetry
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <PieIcon className="text-indigo-400" /> Analytics Portal
          </h1>
          <p className="text-slate-300 text-sm font-medium">
            Financial auditing, department shares, and billing diagnostics for {hospitalName}.
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex gap-2">
          <button
            onClick={() => setSelectedTimeline('month')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              selectedTimeline === 'month' 
                ? 'bg-white text-slate-800 border-white shadow-md' 
                : 'text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            This Calendar Month
          </button>
          <button
            onClick={() => setSelectedTimeline('year')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              selectedTimeline === 'year' 
                ? 'bg-white text-slate-800 border-white shadow-md' 
                : 'text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            Full Audited Ledger
          </button>
        </div>
      </div>

      {/* 4 Premium KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Card 1: This Month Amount */}
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">This Month Amount</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ₹{kpis.thisMonthTotal.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-200/50 flex items-center justify-center">
              <Calendar size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/50 flex items-center justify-between text-[10px]">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <ArrowUpRight size={12} className="text-indigo-600" />
              OPD: ₹{kpis.thisMonthOPD.toLocaleString('en-IN')}
            </span>
            <span className="text-indigo-600 font-extrabold">
              Pharmacy: ₹{kpis.thisMonthPharmacy.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 2: Collected (Paid Invoices & Pharmacy) */}
        <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Collected Revenue</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ₹{kpis.collectedOverall.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200/50 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/50 flex items-center justify-between text-[10px]">
            <span className="text-emerald-700 font-bold">
              This Month: ₹{kpis.collectedThisMonth.toLocaleString('en-IN')}
            </span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
              {kpis.collectedPercentage}% Clearance
            </span>
          </div>
        </div>

        {/* Card 3: Pending Invoices */}
        <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Outstanding Dues</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ₹{kpis.pendingOverall.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-200/50 flex items-center justify-center">
              <Clock size={20} className="animate-pulse" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/50 flex items-center justify-between text-[10px]">
            <span className="text-rose-600 font-extrabold flex items-center gap-1">
              <ArrowDownRight size={12} className="text-rose-500" />
              This Month: ₹{kpis.pendingThisMonth.toLocaleString('en-IN')}
            </span>
            <span className="text-slate-400 font-semibold">
              Awaiting Checkout desks
            </span>
          </div>
        </div>

        {/* Card 4: Today's Revenue */}
        <div className="bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Today's Revenue</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ₹{kpis.todayTotal.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 border border-sky-200/50 flex items-center justify-center">
              <Activity size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/50 flex items-center justify-between text-[10px]">
            <span className="text-slate-500 font-semibold">
              OPD: ₹{kpis.todayOPD.toLocaleString('en-IN')}
            </span>
            <span className="text-sky-700 font-extrabold">
              Pharmacy: ₹{kpis.todayPharmacy.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

      </div>

      {/* Main Analytics Dash Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Card: Pie Chart Segment shares */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 flex flex-col justify-between relative">

          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="text-indigo-600" size={18} /> Department Revenue Share
              </h2>
              <p className="text-xs text-slate-500 font-medium">OPD and Pharmacy audited contributions</p>
            </div>
            {!departmentRevenueData.hasActiveBilling && (
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                ⚠️ Displaying Mock Registry (No Data)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-4">

            {/* Real Mathematical Pie Chart SVG */}
            <div className="flex justify-center items-center relative">
              <svg width="220" height="220" viewBox="0 0 120 120" className="overflow-visible select-none">
                {/* Background glow circle */}
                <circle cx={60} cy={60} r={46} fill="#f8fafc" />
                <circle cx={60} cy={60} r={44} fill="transparent" stroke="#f1f5f9" strokeWidth={1} />

                {/* Sector render mapping */}
                {departmentRevenueData.sectors.map((sec, idx) => {
                  const r = 42; // Radius
                  const cx = 60;
                  const cy = 60;

                  // Sector coordinates
                  const x1 = cx + r * sec.startX;
                  const y1 = cy + r * sec.startY;
                  const x2 = cx + r * sec.endX;
                  const y2 = cy + r * sec.endY;

                  // Full circular ring path handler if only 1 category takes 100% space
                  const isFull = sec.percent >= 0.999;
                  const pathData = isFull
                    ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
                    : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sec.largeArcFlag} 1 ${x2} ${y2} Z`;

                  // Explode offset translates the hovered sector outwards
                  const isHovered = hoveredIndex === idx;
                  const translateStyle = isHovered
                    ? { transform: `translate(${sec.dx}px, ${sec.dy}px)` }
                    : undefined;

                  return (
                    <path
                      key={idx}
                      d={pathData}
                      fill={sec.color}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      style={{
                        ...translateStyle,
                        cursor: 'pointer',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                        opacity: hoveredIndex !== null && !isHovered ? 0.75 : 1
                      }}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="drop-shadow-sm hover:drop-shadow-md"
                    />
                  );
                })}
              </svg>

              {/* Central text display for hovered slice */}
              <div className="absolute flex flex-col justify-center items-center text-center pointer-events-none w-[110px] h-[110px] rounded-full bg-white/95 backdrop-blur-sm border border-slate-100 shadow-inner">
                {currentSelectedDept ? (
                  <>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[95px]">
                      {currentSelectedDept.name}
                    </span>
                    <span className="text-sm font-extrabold text-slate-800 mt-0.5">
                      ₹{currentSelectedDept.value.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-600 mt-1">
                      {Math.round(currentSelectedDept.percent * 100)}% Share
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      TOTAL VOLUME
                    </span>
                    <span className="text-base font-black text-slate-800 leading-tight">
                      ₹{departmentRevenueData.totalSum.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-indigo-600 font-bold mt-0.5">
                      Hover segments
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Department stats block lists */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                Revenue Breakdown
              </h3>
              <div className="space-y-2">
                {departmentRevenueData.sectors.map((sec, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between text-xs font-medium cursor-pointer ${
                      hoveredIndex === idx 
                        ? 'bg-slate-50 border-slate-300 shadow-sm' 
                        : 'bg-transparent border-transparent hover:bg-slate-50/50'
                    }`}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                      <span className="font-bold truncate max-w-[100px]">{sec.name}</span>
                    </span>
                    <span className="text-slate-800 font-extrabold font-mono text-right flex flex-col">
                      <span>₹{sec.value.toLocaleString('en-IN')}</span>
                      <span className="text-[9px] text-slate-400 font-bold">
                        ({Math.round(sec.percent * 100)}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-3 mt-4 text-center">
            Interactive SVGs. Real-time updates bound to billing invoice records.
          </div>
        </div>

        {/* Right Card: Performance Telemetry Progress Bars */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 flex flex-col justify-between">
          <div className="space-y-6">

            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-600" size={18} /> Telemetry Progress
              </h2>
              <p className="text-xs text-slate-500 font-medium">Target volume analysis against max contributions</p>
            </div>

            {/* Department contributions bar ledger */}
            <div className="space-y-5">
              {departmentRevenueData.sectors.map((sec, idx) => {
                const percentInt = Math.round(sec.percent * 100);
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sec.color }} />
                        {sec.name}
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {percentInt}% of Total
                      </span>
                    </div>

                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${percentInt}%`,
                          backgroundColor: sec.color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Quick Metrics Details */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Billing Insights</h4>
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60 font-medium text-[11px] text-slate-600 space-y-2">
              <div className="flex justify-between">
                <span>Active Doctors Allocated:</span>
                <span className="font-bold text-slate-800">{staff.filter(s => s.role === 'Doctor').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Departments:</span>
                <span className="font-bold text-slate-800">{departments.filter(d => d.status === 'Active').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Monthly Clearance:</span>
                <span className="font-bold text-emerald-600">{kpis.collectedPercentage}% Clearance</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* COMPULSORY FEATURE: Financial Transaction Audit Ledger Table with Custom Date Filter */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 overflow-hidden">

        {/* Table Header and Control Panels */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="text-indigo-600" size={20} /> Departmental Audited Transactions
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Comprehensive registry tracking generated bills, patient metrics, departments, and specific billing operators.
            </p>
          </div>

          {/* Controls: Search, Date Filter Input & Quick Presets */}
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-stretch sm:items-center">

            {/* Search Input Bar */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, operator, receipt..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-xs font-semibold text-slate-700 bg-white"
              />
            </div>

            {/* Date Picker Input */}
            <div className="flex items-center gap-2 border border-slate-200 bg-white px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 w-full sm:w-auto">
              <Filter size={14} className="text-indigo-500 shrink-0" />
              <span className="shrink-0 text-slate-400 font-medium">Date:</span>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="border-none outline-none focus:ring-0 p-0 text-xs font-extrabold text-slate-800 cursor-pointer w-full sm:w-auto"
              />
            </div>

            {/* Quick Filter Presets */}
            <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-200/50">
              <button
                type="button"
                onClick={() => setFilterDate(todayStr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                  filterDate === todayStr 
                    ? 'bg-white text-slate-800 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Filter by Today's Transactions"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                  filterDate === '' 
                    ? 'bg-white text-slate-800 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Show all transaction history"
              >
                All History
              </button>
            </div>

          </div>

        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Receipt No</th>
                <th className="px-6 py-4">Patient Details</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Billing Operator</th>
                <th className="px-6 py-4">Transaction Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold">

              {filteredTransactions.map((tx) => {
                const isPaid = tx.status === 'Paid';
                const isPharmacy = tx.type === 'Pharmacy';

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/30 transition-colors">

                    {/* Receipt No */}
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-black font-mono shadow-sm">
                        {tx.id}
                      </span>
                    </td>

                    {/* Patient Details */}
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-slate-800">{tx.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">📞 {tx.patientPhone}</div>
                    </td>

                    {/* Department Badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                        isPharmacy 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200/50'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isPharmacy ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                        {tx.department}
                      </span>
                    </td>

                    {/* Billing Operator Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-slate-100 border border-slate-200/60 text-slate-600 flex items-center justify-center">
                          <UserCheck size={14} className="text-slate-500" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{tx.operatorName}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            {isPharmacy ? 'Pharmacy Desk' : 'Front Counter'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Date/Time */}
                    <td className="px-6 py-4 text-slate-500 font-semibold font-mono">
                      {new Date(tx.date).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 text-slate-900 font-black text-sm">
                      ₹{tx.amount.toLocaleString('en-IN')}
                    </td>

                    {/* Paid/Pending Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        isPaid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                          : 'bg-rose-50 text-rose-700 border-rose-200/50 animate-pulse'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {tx.status}
                      </span>
                    </td>

                    {/* Actions Column with View Receipt Trigger */}
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTxId(tx.id);
                          setIsModalOpen(true);
                        }}
                        className="rounded-full text-[10px] font-extrabold h-8 px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50/50 flex gap-1 items-center ml-auto"
                        title="View Detailed virtual receipt"
                      >
                        <Eye size={12} />
                        <span>View Slip</span>
                      </Button>
                    </td>

                  </tr>
                );
              })}

              {/* Zero-State Transactions */}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                      <FolderHeart size={44} className="text-slate-300 animate-bounce" />
                      <p className="font-extrabold text-slate-700 text-sm">No Audit Transactions Logged</p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        No transactions registered under selected date ({filterDate || 'All History'}) or query. Change filters to resume diagnostics.
                      </p>
                      {(filterDate !== todayStr || searchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterDate(todayStr);
                            setSearchQuery('');
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold transition-all flex items-center gap-1 mt-2"
                        >
                          <RefreshCw size={12} /> Reset Ledger to Today
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

      </div>

      {/* COMPULSORY FEATURE: Dynamic Virtual Receipt Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTxId(null);
        }}
        title="Diagnostic Receipt Audit"
        className="max-w-sm"
      >
        {selectedTransaction && (
          <div className="space-y-5">

            {/* Visual virtual thermal paper design */}
            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200/80 flex justify-center">
              <div className="w-[72mm] bg-white border border-slate-300/80 p-4 shadow-sm text-slate-900 font-mono text-[10px] space-y-4 rounded-md relative overflow-hidden">

                {/* Visual Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none transform -rotate-45">
                  <span className="text-3xl font-black uppercase tracking-widest text-slate-900">AUDITED</span>
                </div>

                {/* Thermal Header */}
                <div className="text-center pb-2.5 border-b border-dashed border-slate-300 space-y-1">
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">🏥 {hospitalName}</h3>
                  <p className="text-[8px] text-slate-500">Live Clinical Registry Receipt</p>
                  <p className="text-[7px] text-slate-400 font-semibold font-mono">
                    Date: {new Date(selectedTransaction.date).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                {/* Receipt Identification Ticket */}
                <div className="text-center py-2.5 bg-slate-50 border border-slate-200 rounded space-y-1">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Transaction Ref</p>
                  <h2 className="text-xs font-black leading-none font-mono text-indigo-700">
                    {selectedTransaction.id}
                  </h2>
                  <div className="pt-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                      selectedTransaction.status === 'Paid' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                        : 'bg-rose-50 text-rose-700 border-rose-200/50 animate-pulse'
                    }`}>
                      {selectedTransaction.status === 'Paid' ? 'PAID & SETTLED' : 'PENDING DUE'}
                    </span>
                  </div>
                </div>

                {/* Patient Audit Segment */}
                <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Patient:</span>
                    <span className="font-bold text-slate-800">{selectedTransaction.patientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-bold text-slate-800">{selectedTransaction.patientPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-bold text-slate-800">{selectedTransaction.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Billing Clerk:</span>
                    <span className="font-bold text-indigo-600">{selectedTransaction.operatorName}</span>
                  </div>
                </div>

                {/* Itemized list details block */}
                <div className="space-y-2 border-b border-dashed border-slate-300 pb-2.5">
                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Itemized Billing</div>

                  {selectedTransaction.type === 'Pharmacy' && pharmacyBillDetails ? (
                    <div className="space-y-1.5">
                      {pharmacyBillDetails.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[9px] leading-tight">
                          <span className="text-slate-600 truncate max-w-[130px]">
                            {item.name} <span className="text-slate-400">x{item.qty}</span>
                          </span>
                          <span className="font-bold text-slate-800">
                            ₹{(item.price * item.qty).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-600">OPD Clinical Fees</span>
                      <span className="font-bold text-slate-800">
                        ₹{selectedTransaction.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="space-y-1 pb-1">
                  <div className="flex justify-between font-black text-xs pt-1.5 text-slate-900 border-t border-slate-900 mt-1">
                    <span>Total Amount:</span>
                    <span>₹{selectedTransaction.amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Barcode representation */}
                <div className="text-center pt-2.5 border-t border-dashed border-slate-300 space-y-1.5">
                  <div className="h-6 w-full bg-slate-900 mx-auto flex items-center justify-center text-[7px] text-white tracking-[6px] font-bold">
                    |||||||||||||||||||||||
                  </div>
                  <p className="text-[7px] text-slate-400 uppercase tracking-wider">
                    {selectedTransaction.status === 'Paid'
                      ? 'Thank you for cooperation'
                      : 'Please settle outstanding payment'}
                  </p>
                </div>

              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 font-bold rounded-full bg-indigo-600 hover:bg-indigo-700 flex gap-2 items-center justify-center text-xs h-10"
              >
                <Printer size={14} /> Execute Print
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedTxId(null);
                }}
                className="flex-1 font-bold rounded-full text-xs h-10"
              >
                Close Preview
              </Button>
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
}
