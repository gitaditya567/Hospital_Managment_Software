import { useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { VitalsModal } from '../../components/VitalsModal';
import { Calendar as CalendarIcon, Clock, Users, Plus, ChevronLeft, ChevronRight, Check, Activity } from 'lucide-react';

export function ReceptionistAppointments() {
  const { staff } = useHospitalStore();
  const doctors = staff.filter(s => s.role === 'Doctor' && s.status === 'Active');

  const [selectedDoctor, setSelectedDoctor] = useState('All');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toDateString());

  // Mock appointments for future days
  const [appointments, setAppointments] = useState([
    { id: '1', patientName: 'Arjun Mehta', phone: '9845019231', age: 34, doctorId: 'EMP-001', doctorName: 'Dr. Sarah Smith', date: new Date().toDateString(), time: '10:30 AM', status: 'Confirmed', type: 'Scheduled' },
    { id: '2', patientName: 'Sita Verma', phone: '9120349812', age: 28, doctorId: 'EMP-002', doctorName: 'Dr. John Davis', date: new Date().toDateString(), time: '11:15 AM', status: 'Confirmed', type: 'Scheduled' },
    { id: '3', patientName: 'Rajesh Malhotra', phone: '9922003311', age: 49, doctorId: 'EMP-001', doctorName: 'Dr. Sarah Smith', date: new Date().toDateString(), time: '12:00 PM', status: 'Confirmed', type: 'Walk-In' },
    { id: '4', patientName: 'Neelam Gupta', phone: '9871234567', age: 52, doctorId: 'EMP-002', doctorName: 'Dr. John Davis', date: new Date(Date.now() + 86400000).toDateString(), time: '10:00 AM', status: 'Confirmed', type: 'Scheduled' },
    { id: '5', patientName: 'Vijay Kulkarni', phone: '9001239841', age: 60, doctorId: 'EMP-001', doctorName: 'Dr. Sarah Smith', date: new Date(Date.now() + 86400000).toDateString(), time: '11:30 AM', status: 'Confirmed', type: 'Scheduled' },
  ]);

  const [newAppt, setNewAppt] = useState({ name: '', phone: '', age: '', doctorId: '', time: '10:00 AM' });
  const [showAddForm, setShowAddForm] = useState(false);

  // Patient vitals and diagnoses states for scheduler
  const [vitals, setVitals] = useState<Array<{ name: string; value: string }>>([]);
  const [pastDiagnoses, setPastDiagnoses] = useState('');
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const doc = doctors.find(d => d.id === newAppt.doctorId);
    if (!doc) return;

    const appt = {
      id: `appt-${Date.now()}`,
      patientName: newAppt.name,
      phone: newAppt.phone,
      age: parseInt(newAppt.age) || 30,
      doctorId: newAppt.doctorId,
      doctorName: doc.name,
      date: selectedDate,
      time: newAppt.time,
      status: 'Confirmed',
      type: 'Scheduled',
      vitals,
      pastDiagnoses
    };

    setAppointments([...appointments, appt]);
    setNewAppt({ name: '', phone: '', age: '', doctorId: '', time: '10:00 AM' });
    setVitals([]);
    setPastDiagnoses('');
    setShowAddForm(false);
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

  const filteredAppointments = appointments.filter(appt => {
    const matchesDoctor = selectedDoctor === 'All' || appt.doctorId === selectedDoctor;
    const matchesDate = appt.date === selectedDate;
    return matchesDoctor && matchesDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="text-blue-600" /> Appointment Scheduler
          </h1>
          <p className="text-slate-500">Manage bookings, schedule calendar timelines, and assign clinical queues</p>
        </div>
        <Button onClick={() => {
          if (doctors.length > 0) {
            setNewAppt(prev => ({ ...prev, doctorId: doctors[0].id }));
          }
          setShowAddForm(!showAddForm);
        }} className="flex items-center gap-1.5 font-bold shadow-md hover:shadow-lg transition-all rounded-xl">
          <Plus size={16} /> Book Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">Select Date</h2>
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-700 px-2 flex items-center">
                {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <button 
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
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
                    isSelected ? 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-500/20' : 
                    isToday ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                    'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {apptCount > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${isSelected ? 'bg-white' : 'bg-blue-500'}`}></span>
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
            <div className="bg-slate-50 border border-blue-100 rounded-2xl p-5 shadow-inner space-y-4 animate-in slide-in-from-top duration-200">
              <h2 className="text-sm font-extrabold text-blue-900 flex items-center gap-1.5">
                <Plus size={16} /> New Appointment Form
              </h2>
              <form onSubmit={handleCreateAppointment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Patient Full Name" 
                  required 
                  value={newAppt.name}
                  onChange={e => setNewAppt({...newAppt, name: e.target.value})}
                  placeholder="e.g. Rahul Verma"
                />
                <Input 
                  label="Phone Number" 
                  required 
                  value={newAppt.phone}
                  onChange={e => setNewAppt({...newAppt, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    label="Age" 
                    type="number" 
                    required 
                    value={newAppt.age}
                    onChange={e => setNewAppt({...newAppt, age: e.target.value})}
                    placeholder="Yrs"
                  />
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time</label>
                    <input 
                      type="text" 
                      className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      value={newAppt.time}
                      onChange={e => setNewAppt({...newAppt, time: e.target.value})}
                      placeholder="10:00 AM"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Physician</label>
                  <select 
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium"
                    value={newAppt.doctorId}
                    onChange={e => setNewAppt({...newAppt, doctorId: e.target.value})}
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
                    ))}
                  </select>
                </div>
                
                {/* Patient Vitals & History Action Button */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Clinical Vitals & History</label>
                  <button
                    type="button"
                    onClick={() => setIsVitalsModalOpen(true)}
                    className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all duration-200 ${
                      vitals.length > 0
                        ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700'
                        : 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/60 text-blue-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Activity size={14} className={vitals.length > 0 ? "animate-pulse text-emerald-600" : "text-blue-600"} />
                      {vitals.length > 0 ? 'Vitals & History Saved' : 'Add Vitals & Medical History'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                      vitals.length > 0 ? 'bg-emerald-100/60 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {vitals.length > 0 ? `${vitals.length} Recorded` : 'Pending'}
                    </span>
                  </button>
                  
                  {/* Visual mini-pill grid showing recorded vitals */}
                  {vitals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 p-2 bg-emerald-50/30 border border-emerald-100/40 rounded-lg animate-in fade-in duration-200 max-h-16 overflow-y-auto">
                      {vitals.map(v => (
                        <span key={v.name} className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-emerald-100 text-emerald-700 rounded-md">
                          {v.name.replace('Pressure', 'BP').replace('Temperature', 'Temp')}: {v.value}
                        </span>
                      ))}
                      {pastDiagnoses && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 text-slate-500 rounded-md truncate max-w-[200px]" title={pastDiagnoses}>
                          Dx: {pastDiagnoses}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 pt-2 border-t border-slate-200/60 flex justify-end gap-2.5">
                  <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
                  <Button type="submit">Schedule Slot</Button>
                </div>
              </form>
            </div>
          )}

          {/* List Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">
                  Bookings for {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Auto-filtering schedule listings</p>
              </div>
              <div className="space-y-1">
                <select 
                  className="flex h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedDoctor}
                  onChange={e => setSelectedDoctor(e.target.value)}
                >
                  <option value="All">All Doctors</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-100 overflow-hidden">
              {filteredAppointments.map(appt => (
                <div key={appt.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/40 px-2 rounded-xl transition-all duration-150">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-800">{appt.patientName}</span>
                      <span className="text-[9px] font-bold text-slate-400">({appt.age} Yrs)</span>
                      <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-md font-bold ${
                        appt.type === 'Walk-In' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {appt.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-semibold">
                      <span className="flex items-center gap-1"><Clock size={12} className="text-slate-400" /> {appt.time}</span>
                      <span className="flex items-center gap-1"><Users size={12} className="text-slate-400" /> {appt.doctorName}</span>
                      <span className="text-slate-400 font-mono">{appt.phone}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                      <Check size={10} /> {appt.status}
                    </span>
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
