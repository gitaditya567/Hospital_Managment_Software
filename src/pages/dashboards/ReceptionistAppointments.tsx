import { useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { VitalsModal } from '../../components/VitalsModal';
import { printIsolatedHtml } from '../../utils/printHelper';
import { buildOpdQueueSlipHtml } from '../../utils/thermalSlipTemplates';
import { 
  Calendar as CalendarIcon, Clock, Users, Plus, ChevronLeft, ChevronRight, Activity, 
  UserPlus, Printer, CheckCircle2, CalendarDays, IndianRupee
} from 'lucide-react';

export function ReceptionistAppointments() {
  const { staff, patients, invoices, registerPatient, addPatientInvoice, collectPatientFeeDirectly } = useHospitalStore();
  const doctors = staff.filter(s => s.role === 'Doctor' && s.status === 'Active');

  const [selectedDoctor, setSelectedDoctor] = useState('All');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Helper for local time YYYY-MM-DD
  const formatToLocalYYYYMMDD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date Boundaries: No past dates, max 15 days in advance
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const max15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
  max15Days.setHours(23, 59, 59, 999);

  const todayStr = formatToLocalYYYYMMDD(today);
  const max15DaysStr = formatToLocalYYYYMMDD(max15Days);

  const [selectedDate, setSelectedDate] = useState(new Date().toDateString());
  const [apptDateInput, setApptDateInput] = useState(todayStr);

  // Real scheduled appointments state
  const [appointments, setAppointments] = useState<any[]>([]);

  // Form State
  const [newAppt, setNewAppt] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'Male',
    doctorId: doctors[0]?.id || '',
    time: '10:00 AM'
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Auto-fill existing patient state
  const [existingPatientFound, setExistingPatientFound] = useState<any | null>(null);

  // Patient vitals and diagnoses states for scheduler
  const [vitals, setVitals] = useState<Array<{ name: string; value: string }>>([]);
  const [pastDiagnoses, setPastDiagnoses] = useState('');
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);

  // Phone input auto-lookup handler
  const handlePhoneChange = (phoneInput: string) => {
    const cleanPhone = phoneInput.replace(/\D/g, '').slice(0, 10);
    setNewAppt(prev => ({ ...prev, phone: cleanPhone }));

    if (cleanPhone.length === 10) {
      const match = patients.find(p => p.phone === cleanPhone);
      if (match) {
        setExistingPatientFound(match);
        setNewAppt(prev => ({
          ...prev,
          name: match.name,
          age: match.age ? String(match.age) : prev.age,
          gender: match.gender || 'Male'
        }));
        if (match.vitals && match.vitals.length > 0) {
          setVitals(match.vitals);
        }
        if (match.pastDiagnoses) {
          setPastDiagnoses(match.pastDiagnoses);
        }
      } else {
        setExistingPatientFound(null);
      }
    } else {
      setExistingPatientFound(null);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const doc = doctors.find(d => d.id === newAppt.doctorId);
    if (!doc) return;

    // Local Date parsing
    const [y, m, d] = apptDateInput.split('-').map(Number);
    const chosenDateObj = new Date(y, m - 1, d);
    if (chosenDateObj < today || chosenDateObj > max15Days) {
      alert("Appointments can only be scheduled for Today or up to 15 days in advance.");
      return;
    }

    const apptDateFormatted = chosenDateObj.toDateString();

    // Register patient or update EMR
    const registered = await registerPatient({
      name: newAppt.name,
      phone: newAppt.phone,
      age: parseInt(newAppt.age) || 30,
      gender: newAppt.gender,
      doctorName: doc.name,
      vitals,
      pastDiagnoses,
      appointmentTime: newAppt.time,
      appointmentDate: apptDateFormatted,
      payNow: false
    } as any);

    addPatientInvoice({
      patientName: newAppt.name,
      patientPhone: newAppt.phone,
      amount: 500,
      status: 'Pending',
      doctorName: doc.name,
      feeType: 'OPD Consultation Fee'
    });

    // Store in appointments list and sync to global Zustand store for Doctor Console visibility
    const newEntry = {
      id: registered.id || `APPT-${Date.now()}`,
      patientNo: registered.patientNo || 'PAT-1001',
      patientName: newAppt.name,
      phone: newAppt.phone,
      age: parseInt(newAppt.age) || 30,
      gender: newAppt.gender,
      doctorId: doc.id,
      doctorName: doc.name,
      date: apptDateFormatted,
      time: newAppt.time,
      status: 'Confirmed (Fee Pending)',
      type: 'Scheduled',
      vitals,
      pastDiagnoses
    };

    setAppointments(prev => {
      const exists = prev.some(a => a.id === newEntry.id || (a.phone === newEntry.phone && a.patientName === newEntry.patientName && a.date === newEntry.date));
      return exists ? prev.map(a => (a.id === newEntry.id || (a.phone === newEntry.phone && a.patientName === newEntry.patientName && a.date === newEntry.date)) ? newEntry : a) : [newEntry, ...prev];
    });
    setSelectedDate(apptDateFormatted);

    // Reset Form
    setNewAppt({
      name: '',
      phone: '',
      age: '',
      gender: 'Male',
      doctorId: doctors[0]?.id || '',
      time: '10:00 AM'
    });
    setExistingPatientFound(null);
    setVitals([]);
    setPastDiagnoses('');
    setShowAddForm(false);
  };

  const handleApptCheckIn = async (appt: any, payNow: boolean) => {
    const newPatient = await registerPatient({
      name: appt.patientName,
      phone: appt.phone,
      age: appt.age,
      gender: appt.gender || 'Male',
      doctorName: appt.doctorName,
      vitals: appt.vitals || [],
      pastDiagnoses: appt.pastDiagnoses || '',
      appointmentTime: appt.time,
      appointmentDate: appt.date,
      payNow
    });

    if (payNow) {
      await collectPatientFeeDirectly(newPatient.id, 500, 'OPD Consultation Fee');
    } else {
      addPatientInvoice({
        patientName: appt.patientName,
        patientPhone: appt.phone,
        amount: 500,
        status: 'Pending',
        doctorName: appt.doctorName,
        feeType: 'OPD Consultation Fee'
      });
    }

    // Forcefully preserve appointmentDate & paymentStatus in store
    useHospitalStore.setState(state => ({
      patients: state.patients.map(p => 
        (p.id === newPatient.id || (p.phone === appt.phone && p.name === appt.patientName))
          ? { ...p, appointmentDate: appt.date, paymentStatus: payNow ? 'Paid' : p.paymentStatus }
          : p
      )
    }));

    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: payNow ? 'Checked-In (Paid)' : 'Checked-In (Fee Pending)' } : a));
    alert(`Appointment for "${appt.patientName}" checked in into live OPD queue (Token: ${newPatient.tokenNumber})!`);
  };

  // Generate calendar days
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, 1);
    const days = [];

    const firstDayIndex = date.getDay();
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const days = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Helper for timezone-safe date string parsing
  const parseToDateString = (dateVal: any) => {
    if (!dateVal) return new Date().toDateString();
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [y, m, d] = dateVal.split('-').map(Number);
      return new Date(y, m - 1, d).toDateString();
    }
    const dObj = new Date(dateVal);
    return !isNaN(dObj.getTime()) ? dObj.toDateString() : new Date().toDateString();
  };

  // Deduplicate and combine master patient directory with scheduler appointments
  const allAppointmentsMap = new Map();

  patients.forEach(p => {
    const pInv = invoices.find(i => i.patientName === p.name || i.patientPhone === p.phone);
    const isPaid = p.paymentStatus === 'Paid' || pInv?.status === 'Paid';
    const apptDateStr = parseToDateString((p as any).appointmentDate || p.createdAt);
    const doc = doctors.find(d => d.name === p.doctorName) || doctors[0];
    const key = `${p.phone}-${p.name}`.toLowerCase();
    
    allAppointmentsMap.set(key, {
      id: p.id,
      patientNo: p.patientNo || 'PAT-1001',
      patientName: p.name,
      phone: p.phone,
      age: p.age,
      gender: p.gender || 'Male',
      doctorId: doc?.id || 'EMP-001',
      doctorName: p.doctorName,
      date: apptDateStr,
      time: p.appointmentTime || 'OPD Walk-In',
      status: isPaid ? 'Checked-In (Paid)' : 'Confirmed (Fee Pending)',
      paymentStatus: isPaid ? 'Paid' : 'Pending',
      type: p.appointmentTime ? 'Scheduled' : 'Walk-In',
      vitals: p.vitals || [],
      pastDiagnoses: p.pastDiagnoses || ''
    });
  });

  appointments.forEach(a => {
    const key = `${a.phone}-${a.patientName}`.toLowerCase();
    if (!allAppointmentsMap.has(key)) {
      allAppointmentsMap.set(key, a);
    } else {
      const existing = allAppointmentsMap.get(key);
      if (a.status.includes('Paid')) {
        existing.status = a.status;
        existing.paymentStatus = 'Paid';
      }
    }
  });

  const allAppointments = Array.from(allAppointmentsMap.values());

  const filteredAppointments = allAppointments.filter(appt => {
    const matchesDoctor = selectedDoctor === 'All' || appt.doctorId === selectedDoctor;
    const matchesDate = appt.date === selectedDate;
    return matchesDoctor && matchesDate;
  });

  // KPI Calculations for Selected Date
  const totalCountForDate = filteredAppointments.length;
  const paidCountForDate = filteredAppointments.filter(a => a.status.includes('Paid') || a.paymentStatus === 'Paid').length;
  const pendingCountForDate = totalCountForDate - paidCountForDate;

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#3683F8] p-6 rounded-2xl shadow-lg border border-blue-400/30 text-white relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white animate-ping"></span>
            <span className="text-[10px] font-extrabold text-blue-100 uppercase tracking-widest">Appointments Manager</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
            <CalendarIcon size={24} className="text-blue-100" /> Doctor Schedules &amp; Booking Console
          </h1>
          <p className="text-blue-50 text-xs font-semibold">
            Book slots, auto-lookup registered patients, enforce 15-day limit, and track payment status
          </p>
        </div>
        <Button onClick={() => {
          if (doctors.length > 0) {
            setNewAppt(prev => ({ ...prev, doctorId: doctors[0].id }));
          }
          const selObj = new Date(selectedDate);
          if (!isNaN(selObj.getTime())) {
            setApptDateInput(formatToLocalYYYYMMDD(selObj));
          }
          setShowAddForm(!showAddForm);
        }} className="h-11 px-5 text-xs font-extrabold gap-2 bg-white text-[#3683F8] hover:bg-blue-50 rounded-xl shadow-md flex items-center border border-white/30 z-10">
          <Plus size={16} /> Book New Appointment
        </Button>
      </div>

      {/* Selected Date Summary KPIs Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#D8D8D8] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bookings for Date</p>
            <h3 className="text-xl font-black text-[#060606] mt-0.5">{totalCountForDate} Patients</h3>
            <p className="text-[10px] text-blue-600 font-bold truncate max-w-[170px]">{selectedDate}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[#EBF3FE] text-[#3683F8] flex items-center justify-center font-bold">
            <CalendarDays size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D8D8D8] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Paid Appointments</p>
            <h3 className="text-xl font-black text-emerald-700 mt-0.5">{paidCountForDate} Cleared</h3>
            <p className="text-[10px] text-emerald-600 font-bold">Fee collected ✓</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D8D8D8] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Pending Due</p>
            <h3 className="text-xl font-black text-rose-600 mt-0.5">{pendingCountForDate} Unpaid</h3>
            <p className="text-[10px] text-rose-500 font-bold">Collect at reception</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Card */}
        <div className="bg-white rounded-2xl p-5 border border-[#D8D8D8] shadow-xs flex flex-col">
          <div className="flex justify-between items-center mb-3 border-b border-[#D8D8D8] pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-[#060606] tracking-tight">Select Date</h2>
              <p className="text-[10px] text-slate-400 font-bold">Max 15 Days Ahead</p>
            </div>
            <div className="flex gap-1 items-center">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                className="p-1.5 hover:bg-[#EBF3FE] rounded-full text-slate-600 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-[#060606] px-1">
                {currentMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                className="p-1.5 hover:bg-[#EBF3FE] rounded-full text-slate-600 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
            {weekDays.map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1 flex-1">
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-9"></div>;
              const dateStr = day.toDateString();
              const isSelected = selectedDate === dateStr;
              const isToday = new Date().toDateString() === dateStr;

              // Date boundaries check
              const dayObj = new Date(day);
              dayObj.setHours(0,0,0,0);
              const isPast = dayObj < today;
              const isTooFar = dayObj > max15Days;
              const isDisabled = isPast || isTooFar;

              const apptCount = allAppointments.filter(a => a.date === dateStr).length;

              return (
                <button
                  key={dateStr}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      setSelectedDate(dateStr);
                      setApptDateInput(formatToLocalYYYYMMDD(day));
                    }
                  }}
                  title={isDisabled ? (isPast ? 'Past date not allowed' : 'Max 15 days ahead') : dateStr}
                  className={`h-10 rounded-xl flex flex-col items-center justify-center text-xs font-semibold relative transition-all duration-150 ${
                    isDisabled ? 'opacity-30 cursor-not-allowed bg-slate-50 text-slate-400' :
                    isSelected ? 'bg-[#3683F8] text-white font-extrabold shadow-xs scale-105' : 
                    isToday ? 'bg-[#EBF3FE] text-[#3683F8] border border-blue-300 font-bold' :
                    'hover:bg-[#EBF3FE]/50 text-[#060606]'
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {apptCount > 0 && !isDisabled && (
                    <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${isSelected ? 'bg-white' : 'bg-[#3683F8]'}`}></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule & Appointment List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add Form */}
          {showAddForm && (
            <div className="bg-white border border-[#D8D8D8] rounded-2xl p-5 shadow-xs space-y-4 animate-in slide-in-from-top duration-200">
              <div className="flex justify-between items-center border-b border-[#D8D8D8] pb-2">
                <h2 className="text-sm font-extrabold text-[#060606] flex items-center gap-1.5">
                  <Plus size={16} className="text-[#3683F8]" /> New Appointment Form
                </h2>
                <span className="text-[10px] font-bold text-[#3683F8] bg-[#EBF3FE] px-2.5 py-1 rounded-lg">
                  15-Day Booking Limit Active
                </span>
              </div>

              {/* Auto-fill Notification Banner */}
              {existingPatientFound && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      Registered Patient Found: <strong>{existingPatientFound.name}</strong> ({existingPatientFound.patientNo || 'PAT-1001'}). Medical details auto-filled!
                    </span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">
                    {existingPatientFound.phone}
                  </span>
                </div>
              )}

              <form onSubmit={handleCreateAppointment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Phone Number (Auto-Lookup)"
                  required
                  value={newAppt.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="Enter 10-digit mobile"
                  className="border-[#D8D8D8] text-xs font-mono"
                />

                <Input
                  label="Patient Full Name"
                  required
                  value={newAppt.name}
                  onChange={e => setNewAppt({ ...newAppt, name: e.target.value })}
                  placeholder="e.g. Rahul Verma"
                  className="border-[#D8D8D8] text-xs font-bold"
                />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Age (Years)"
                    type="number"
                    required
                    value={newAppt.age}
                    onChange={e => setNewAppt({ ...newAppt, age: e.target.value })}
                    placeholder="e.g. 34"
                    className="border-[#D8D8D8] text-xs font-mono"
                  />

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gender</label>
                    <select
                      className="flex h-10 w-full rounded-xl border border-[#D8D8D8] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] font-bold text-[#060606]"
                      value={newAppt.gender}
                      onChange={e => setNewAppt({ ...newAppt, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Appointment Date</label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      max={max15DaysStr}
                      value={apptDateInput}
                      onChange={e => {
                        const val = e.target.value;
                        setApptDateInput(val);
                        if (val) {
                          const [y, m, d] = val.split('-').map(Number);
                          const selObj = new Date(y, m - 1, d);
                          setSelectedDate(selObj.toDateString());
                        }
                      }}
                      className="flex h-10 w-full rounded-xl border border-[#D8D8D8] bg-white px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Slot Time</label>
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-xl border border-[#D8D8D8] bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                      value={newAppt.time}
                      onChange={e => setNewAppt({ ...newAppt, time: e.target.value })}
                      placeholder="10:00 AM"
                    />
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Consulting Physician</label>
                  <select
                    className="flex h-10 w-full rounded-xl border border-[#D8D8D8] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] font-bold text-[#060606]"
                    value={newAppt.doctorId}
                    onChange={e => setNewAppt({ ...newAppt, doctorId: e.target.value })}
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.department || 'General OPD'})</option>
                    ))}
                  </select>
                </div>

                {/* Vitals */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Clinical Vitals &amp; Medical History</label>
                  <button
                    type="button"
                    onClick={() => setIsVitalsModalOpen(true)}
                    className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all duration-200 ${
                      vitals.length > 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-blue-200 bg-[#EBF3FE] text-[#3683F8]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Activity size={14} className={vitals.length > 0 ? "animate-pulse text-emerald-600" : "text-[#3683F8]"} />
                      {vitals.length > 0 ? 'Vitals & History Saved' : 'Add Vitals & Medical History'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                      vitals.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-[#3683F8]'
                    }`}>
                      {vitals.length > 0 ? `${vitals.length} Recorded` : 'Pending'}
                    </span>
                  </button>

                  {vitals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 p-2 bg-emerald-50/30 border border-emerald-100/40 rounded-lg max-h-16 overflow-y-auto">
                      {vitals.map(v => (
                        <span key={v.name} className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-emerald-100 text-emerald-700 rounded-md">
                          {v.name.replace('Pressure', 'BP').replace('Temperature', 'Temp')}: {v.value}
                        </span>
                      ))}
                      {pastDiagnoses && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-[#D8D8D8] text-slate-500 rounded-md truncate max-w-[200px]" title={pastDiagnoses}>
                          Dx: {pastDiagnoses}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 pt-2 border-t border-[#D8D8D8] flex justify-end gap-2.5">
                  <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)} className="text-xs font-bold">Cancel</Button>
                  <Button type="submit" className="bg-[#3683F8] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md px-6">
                    Confirm Appointment Slot
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* List Card */}
          <div className="bg-white rounded-2xl p-5 border border-[#D8D8D8] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#D8D8D8] pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#060606] tracking-tight">
                  Bookings for {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Real-time doctor appointment &amp; payment tracking</p>
              </div>
              <div className="space-y-1">
                <select
                  className="flex h-9 w-full rounded-xl border border-[#D8D8D8] bg-[#EBF3FE]/40 px-3 py-1.5 text-xs font-extrabold text-[#060606] focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                  value={selectedDoctor}
                  onChange={e => setSelectedDoctor(e.target.value)}
                >
                  <option value="All">All Doctors ({doctors.length})</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="divide-y divide-[#D8D8D8]/60 overflow-hidden">
              {filteredAppointments.map(appt => {
                const pInv = invoices.find(i => i.patientName === appt.patientName || i.patientPhone === appt.phone);
                const isPaid = appt.status.includes('Paid') || appt.paymentStatus === 'Paid' || pInv?.status === 'Paid';

                return (
                  <div key={appt.id} className="py-3.5 flex items-center justify-between hover:bg-[#EBF3FE]/20 px-2 rounded-xl transition-all duration-150">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-[#060606]">{appt.patientName}</span>
                        <span className="text-[10px] font-bold text-[#3683F8] bg-[#EBF3FE] px-1.5 py-0.5 rounded font-mono">
                          {appt.patientNo || 'PAT-1001'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">({appt.age} Yrs / {appt.gender || 'Male'})</span>
                        <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-md font-bold ${
                          appt.type === 'Walk-In' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-[#EBF3FE] text-[#3683F8] border border-blue-200'
                        }`}>
                          {appt.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1"><Clock size={12} className="text-[#3683F8]" /> {appt.time}</span>
                        <span className="flex items-center gap-1"><Users size={12} className="text-slate-400" /> {appt.doctorName}</span>
                        <span className="text-slate-400 font-mono">{appt.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Payment Status Badge */}
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {isPaid ? <CheckCircle2 size={11} className="text-emerald-600" /> : <Clock size={11} className="text-rose-500" />}
                        {isPaid ? 'Paid ₹500 ✓' : 'Pending ₹500 ⏳'}
                      </span>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {!isPaid ? (
                          <button
                            type="button"
                            onClick={() => handleApptCheckIn(appt, true)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all"
                            title="Collect Fee ₹500 & Check-In into Doctor Queue"
                          >
                            <IndianRupee size={11} /> Collect &amp; Check-In
                          </button>
                        ) : (
                          !appt.status.includes('Checked-In') && (
                            <button
                              type="button"
                              onClick={() => handleApptCheckIn(appt, true)}
                              className="px-2.5 py-1 bg-[#3683F8] hover:bg-blue-600 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all"
                              title="Check-in into Doctor Queue"
                            >
                              <UserPlus size={11} /> Check-In
                            </button>
                          )
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const slipHtml = buildOpdQueueSlipHtml({
                              tokenNumber: appt.tokenNumber || 'APP-01',
                              patientName: appt.patientName,
                              patientId: appt.id,
                              patientNo: appt.patientNo || 'PAT-1001',
                              age: appt.age,
                              gender: appt.gender || 'Male',
                              phone: appt.phone,
                              doctorName: appt.doctorName,
                              feeType: 'OPD Consultation Fee',
                              amount: 500,
                              date: appt.date
                            });
                            printIsolatedHtml("OPD Appointment Slip", slipHtml);
                          }}
                          className="p-1.5 hover:bg-[#EBF3FE] text-[#3683F8] rounded-xl text-xs font-bold border border-blue-200 transition-colors"
                          title="Print Thermal Slip"
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredAppointments.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold space-y-1">
                  <CalendarDays size={28} className="mx-auto text-slate-300 opacity-60" />
                  <p>No appointments scheduled for this physician on {selectedDate}.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <VitalsModal
        isOpen={isVitalsModalOpen}
        onClose={() => setIsVitalsModalOpen(false)}
        onSave={(savedVitals, savedDiagnoses) => {
          setVitals(savedVitals);
          setPastDiagnoses(savedDiagnoses);
        }}
        initialVitals={vitals}
        initialPastDiagnoses={pastDiagnoses}
      />
    </div>
  );
}

