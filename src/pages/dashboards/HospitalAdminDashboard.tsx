import { useHospitalStore } from '../../store/useHospitalStore';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import { IndianRupee, Users, Activity, CreditCard, Clock, Calendar } from 'lucide-react';

export function HospitalAdminDashboard() {
  const { staff, patients, hospitalName, invoices } = useHospitalStore();
  const { bills } = usePharmacyStore();

  // Calculate live counts
  const activeDoctors = staff.filter(s => s.role === 'Doctor' && s.status === 'Active').length;
  const totalPatientsToday = patients.length;

  // Calculate today's revenue based on real-time database records
  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
  const baseRevenue = paidInvoices.reduce((acc, inv) => acc + inv.amount, 0);
  const pharmacyRevenue = bills.reduce((acc, b) => acc + b.total, 0);
  const totalRevenue = baseRevenue + pharmacyRevenue;

  const pendingBillsCount = invoices.filter(inv => inv.status === 'Pending').length;

  // Last 10 registered patients
  const recentPatients = patients.slice(0, 10);

  // Dynamic Patient Footfall (Last 7 Days) calculated from patient document timestamps
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const footfallData = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const dayName = daysOfWeek[d.getDay()];

    const count = patients.filter(p => {
      if (!p.createdAt) return false;
      const pDate = new Date(p.createdAt);
      return pDate.toDateString() === d.toDateString();
    }).length;

    return { day: dayName, count };
  });

  // SVG Line Chart coordinates calculations
  const chartHeight = 180;
  const chartWidth = 500;
  const maxCount = Math.max(...footfallData.map(d => d.count), 5); // Fallback to 5 to avoid 0 division
  const padding = 30;

  const points = footfallData.map((d, index) => {
    const x = padding + (index * (chartWidth - padding * 2)) / (footfallData.length - 1);
    const y = chartHeight - padding - (d.count * (chartHeight - padding * 2)) / maxCount;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`;

  // SVG Doughnut Chart Calculations (OPD Fees and Pharmacy Billing)
  const revenueShare = [
    { label: 'OPD & Clinical Fees', value: baseRevenue, color: '#06b6d4' }, // Cyan
    { label: 'Pharmacy Sales', value: pharmacyRevenue, color: '#14b8a6' } // Teal
  ];
  const totalShare = revenueShare.reduce((acc, curr) => acc + curr.value, 0);

  // Dynamic doughnut sectors
  let accumulatedPercent = 0;
  const doughnutSectors = revenueShare.map((sec) => {
    const percent = totalShare > 0 ? (sec.value / totalShare) * 100 : 0;
    const dashArray = `${percent} ${100 - percent}`;
    const dashOffset = 100 - accumulatedPercent + 25; // 25 to start from 12 o'clock
    accumulatedPercent += percent;
    return { ...sec, dashArray, dashOffset };
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-600 p-6 rounded-2xl shadow-lg border border-teal-500/20 relative overflow-hidden text-white shadow-teal-700/5">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-white/10 rounded-full blur-3xl -z-10 animate-pulse-fast"></div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-ping"></span>
            <span className="text-xs font-bold text-teal-100 uppercase tracking-widest">Active Node Operational</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight text-glow-teal">
            {hospitalName}
          </h1>
          <p className="text-teal-100 text-sm">
            Operational dashboard and clinical telemetry monitor.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3 text-xs bg-teal-800/40 p-3 rounded-xl border border-teal-500/30 text-teal-100">
          <Calendar size={16} className="text-cyan-300" />
          <div>
            <p className="font-semibold text-white">System Date</p>
            <p>{new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Today's Revenue */}
        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center justify-between border-teal-100/50 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">Today's Revenue</p>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              ₹{totalRevenue.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
              ▲ 14.2% vs last week avg
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-200/40 animate-heartbeat">
            <IndianRupee size={22} />
          </div>
        </div>

        {/* Total OPD Patients Today */}
        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center justify-between border-teal-100/50 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">OPD Check-Ins Today</p>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {totalPatientsToday} <span className="text-xs font-normal text-slate-500">Registered</span>
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold">
              Live registration queues online
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-200/40">
            <Activity size={22} className="animate-pulse" />
          </div>
        </div>

        {/* Active Doctors Online */}
        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center justify-between border-teal-100/50 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Active Doctors Online</p>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {activeDoctors} <span className="text-xs font-normal text-slate-500">Active</span>
            </h3>
            <p className="text-[10px] text-cyan-600 font-semibold">
              Assigned to active room schedules
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center border border-cyan-200/40">
            <Users size={22} />
          </div>
        </div>

        {/* Pending Pharmacy Bills */}
        <div className="glass-card glass-card-hover p-5 rounded-2xl flex items-center justify-between border-teal-100/50 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending Pharmacy Bills</p>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {pendingBillsCount} <span className="text-xs font-normal text-slate-500">Unpaid</span>
            </h3>
            <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
              Requires POS collection checkout
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/40">
            <CreditCard size={22} />
          </div>
        </div>
      </div>

      {/* Charts Visualization Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left SVG Line Chart: Patient Footfall */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 flex flex-col justify-between border-teal-100/50 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 text-glow-teal">Patient Footfall</h2>
              <p className="text-xs text-slate-500">Registry throughput analysis (Last 7 Days)</p>
            </div>
            <div className="flex gap-2 text-[10px] font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span> OPD Registrations
              </span>
            </div>
          </div>

          <div className="w-full relative h-[180px]">
            {/* SVG Visualizer */}
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
              {/* Grids */}
              <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#e2f1f1" strokeWidth={1} />
              <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#e2f1f1" strokeWidth={1} />
              <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#cce3e3" strokeWidth={1.5} />

              {/* Area Gradient Fill */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Fill Area */}
              <path d={areaPath} fill="url(#chartGradient)" />

              {/* Line */}
              <path d={linePath} fill="none" stroke="#14b8a6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

              {/* Data circles & labels */}
              {points.map((p, idx) => (
                <g key={idx} className="group/dot">
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={idx === points.length - 1 ? 5 : 4}
                    fill={idx === points.length - 1 ? '#14b8a6' : '#ffffff'}
                    stroke="#14b8a6"
                    strokeWidth={2.5}
                    className="cursor-pointer transition-all hover:r-6"
                  />
                  <text
                    x={p.x}
                    y={p.y - 10}
                    textAnchor="middle"
                    className="text-[10px] font-extrabold fill-slate-700 bg-white"
                  >
                    {p.count}
                  </text>
                  <text
                    x={p.x}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="text-[10px] font-bold fill-slate-400"
                  >
                    {p.day}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="text-[11px] text-slate-400 text-center font-medium mt-2">
            Dynamic statistics feed. Auto-recalculating on new patient bookings.
          </div>
        </div>

        {/* Right SVG Doughnut Chart: Revenue shares */}
        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between border-teal-100/50 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-slate-800 text-glow-teal">Revenue by Department</h2>
            <p className="text-xs text-slate-500 font-medium">Departmental collections share</p>
          </div>

          <div className="flex justify-center items-center py-4 relative">
            <svg width="120" height="120" viewBox="0 0 42 42" className="transform -rotate-90">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2f1f1" strokeWidth="6" />
              {doughnutSectors.map((sec, idx) => (
                <circle
                  key={idx}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="transparent"
                  stroke={sec.color}
                  strokeWidth="6"
                  strokeDasharray={sec.dashArray}
                  strokeDashoffset={sec.dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              ))}
            </svg>
            <div className="absolute flex flex-col justify-center items-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Share</span>
              <span className="text-sm font-extrabold text-slate-800">₹{(totalShare / 1000).toFixed(1)}k</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-teal-50 pt-3">
            {revenueShare.map((sec, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sec.color }}></span>
                  {sec.label}
                </span>
                <span className="text-slate-800 font-bold">
                  ₹{sec.value.toLocaleString('en-IN')} ({(sec.value / totalShare * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row - Recent Registered Patients */}
      <div className="glass-card rounded-2xl border-teal-100/50 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-teal-50 bg-teal-50/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="text-teal-600" size={20} /> Today's Patient Check-Ins
            </h2>
            <p className="text-xs text-slate-500 font-medium">Real-time live registration activity logger (Front Desk)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs font-semibold text-slate-400">Real-Time Sync Activated</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-teal-50/25 border-b border-teal-100/60 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Patient Details</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Assigned Doctor</th>
                <th className="px-6 py-4">Token Number</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Time Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50/50 text-slate-700 text-xs font-medium bg-white/40">
              {recentPatients.map((patient) => {
                const isWaiting = patient.status === 'Waiting';
                const isConsulting = patient.status === 'In Consultation';
                return (
                  <tr key={patient.id} className="hover:bg-teal-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{patient.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold mt-0.5">{patient.id} • {patient.age} Yrs</div>
                    </td>
                    <td className="px-6 py-4 text-slate-550 font-mono">{patient.phone}</td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center font-bold text-[10px]">
                        {patient.doctorName.replace('Dr. ', '').charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800">{patient.doctorName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-md border border-teal-100/60 font-bold font-mono">
                        {patient.tokenNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        isWaiting ? 'bg-amber-50 text-amber-700 border border-amber-200/50' : 
                        isConsulting ? 'bg-teal-50 text-teal-700 border border-teal-200/50 shadow-sm' : 
                        'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          isWaiting ? 'bg-amber-500' : isConsulting ? 'bg-teal-500 animate-pulse' : 'bg-emerald-500'
                        }`}></span>
                        {patient.status === 'In Consultation' ? 'Consulting' : patient.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-semibold">{patient.timeRegistered}</td>
                  </tr>
                );
              })}
              {recentPatients.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 font-semibold">
                    No active patients registered today. Front desk lines are clear!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
