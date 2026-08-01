import { useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { VitalsModal } from '../../components/VitalsModal';
import { Calendar as CalendarIcon, Clock, Users, Plus, ChevronLeft, ChevronRight, Check, Activity, UserPlus, CreditCard } from 'lucide-react';

export function ReceptionistAppointments() {
  const { staff, patients, registerPatient, addPatientInvoice } = useHospitalStore();
  const doctors = staff.filter(s => s.role === 'Doctor' && s.status === 'Active');

  const [selectedDoctor, setSelectedDoctor] = useState('All');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toDateString());

  // Real scheduled appointments list initialized empty (No hardcoded dummy entries)
  const [appointments, setAppointments] = useState<any[]>([]);

  const [newAppt, setNewAppt] = useState({ name: '', phone: '', age: '', doctorId: '', time: '10:00 AM' });
  const [showAddForm, setShowAddForm] = useState(false);

  // Patient vitals and diagnoses states for scheduler
  const [vitals, setVitals] = useState<Array<{ name: string; value: string }>>([]);
  const [pastDiagnoses, setPastDiagnoses] = useState('');
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const doc = doctors.find(d => d.id === newAppt.doctorId);
    if (!doc) return;

    // Save directly to Master Patient Directory & EMR database
    await registerPatient({
      name: newAppt.name,
      phone: newAppt.phone,
      age: parseInt(newAppt.age) || 30,
      gender: 'Male',
      doctorName: doc.name,
      vitals,
      pastDiagnoses,
      appointmentTime: newAppt.time,
      payNow: false
    });

    addPatientInvoice({
      patientName: newAppt.name,
      patientPhone: newAppt.phone,
      amount: 500,
      status: 'Pending',
      doctorName: doc.name,
      feeType: 'OPD Consultation Fee'
    });

    setNewAppt({ name: '', phone: '', age: '', doctorId: '', time: '10:00 AM' });
    setVitals([]);
    setPastDiagnoses('');
    setShowAddForm(false);
  };

  const handleApptCheckIn = async (appt: any, payNow: boolean) => {
    const newPatient = await registerPatient({
      name: appt.patientName,
      phone: appt.phone,
      age: appt.age,
      gender: 'Male',
      doctorName: appt.doctorName,
      vitals: appt.vitals || [],
      pastDiagnoses: appt.pastDiagnoses || '',
      appointmentTime: appt.time,
      payNow
    });

    addPatientInvoice({
      patientName: appt.patientName,
      patientPhone: appt.phone,
      amount: 500,
      status: payNow ? 'Paid' : 'Pending',
      doctorName: appt.doctorName,
      feeType: 'OPD Consultation Fee'
    });

    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: 'Checked-In (Live Queue)' } : a));
    alert(`Appointment for "${appt.patientName}" checked in into live OPD queue (Token: ${newPatient.tokenNumber})!`);
  };

  // Generate calendar days
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, 1);
    const days = [];

    // Fill leading empty slots
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

  // Combine master patient directory records with scheduler
  const allAppointments = [
    ...patients.map(p => ({
      id: p.id,
      patientName: p.name,
      phone: p.phone,
      age: p.age,
      doctorId: doctors.find(d => d.name === p.doctorName)?.id || 'EMP-001',
      doctorName: p.doctorName,
      date: p.createdAt ? new Date(p.createdAt).toDateString() : new Date().toDateString(),
      time: p.appointmentTime || 'OPD Walk-In',
      status: p.paymentStatus === 'Paid' ? 'Checked-In (Paid)' : 'Confirmed (Fee Pending)',
      type: p.appointmentTime ? 'Scheduled' : 'Walk-In',
      vitals: p.vitals || [],
      pastDiagnoses: p.pastDiagnoses || ''
    })),
    ...appointments.filter(a => !patients.some(p => p.id === a.id))
  ];

  const filteredAppointments = allAppointments.filter(appt => {
    const matchesDoctor = selectedDoctor === 'All' || appt.doctorId === selectedDoctor;
    const matchesDate = appt.date === selectedDate;
    return matchesDoctor && matchesDate;
  });

  return (
    <div className="space-y-6 font-sans pb-16">
      <div className="flex justify-between items-center bg-[#3683F8] p-6 rounded-2xl shadow-lg border border-blue-400/30 text-white relative overflow-hidden">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <CalendarIcon size={22} className="text-blue-100" /> Doctor Schedules &amp; Appointment Manager
          </h1>
          <p className="text-blue-50 text-xs">Manage bookings, schedule calendar timelines, and assign clinical queues</p>
        </div>
        <Button onClick={() => {
          if (doctors.length > 0) {
            setNewAppt(prev => ({ ...prev, doctorId: doctors[0].id }));
          }
          setShowAddForm(!showAddForm);
        }} className="h-10 px-5 text-xs font-bold gap-2 bg-white text-[#3683F8] hover:bg-blue-50 rounded-xl shadow-md flex items-center border border-white/30">
          <Plus size={16} /> Book Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Card */}
        <div className="bg-white rounded-2xl p-5 border border-[#D8D8D8] shadow-xs flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-[#D8D8D8] pb-3">
            <h2 className="text-sm font-extrabold text-[#060606] tracking-tight">Select Date</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                className="p-1.5 hover:bg-[#EBF3FE] rounded-full text-slate-600 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-[#060606] px-2 flex items-center">
                {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
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
              const apptCount = appointments.filter(a => a.date === dateStr).length;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-10 rounded-xl flex flex-col items-center justify-center text-xs font-semibold relative transition-all duration-150 ${
                    isSelected ? 'bg-[#3683F8] text-white font-extrabold shadow-xs' : 
                    isToday ? 'bg-[#EBF3FE] text-[#3683F8] border border-blue-200' :
                    'hover:bg-[#EBF3FE]/40 text-[#060606]'
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {apptCount > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${isSelected ? 'bg-white' : 'bg-[#3683F8]'}`}></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule & Appointment List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add form slider/card */}
          {showAddForm && (
            <div className="bg-white border border-[#D8D8D8] rounded-2xl p-5 shadow-xs space-y-4 animate-in slide-in-from-top duration-200">
              <h2 className="text-sm font-extrabold text-[#060606] flex items-center gap-1.5 border-b border-[#D8D8D8] pb-2">
                <Plus size={16} className="text-[#3683F8]" /> New Appointment Form
              </h2>
              <form onSubmit={handleCreateAppointment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Patient Full Name"
                  required
                  value={newAppt.name}
                  onChange={e => setNewAppt({ ...newAppt, name: e.target.value })}
                  placeholder="e.g. Rahul Verma"
                  className="border-[#D8D8D8] text-xs"
                />
                <Input
                  label="Phone Number"
                  required
                  value={newAppt.phone}
                  onChange={e => setNewAppt({ ...newAppt, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile"
                  className="border-[#D8D8D8] text-xs font-mono"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Age"
                    type="number"
                    required
                    value={newAppt.age}
                    onChange={e => setNewAppt({ ...newAppt, age: e.target.value })}
                    placeholder="Yrs"
                    className="border-[#D8D8D8] text-xs font-mono"
                  />
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time</label>
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-xl border border-[#D8D8D8] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                      value={newAppt.time}
                      onChange={e => setNewAppt({ ...newAppt, time: e.target.value })}
                      placeholder="10:00 AM"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Physician</label>
                  <select
                    className="flex h-10 w-full rounded-xl border border-[#D8D8D8] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] font-bold text-[#060606]"
                    value={newAppt.doctorId}
                    onChange={e => setNewAppt({ ...newAppt, doctorId: e.target.value })}
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
                    ))}
                  </select>
                </div>

                {/* Patient Vitals & History Action Button */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Clinical Vitals &amp; History</label>
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

                  {/* Visual mini-pill grid showing recorded vitals */}
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
                  <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)} className="text-xs">Cancel</Button>
                  <Button type="submit" className="bg-[#3683F8] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs">Schedule Slot</Button>
                </div>
              </form>
            </div>
          )}

          {/* List Card */}
          <div className="bg-white rounded-2xl p-5 border border-[#D8D8D8] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#D8D8D8] pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#060606] tracking-tight">
                  Bookings for {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Auto-filtering schedule listings</p>
              </div>
              <div className="space-y-1">
                <select
                  className="flex h-9 w-full rounded-xl border border-[#D8D8D8] bg-[#EBF3FE]/30 px-3 py-1.5 text-xs font-semibold text-[#060606] focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                  value={selectedDoctor}
                  onChange={e => setSelectedDoctor(e.target.value)}
                >
                  <option value="All">All Doctors</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="divide-y divide-[#D8D8D8]/60 overflow-hidden">
              {filteredAppointments.map(appt => (
                <div key={appt.id} className="py-3.5 flex items-center justify-between hover:bg-[#EBF3FE]/20 px-2 rounded-xl transition-all duration-150">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-[#060606]">{appt.patientName}</span>
                      <span className="text-[9px] font-bold text-slate-400">({appt.age} Yrs)</span>
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
                  <div className="flex items-center gap-2">
                    {appt.status.includes('Checked-In') ? (
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Check size={12} /> {appt.status}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApptCheckIn(appt, true)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all"
                          title="Check-in with upfront fee collection into Doctor Queue (FIFO)"
                        >
                          <UserPlus size={11} /> Check-In (Paid)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApptCheckIn(appt, false)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all"
                          title="Check-in into Fee Pending List"
                        >
                          <CreditCard size={11} /> Unpaid
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredAppointments.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  No appointments scheduled for this physician on this day.
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
