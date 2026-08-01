import { useHospitalStore } from '../../store/useHospitalStore';
import { Users, CheckCircle, Clock, IndianRupee, CalendarDays, Search } from 'lucide-react';
import { useState } from 'react';

export function HospitalAdminAppointments() {
  const { patients, invoices, staff } = useHospitalStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Waiting' | 'In Consultation' | 'Completed'>('All');

  // Stats
  const totalPatients = patients.length;
  const completed = patients.filter(p => p.status === 'Completed').length;
  const pending = patients.filter(p => p.status === 'Waiting' || p.status === 'In Consultation').length;

  // Payment lookup from invoices by patient name
  const getPayment = (patientName: string) => {
    const inv = invoices.find(i => i.patientName === patientName);
    if (!inv) return { amount: 0, status: 'N/A' };
    return { amount: inv.amount, status: inv.status };
  };

  // Department lookup from staff
  const getDepartment = (doctorName: string) => {
    const doc = staff.find(s => s.name === doctorName);
    return doc?.department || '—';
  };

  // Filtered list
  const filtered = patients.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = invoices
    .filter(i => i.status === 'Paid')
    .reduce((acc, i) => acc + i.amount, 0);

  return (
    <div className="space-y-6 pb-20 font-sans">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#3683F8] p-6 rounded-2xl shadow-lg border border-blue-400/30 relative overflow-hidden text-white shadow-blue-500/10">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-white/10 rounded-full blur-3xl -z-10"></div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-pulse"></span>
            <span className="text-xs font-semibold text-blue-100 uppercase tracking-widest">Live OPD Registry</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <CalendarDays size={22} className="text-blue-100" /> Appointments Overview
          </h1>
          <p className="text-blue-50 text-xs">Real-time patient appointment tracking and payment status.</p>
        </div>
        <div className="text-xs bg-white/15 px-4 py-2.5 rounded-xl border border-white/20 text-white font-semibold backdrop-blur-xs">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Total Patients */}
        <div className="bg-white rounded-2xl border border-[#D8D8D8] shadow-xs p-5 flex items-center justify-between hover:shadow-md transition-all">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-[#3683F8] uppercase tracking-widest">Total Patients</p>
            <h2 className="text-3xl font-extrabold text-[#060606] tracking-tight">{totalPatients}</h2>
            <p className="text-[10px] text-slate-400 font-semibold">Registered today in queue</p>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-[#EBF3FE] border border-blue-200 text-[#3683F8] flex items-center justify-center">
            <Users size={24} />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-2xl border border-[#D8D8D8] shadow-xs p-5 flex items-center justify-between hover:shadow-md transition-all">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Completed</p>
            <h2 className="text-3xl font-extrabold text-[#060606] tracking-tight">{completed}</h2>
            <p className="text-[10px] text-slate-400 font-semibold">Consultations finished</p>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
            <CheckCircle size={24} />
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-2xl border border-[#D8D8D8] shadow-xs p-5 flex items-center justify-between hover:shadow-md transition-all">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest">Pending / In Progress</p>
            <h2 className="text-3xl font-extrabold text-[#060606] tracking-tight">{pending}</h2>
            <p className="text-[10px] text-slate-400 font-semibold">Waiting + In Consultation</p>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#D8D8D8] overflow-hidden">

        {/* Table Toolbar */}
        <div className="px-6 py-4 border-b border-[#D8D8D8] bg-[#EBF3FE]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-[#060606]">Patient Appointments</h2>
            <p className="text-xs text-slate-400 font-medium">All registered patients with consultation &amp; payment details</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, doctor, token..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 h-9 text-xs border border-[#D8D8D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] w-52 font-medium bg-white text-[#060606]"
              />
            </div>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="h-9 text-xs border border-[#D8D8D8] rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] font-semibold text-[#060606] bg-white"
            >
              <option value="All">All Status</option>
              <option value="Waiting">Waiting</option>
              <option value="In Consultation">In Consultation</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EBF3FE]/50 border-b border-[#D8D8D8] text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Token</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8D8D8]/60 text-xs">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 font-semibold">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarDays size={28} className="text-slate-300" />
                      No appointments found{searchQuery ? ` for "${searchQuery}"` : ''}.
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((patient) => {
                const isWaiting = patient.status === 'Waiting';
                const isConsulting = patient.status === 'In Consultation';
                const payment = getPayment(patient.name);
                const dept = getDepartment(patient.doctorName);

                return (
                  <tr key={patient.id} className="hover:bg-[#EBF3FE]/20 transition-colors group">
                    {/* Token */}
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-[#EBF3FE] text-[#3683F8] border border-blue-200 rounded-lg font-mono font-bold text-[10px]">
                        {patient.tokenNumber}
                      </span>
                    </td>

                    {/* Patient */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#060606] group-hover:text-[#3683F8] transition-colors">{patient.name}</div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{patient.age} Yrs • {patient.gender || 'N/A'}</div>
                    </td>

                    {/* Doctor */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-[#EBF3FE] border border-blue-200 text-[#3683F8] flex items-center justify-center font-bold text-[10px] shrink-0">
                          {patient.doctorName.replace('Dr. ', '').charAt(0)}
                        </div>
                        <span className="font-semibold text-[#060606]">{patient.doctorName}</span>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-[#EBF3FE] text-[#3683F8] border border-blue-200 rounded-md font-semibold text-[10px]">
                        {dept}
                      </span>
                    </td>

                    {/* Time */}
                    <td className="px-6 py-4 text-slate-500 font-mono font-semibold">
                      {patient.timeRegistered}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        isWaiting
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : isConsulting
                          ? 'bg-[#EBF3FE] text-[#3683F8] border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isWaiting ? 'bg-amber-500' : isConsulting ? 'bg-[#3683F8] animate-pulse' : 'bg-emerald-500'
                        }`}></span>
                        {patient.status}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td className="px-6 py-4">
                      {payment.status === 'N/A' ? (
                        <span className="text-slate-400 font-semibold text-[10px]">Not Billed</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          payment.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${payment.status === 'Paid' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></span>
                          {payment.status}
                        </span>
                      )}
                    </td>

                    {/* Amount collected */}
                    <td className="px-6 py-4">
                      {payment.amount > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#060606]">
                          <IndianRupee size={11} className="text-[#3683F8]" />
                          {payment.amount.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-semibold text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-3 border-t border-[#D8D8D8] bg-[#EBF3FE]/30 flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-slate-400 font-semibold">
            Showing <span className="text-[#060606] font-bold">{filtered.length}</span> of{' '}
            <span className="text-[#060606] font-bold">{totalPatients}</span> appointments
          </p>
          <div className="flex items-center gap-4 text-[11px] font-bold">
            <span className="text-[#3683F8] flex items-center gap-1">
              <IndianRupee size={11} /> Total Collected: ₹{totalRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
              Live Sync Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
