import React, { useState, useEffect, useRef } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { PatientRecord } from '../../store/useHospitalStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { VitalsModal } from '../../components/VitalsModal';
import { 
  UserPlus, Clock, Printer, CreditCard, Check, 
  Wifi, CheckCircle2, Keyboard, Trash2, Activity
} from 'lucide-react';
import { getPrintSettings, PRINT_SETTINGS_EVENT } from '../../utils/printSettings';
import type { PrintSettings } from '../../utils/printSettings';
import { printIsolatedHtml } from '../../utils/printHelper';

export function ReceptionistDashboard() {
  const { 
    patients, 
    staff, 
    fees, 
    invoices, 
    registerPatient, 
    updatePatientStatus, 
    addPatientInvoice, 
    collectPatientFee,
    cancelPatient,
    hospitalName
  } = useHospitalStore();

  const { searchQuery } = useSuperAdminStore();

  // Active doctors scheduled for today
  const activeDoctors = staff.filter(s => s.role === 'Doctor' && s.status === 'Active');

  // Form State
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [doctorId, setDoctorId] = useState('');
  const [charges, setCharges] = useState('500');
  const [payNow, setPayNow] = useState(true);

  // Patient vitals and diagnoses states
  const [vitals, setVitals] = useState<Array<{ name: string; value: string }>>([]);
  const [pastDiagnoses, setPastDiagnoses] = useState('');
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);

  // System States
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'billing'>('details');
  const [existingPatientFound, setExistingPatientFound] = useState<boolean>(false);
  const [printInvoiceData, setPrintInvoiceData] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // simulated websocket events log
  const [wsLogs, setWsLogs] = useState<string[]>(['WebSocket initialized. Session connected. 🟢']);
  const [isWsActive, setIsWsActive] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const [printSettings, setPrintSettings] = useState<PrintSettings>(getPrintSettings());

  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail) {
        setPrintSettings(e.detail);
      }
    };
    window.addEventListener(PRINT_SETTINGS_EVENT, handleSettingsChange);
    return () => {
      window.removeEventListener(PRINT_SETTINGS_EVENT, handleSettingsChange);
    };
  }, []);

  // Focus ref for quick entry
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill existing patients when phone matches
  useEffect(() => {
    if (phone.length === 10) {
      // Check in existing patients
      const match = patients.find(p => p.phone === phone);
      if (match) {
        setName(match.name);
        setAge(match.age.toString());
        setGender(match.gender || 'Male');
        setExistingPatientFound(true);
        setWsLogs(prev => [`System: Autofilled returning patient "${match.name}" from phone records.`, ...prev]);
      } else {
        setExistingPatientFound(false);
      }
    } else {
      setExistingPatientFound(false);
    }
  }, [phone, patients]);

  // Set default doctor on load
  useEffect(() => {
    if (activeDoctors.length > 0 && !doctorId) {
      setDoctorId(activeDoctors[0].id);
    }
  }, [activeDoctors, doctorId]);

  // Set default charges on load/fee changes
  useEffect(() => {
    if (fees?.opdFee) {
      setCharges(fees.opdFee.toString());
    }
  }, [fees]);

  // Keyboard shortcut listener (F9 to Register & Print Slip)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        // Trigger register form submission
        const submitBtn = document.getElementById('register-submit-btn');
        if (submitBtn) {
          submitBtn.click();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Simulated WebSockets (Socket.io Mock)
  // When a doctor completes a session in another room, status updates automatically
  useEffect(() => {
    if (!isWsActive) return;

    const interval = setInterval(() => {
      // Find a waiting patient and move them to consulting, or consulting to completed
      const waiting = patients.filter(p => p.status === 'Waiting');
      const consulting = patients.filter(p => p.status === 'In Consultation');

      if (consulting.length > 0 && Math.random() > 0.6) {
        // Complete consultation
        const target = consulting[Math.floor(Math.random() * consulting.length)];
        updatePatientStatus(target.id, 'Completed');
        setWsLogs(prev => [
          `WebSocket [Dr. Shanti]: Marked patient "${target.name}" as Completed. Sent prescription to pharmacy.`,
          ...prev
        ]);
      } else if (waiting.length > 0 && Math.random() > 0.5) {
        // Start consultation
        const target = waiting[Math.floor(Math.random() * waiting.length)];
        updatePatientStatus(target.id, 'In Consultation');
        setWsLogs(prev => [
          `WebSocket [OPD Room 104]: Patient "${target.name}" called in by doctor. Status: In Consultation.`,
          ...prev
        ]);
      }
    }, 18000); // Trigger every 18 seconds for active demo look

    return () => clearInterval(interval);
  }, [isWsActive, patients, updatePatientStatus]);

  // Handle new patient registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !age || !doctorId) return;

    const selectedDoc = activeDoctors.find(d => d.id === doctorId);
    const doctorName = selectedDoc ? selectedDoc.name : 'General Physician';

    // 1. Optimistic UI Updates - instantly trigger registered states before server callbacks
    setWsLogs(prev => [`Optimistic UI: Registering patient "${name}"...`, ...prev]);

    const patientData = {
      name,
      phone,
      age: parseInt(age) || 30,
      gender,
      doctorName,
      vitals,
      pastDiagnoses
    };

    // Store Registration
    const newPatient = await registerPatient(patientData);

    // 2. Billing Logging: Custom charges and status based on payNow
    const invoiceAmount = parseInt(charges) || 500;
    const paymentStatus = payNow ? 'Paid' : 'Pending';

    addPatientInvoice({
      patientName: name,
      patientPhone: phone,
      amount: invoiceAmount,
      status: paymentStatus,
      doctorName,
      feeType: 'OPD Consultation Fee'
    });

    setWsLogs(prev => [
      `System: Token "${newPatient.tokenNumber}" issued. Invoice generated (₹${invoiceAmount}) [${paymentStatus}].`,
      ...prev
    ]);

    // Print Receipt preview popup instantly
    const receiptData = {
      patientId: newPatient.id,
      patientNo: newPatient.patientNo,
      patientName: name,
      phone,
      age,
      gender,
      doctorName,
      tokenNumber: newPatient.tokenNumber,
      amount: invoiceAmount,
      feeType: 'OPD Consultation Fee',
      status: paymentStatus,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    setPrintInvoiceData(receiptData);
    setIsPrintModalOpen(true);

    // Reset Form
    setName('');
    setPhone('');
    setAge('');
    setGender('Male');
    setExistingPatientFound(false);
    setVitals([]);
    setPastDiagnoses('');
    phoneInputRef.current?.focus();
  };

  // Find invoice linked to selected patient
  const linkedInvoice = selectedPatient 
    ? invoices.find(inv => inv.patientPhone === selectedPatient.phone && inv.status === 'Pending')
    : null;

  // Filter patients based on Topbar universal search query or standard list
  const filteredPatients = patients.filter(p => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      p.phone.includes(query) ||
      p.tokenNumber.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query)
    );
  });

  // Dynamic counts for receptionist dashboard interactive visualizer
  const waitingCount = patients.filter(p => p.status === 'Waiting').length;
  const consultingCount = patients.filter(p => p.status === 'In Consultation').length;
  const completedCount = patients.filter(p => p.status === 'Completed').length;
  const totalCount = patients.length;
  const maxVal = Math.max(waitingCount, consultingCount, completedCount, 2);

  // Status Tap-to-Cycle click handler
  const handleStatusCycle = (e: React.MouseEvent, p: PatientRecord) => {
    e.stopPropagation();
    const nextStatusMap: Record<PatientRecord['status'], PatientRecord['status']> = {
      'Waiting': 'In Consultation',
      'In Consultation': 'Completed',
      'Completed': 'Waiting'
    };
    const nextStatus = nextStatusMap[p.status];
    updatePatientStatus(p.id, nextStatus);
    setWsLogs(prev => [`System: Direct cycle trigger on "${p.name}". Status changed to "${nextStatus}".`, ...prev]);
  };

  // Duplicate Print click handler
  const handleQuickPrint = (e: React.MouseEvent, p: PatientRecord) => {
    e.stopPropagation();
    const invoice = invoices.find(inv => inv.patientPhone === p.phone);
    const invoiceAmount = invoice ? invoice.amount : (parseInt(charges) || 500);
    const invoiceType = invoice ? invoice.feeType : 'OPD Consultation Fee';
    setPrintInvoiceData({
      patientId: p.id,
      patientNo: p.patientNo,
      patientName: p.name,
      phone: p.phone,
      age: p.age,
      gender: p.gender || 'Male',
      doctorName: p.doctorName,
      tokenNumber: p.tokenNumber,
      amount: invoiceAmount,
      feeType: invoiceType,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    });
    setIsPrintModalOpen(true);
  };

  // Quick POS Invoice Collect Payment click handler
  const handleQuickPay = (e: React.MouseEvent, p: PatientRecord) => {
    e.stopPropagation();
    const linkedInvoice = invoices.find(inv => inv.patientPhone === p.phone && inv.status === 'Pending');
    if (linkedInvoice) {
      collectPatientFee(linkedInvoice.id);
      setWsLogs(prev => [`Quick POS: Cleared outstanding ₹${linkedInvoice.amount} fee for "${p.name}".`, ...prev]);
    }
  };

  // Cancel Appointment check-in click handler
  const handleQuickCancel = (e: React.MouseEvent, p: PatientRecord) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to cancel and remove the check-in logs for "${p.name}"?`)) {
      cancelPatient(p.id);
      setWsLogs(prev => [`System: Cancelled front desk check-in for "${p.name}".`, ...prev]);
      if (selectedPatient?.id === p.id) {
        setSelectedPatient(null);
      }
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-200">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-6 min-h-0">
        
        {/* Left Side: The Waiting Room (70% width -> span 7) */}
        <div className="lg:col-span-7 bg-white text-slate-800 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight">Today's Live Queue</h2>
              <p className="text-xs text-slate-500 font-medium">Real-time walk-in registration queue tracker</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Integrated sync status toggler */}
              <button
                type="button"
                onClick={() => setIsWsActive(!isWsActive)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold tracking-tight transition-all duration-200 hover:scale-105 active:scale-95 ${
                  isWsActive
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}
                title={isWsActive ? "Click to pause automated test simulations" : "Click to resume automated test simulations"}
              >
                <Wifi size={12} className={isWsActive ? "animate-pulse" : ""} />
                <span>{isWsActive ? "LIVE SYNC: ON" : "LIVE SYNC: OFF"}</span>
              </button>

              {searchQuery && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 animate-pulse">
                  Filtered: {filteredPatients.length} Matches
                </span>
              )}
            </div>
          </div>

          {/* Interactive Appointment Dashboard Chart (Identical to Screenshot) */}
          <div className="m-5 bg-slate-50/50 text-slate-700 p-5 rounded-2xl border border-slate-200/85 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight font-sans">Receptionist Appointment Dashboard</h3>
                <p className="text-[10px] text-slate-500 font-semibold font-sans mt-0.5">Interactive queue metrics bar visualizer</p>
              </div>
              
              {/* Legend with Color Blocks */}
              <div className="flex gap-4 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 bg-[#3b82f6] inline-block rounded-sm"></span>
                  Waiting
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 bg-[#10b981] inline-block rounded-sm"></span>
                  In Consultation
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 bg-[#f59e0b] inline-block rounded-sm"></span>
                  Completed
                </span>
              </div>
            </div>

            {/* Custom Bar Chart with Y-Axis and Gridlines */}
            <div className="grid grid-cols-[55px_1fr] gap-2 pt-2">
              
              {/* Y-Axis Column */}
              <div className="flex flex-col justify-between text-[10px] font-bold text-slate-500 text-right pr-2 select-none h-36 pb-6 pt-2">
                <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase self-end mb-1">Patients ↑</span>
                <span>{Math.round(maxVal)}</span>
                <span>{Math.round(maxVal * 0.75)}</span>
                <span>{Math.round(maxVal * 0.50)}</span>
                <span>{Math.round(maxVal * 0.25)}</span>
                <span>0</span>
              </div>

              {/* Chart Plot Area & Bars */}
              <div className="h-36 relative flex flex-col justify-between">
                
                {/* Horizontal Gridlines */}
                <div className="absolute inset-x-0 bottom-6 top-2 flex flex-col justify-between pointer-events-none opacity-20">
                  <div className="border-t border-slate-300 w-full"></div>
                  <div className="border-t border-slate-300 w-full"></div>
                  <div className="border-t border-slate-300 w-full"></div>
                  <div className="border-t border-slate-300 w-full"></div>
                  <div className="border-t border-slate-300 w-full"></div>
                </div>

                {/* Vertical Bars container */}
                <div className="flex justify-around items-end h-[calc(100%-24px)] px-6 relative z-10">
                  
                  {/* Waiting Bar */}
                  <div className="flex flex-col items-center gap-1.5 w-24 group select-none">
                    <span className="text-[11px] font-extrabold text-[#3b82f6] font-mono transition-transform group-hover:scale-110">
                      {waitingCount}
                    </span>
                    <div 
                      style={{ height: `${(waitingCount / maxVal) * 85}%` }}
                      className="w-12 bg-[#3b82f6] rounded-t shadow-[0_0_8px_rgba(59,130,246,0.15)] transition-all duration-500 ease-out hover:brightness-105 cursor-pointer min-h-[4px]"
                    ></div>
                  </div>

                  {/* In Consultation Bar */}
                  <div className="flex flex-col items-center gap-1.5 w-24 group select-none">
                    <span className="text-[11px] font-extrabold text-[#10b981] font-mono transition-transform group-hover:scale-110">
                      {consultingCount}
                    </span>
                    <div 
                      style={{ height: `${(consultingCount / maxVal) * 85}%` }}
                      className="w-12 bg-[#10b981] rounded-t shadow-[0_0_8px_rgba(16,185,129,0.15)] transition-all duration-500 ease-out hover:brightness-105 cursor-pointer min-h-[4px]"
                    ></div>
                  </div>

                  {/* Completed Bar */}
                  <div className="flex flex-col items-center gap-1.5 w-24 group select-none">
                    <span className="text-[11px] font-extrabold text-[#f59e0b] font-mono transition-transform group-hover:scale-110">
                      {completedCount}
                    </span>
                    <div 
                      style={{ height: `${(completedCount / maxVal) * 85}%` }}
                      className="w-12 bg-[#f59e0b] rounded-t shadow-[0_0_8px_rgba(245,158,11,0.15)] transition-all duration-500 ease-out hover:brightness-105 cursor-pointer min-h-[4px]"
                    ></div>
                  </div>

                </div>

                {/* X-Axis Labels */}
                <div className="h-6 border-t border-slate-200 flex justify-around items-center text-[10px] font-extrabold text-slate-500 uppercase tracking-wider select-none">
                  <span className="w-24 text-center">Waiting</span>
                  <span className="w-24 text-center">In Consultation</span>
                  <span className="w-24 text-center">Completed</span>
                </div>

              </div>
            </div>
          </div>

          {/* Today's Queue Data Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Token No</th>
                  <th className="px-5 py-3.5">Patient Name</th>
                  <th className="px-5 py-3.5">Age/Gender</th>
                  <th className="px-5 py-3.5">Assigned Doctor</th>
                  <th className="px-5 py-3.5">Status (Tap to Cycle)</th>
                  <th className="px-5 py-3.5 text-right">Wait Time</th>
                  <th className="px-5 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold">
                {filteredPatients.map((patient) => {
                  const isSelected = selectedPatient?.id === patient.id;
                  const isWaiting = patient.status === 'Waiting';
                  const isConsulting = patient.status === 'In Consultation';
                  const hasUnpaidInvoice = invoices.some(inv => inv.patientPhone === patient.phone && inv.status === 'Pending');
                  
                  return (
                    <tr 
                      key={patient.id} 
                      onClick={() => {
                        setSelectedPatient(patient);
                        setActiveTab('details');
                      }}
                      className={`cursor-pointer hover:bg-slate-50/80 transition-all duration-150 ${
                        isSelected ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold font-mono">
                          {patient.tokenNumber}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                          {patient.name}
                          {patient.patientNo && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[9px] font-bold font-mono">
                              {patient.patientNo}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">{patient.id}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {patient.age} Yrs / <span className="font-semibold text-slate-500">{patient.gender || 'Male'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-slate-800 font-extrabold">{patient.doctorName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span 
                          onClick={(e) => handleStatusCycle(e, patient)}
                          title="Click directly to cycle status"
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold border transition-all hover:scale-105 ${
                            isWaiting ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30 hover:bg-[#3b82f6]/20' :
                            isConsulting ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 hover:bg-[#10b981]/20' :
                            'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30 hover:bg-[#f59e0b]/20'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            isWaiting ? 'bg-[#3b82f6]' : isConsulting ? 'bg-[#10b981] animate-pulse' : 'bg-[#f59e0b]'
                          }`}></span>
                          {patient.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500 font-mono text-[10px]">
                        {patient.waitTime || '0m'} ago
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={(e) => handleQuickPrint(e, patient)}
                            title="Print Duplicate OPD Slip"
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded transition-colors"
                          >
                            <Printer size={14} />
                          </button>
                          {hasUnpaidInvoice && (
                            <button
                              onClick={(e) => handleQuickPay(e, patient)}
                              title="Quick collect payment"
                              className="p-1 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded transition-colors"
                            >
                              <CreditCard size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleQuickCancel(e, patient)}
                            title="Cancel patient check-in"
                            className="p-1 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400 font-bold">
                      No active walk-in logs matching search queries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Unified Screenshot-Compliant Statistics Footer */}
          <div className="flex justify-between items-center text-xs font-bold px-6 py-4 bg-slate-50 border-t border-slate-200 text-slate-600 select-none">
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] mr-2">Total Today</span>
              <span className="text-slate-800 font-extrabold font-mono bg-white px-2 py-1 rounded border border-slate-200">{totalCount}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] mr-2">Currently Waiting</span>
              <span className="text-[#3b82f6] font-extrabold font-mono bg-[#3b82f6]/10 px-2 py-1 rounded border border-[#3b82f6]/20">{waitingCount}</span>
            </div>
          </div>

          {/* WebSocket stream logger inside the panel */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold truncate max-w-[280px] sm:max-w-md">
                Latest Event: {wsLogs[0] || 'System listening for EMR triggers'}
              </span>
            </div>
            
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700 tracking-wider transition-colors"
            >
              {showLogs ? "Hide Console Logs" : `Show Logs (${wsLogs.length})`}
            </button>
          </div>

          {showLogs && (
            <div className="bg-slate-900 text-slate-400 p-3.5 border-t border-slate-800 max-h-28 overflow-y-auto font-mono text-[9px] space-y-1 animate-in slide-in-from-bottom duration-150">
              {wsLogs.slice(0, 10).map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span className="truncate">{log}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: The Lightning-Fast Registration & Actions Panel (30% width -> span 3) */}
        <div className="lg:col-span-3 flex flex-col gap-5 min-h-0">
          
          {/* Quick Registration Form */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col relative">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
                <UserPlus size={16} className="text-blue-600" /> Walk-In Check-In
              </h2>
              <div className="flex items-center gap-1 text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-mono">
                <Keyboard size={10} /> F9 Ready
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <Input 
                  ref={phoneInputRef}
                  label="Step 1: Phone Number" 
                  placeholder="10-digit mobile" 
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  className="font-mono text-xs"
                />
                {existingPatientFound && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 size={12} /> Auto-filled returning patient!
                  </p>
                )}
              </div>

              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-3">
                  <Input 
                    label="Patient Name" 
                    placeholder="Full name" 
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    readOnly={existingPatientFound}
                    className="text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Input 
                    label="Age" 
                    type="number"
                    placeholder="Yrs" 
                    required
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    readOnly={existingPatientFound}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gender</label>
                <select 
                  className="flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  disabled={existingPatientFound}
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Step 2: Assign Doctor</label>
                <select 
                  className="flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  value={doctorId}
                  onChange={e => setDoctorId(e.target.value)}
                  required
                >
                  {activeDoctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
                  ))}
                  {activeDoctors.length === 0 && <option value="">No doctors active on shift</option>}
                </select>
              </div>

              {/* Patient Vitals & History Action Button */}
              <div className="space-y-1">
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
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 text-slate-500 rounded-md truncate max-w-[150px]" title={pastDiagnoses}>
                        Dx: {pastDiagnoses}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Charges (₹)</label>
                <input
                  type="number"
                  placeholder="Enter charge amount"
                  required
                  value={charges}
                  onChange={e => setCharges(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5">
                <div className="flex flex-col">
                  <span className="text-[11px] font-extrabold text-slate-700">Pay Now</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Immediate collection clearance</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={payNow}
                  onChange={e => setPayNow(e.target.checked)}
                  className="h-4.5 w-4.5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer transition-all"
                />
              </div>

              <Button 
                id="register-submit-btn"
                type="submit" 
                className="w-full text-xs h-10 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all mt-2"
              >
                <Printer size={16} /> Register & Print Slip (F9)
              </Button>
            </form>
          </div>

          {/* Quick Actions for Selected Patient */}
          <div className="flex-1 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col min-h-0 overflow-y-auto">
            {selectedPatient ? (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                <div className="pb-3.5 border-b border-slate-100">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9px] font-bold font-mono uppercase">
                    Selected Patient Log
                  </span>
                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight mt-1">{selectedPatient.name}</h3>
                  <p className="text-[10px] text-slate-500 font-semibold font-mono mt-0.5">{selectedPatient.id} • {selectedPatient.phone}</p>
                </div>

                <div className="flex border-b border-slate-100 text-xs font-bold text-slate-400">
                  <button 
                    onClick={() => setActiveTab('details')}
                    className={`flex-1 pb-2 border-b-2 text-center transition-colors ${
                      activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-600'
                    }`}
                  >
                    Details
                  </button>
                  <button 
                    onClick={() => setActiveTab('billing')}
                    className={`flex-1 pb-2 border-b-2 text-center transition-colors ${
                      activeTab === 'billing' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-600'
                    }`}
                  >
                    Fee Receipt
                  </button>
                </div>

                {activeTab === 'details' ? (
                  <div className="space-y-3.5 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-2 font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Token No</span>
                        <span className="text-slate-800 font-extrabold">{selectedPatient.tokenNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Assigned Doctor</span>
                        <span className="text-slate-800 font-extrabold">{selectedPatient.doctorName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Registry Date</span>
                        <span className="text-slate-800 font-semibold">Today (Live)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Wait Duration</span>
                        <span className="text-slate-800 font-bold">{selectedPatient.waitTime || '0m'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Patient Status</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['Waiting', 'In Consultation', 'Completed'] as const).map(s => {
                          const isCurrent = selectedPatient.status === s;
                          return (
                            <button
                              key={s}
                              onClick={() => {
                                // Optimistic UI update instantly before backend sync
                                setSelectedPatient(prev => prev ? { ...prev, status: s } : null);
                                updatePatientStatus(selectedPatient.id, s);
                                setWsLogs(prev => [`System: Manually changed "${selectedPatient.name}" status to "${s}".`, ...prev]);
                              }}
                              className={`py-1.5 px-1 rounded-lg font-bold text-[9px] border text-center transition-all ${
                                isCurrent 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {s.replace('In ', '')}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 text-xs">
                    {linkedInvoice ? (
                      <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl space-y-2">
                        <div className="flex justify-between font-bold text-rose-800 text-xs">
                          <span>{linkedInvoice.feeType}</span>
                          <span>Pending</span>
                        </div>
                        <p className="text-[10px] text-rose-600 font-medium">
                          Patient is registered but hasn't cleared the fee yet.
                        </p>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-t border-rose-200/60 pt-2 mt-1">
                          <span>Amount Due</span>
                          <span className="text-sm font-extrabold text-rose-700">₹{linkedInvoice.amount.toLocaleString('en-IN')}</span>
                        </div>
                        <Button 
                          onClick={() => {
                            collectPatientFee(linkedInvoice.id);
                            setWsLogs(prev => [`System: Payment collected for "${selectedPatient.name}" (₹${linkedInvoice.amount}). Invoice Paid.`, ...prev]);
                          }}
                          className="w-full mt-2 h-9 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center justify-center gap-1 transition-all"
                        >
                          <CreditCard size={14} /> Collect & Clearance
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl space-y-2 text-center">
                        <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200 mb-1">
                          <Check size={18} />
                        </div>
                        <h4 className="font-extrabold text-emerald-800 text-xs">Fee Cleared successfully</h4>
                        <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                          All collections for this patient walk-in profile completed. Duplicates can be reprinted.
                        </p>
                      </div>
                    )}

                    <Button 
                      onClick={() => {
                        const receiptData = {
                          patientId: selectedPatient.id,
                          patientNo: selectedPatient.patientNo,
                          patientName: selectedPatient.name,
                          phone: selectedPatient.phone,
                          age: selectedPatient.age,
                          gender: selectedPatient.gender || 'Male',
                          doctorName: selectedPatient.doctorName,
                          tokenNumber: selectedPatient.tokenNumber,
                          amount: linkedInvoice ? linkedInvoice.amount : 500,
                          feeType: linkedInvoice ? linkedInvoice.feeType : 'OPD Consultation Fee',
                          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        };
                        setPrintInvoiceData(receiptData);
                        setIsPrintModalOpen(true);
                      }}
                      variant="outline" 
                      className="w-full text-xs h-9 font-bold flex items-center justify-center gap-1 rounded-lg"
                    >
                      <Printer size={14} /> Print Duplicate OPD Slip
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <Clock size={40} className="mb-3.5 text-slate-200" />
                <p className="text-xs font-medium text-slate-400">Select patient in waiting queue list to print copy slips or manage checkout details.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3-Inch Thermal Print Preview Modal using CSS @media print template styles */}
      <Modal 
        isOpen={isPrintModalOpen} 
        onClose={() => setIsPrintModalOpen(false)} 
        title="Thermal Slip Print Preview"
        className="max-w-xs sm:max-w-sm"
      >
        {printInvoiceData && (
          <div className="space-y-5">
            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 flex justify-center">
              {/* Receipts Template Mock */}
              <div 
                id="thermal-slip-template" 
                className="bg-white border shadow-sm text-slate-900 transition-all duration-250 max-h-[380px] overflow-y-auto"
                style={{
                  width: printSettings.paperSize === 'A4' ? '260px' : '190px',
                  padding: `${printSettings.padding}px`,
                  margin: `${printSettings.margin}px`,
                  fontSize: `${printSettings.fontSize}px`,
                  fontFamily: printSettings.paperSize === 'A4' ? 'sans-serif' : 'monospace',
                  borderTop: `4px solid ${printSettings.accentColor}`
                }}
              >
                {printSettings.showHeader && (
                  <div className="text-center pb-2 border-b border-dashed border-slate-350 space-y-1">
                    <h3 className="font-extrabold text-xs uppercase tracking-wider" style={{ color: printSettings.accentColor }}>
                      🏥 {printSettings.customHeaderText || hospitalName}
                    </h3>
                    <p className="text-[8px] text-slate-500">Live Clinical Registry Slip</p>
                    <p className="text-[7px] text-slate-400">Date: {printInvoiceData.date}</p>
                  </div>
                )}

                <div className="text-center py-2 border rounded my-2 bg-slate-50/50 space-y-0.5" style={{ borderColor: `${printSettings.accentColor}30` }}>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">OPD Queue Token</p>
                  <h2 className="text-xl font-black leading-none" style={{ color: printSettings.accentColor }}>{printInvoiceData.tokenNumber}</h2>
                  <p className="text-[8px] font-extrabold text-slate-500">{printInvoiceData.doctorName}</p>
                </div>

                <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[0.9em]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Patient:</span>
                    <span className="font-bold">{printInvoiceData.patientName}</span>
                  </div>
                  {printInvoiceData.patientNo && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Patient No:</span>
                      <span className="font-bold text-blue-600">{printInvoiceData.patientNo}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">UID:</span>
                    <span className="font-bold">{printInvoiceData.patientId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Age/Gender:</span>
                    <span className="font-bold">{printInvoiceData.age} Yrs / {printInvoiceData.gender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-bold">{printInvoiceData.phone}</span>
                  </div>
                </div>

                <div className="space-y-1 pb-1 text-[0.9em]">
                  <div className="flex justify-between font-bold">
                    <span>{printInvoiceData.feeType}:</span>
                    <span>₹{printInvoiceData.amount}</span>
                  </div>
                  <div className="flex justify-between font-black border-t pt-1.5 mt-1" style={{ borderTopColor: printSettings.accentColor }}>
                    <span>Paid Amount:</span>
                    <span style={{ color: printSettings.accentColor }}>₹{printInvoiceData.amount}</span>
                  </div>
                </div>

                {printSettings.showFooter && (
                  <div className="text-center pt-3 border-t border-dashed border-slate-300 space-y-1.5">
                    <div className="h-5 w-full flex items-center justify-center text-[7px] text-white tracking-[6px] font-bold rounded" style={{ backgroundColor: printSettings.accentColor }}>
                      |||||||||||||||||||||||
                    </div>
                    <p className="text-[7.5px] text-slate-400 uppercase tracking-wider leading-normal">
                      {printSettings.customFooterText || `Please wait outside Room ${printInvoiceData.doctorName.includes('Sarah') ? '101' : '202'}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  const headerTitle = printSettings.showHeader 
                    ? `<div class="text-center pb-2 dashed-divider">
                         ${printSettings.logoUrl ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${printSettings.logoUrl}" style="max-height: 40px; max-width: 100%; object-fit: contain;" /></div>` : ''}
                         <h3 class="font-extrabold uppercase brand-accent-text" style="margin: 0; font-size: 1.15em;">🏥 ${printSettings.customHeaderText || hospitalName}</h3>
                         <p style="margin: 2px 0 0 0; font-size: 0.8em; color: #64748b;">Live Clinical Registry Slip</p>
                         <p style="margin: 2px 0 0 0; font-size: 0.7em; color: #94a3b8;">Date: ${printInvoiceData.date}</p>
                       </div>`
                    : '';

                  const footerContent = printSettings.showFooter
                    ? `<div class="text-center pt-3 dashed-divider">
                         <div class="barcode-container brand-accent-bg">|||||||||||||||||||||||</div>
                         <p style="margin: 4px 0 0 0; font-size: 0.78em; color: #64748b; text-transform: uppercase; leading-height: 1.3;">
                           ${printSettings.customFooterText || `Please wait outside Room ${printInvoiceData.doctorName.includes('Sarah') ? '101' : '202'}`}
                         </p>
                       </div>`
                    : '';

                  const slipHtml = `
                    <div style="font-family: monospace; font-size: ${printSettings.fontSize}px; line-height: 1.4;">
                      ${headerTitle}

                      <div class="text-center py-3 my-2" style="border: 1px solid ${printSettings.accentColor}30; border-radius: 8px; background-color: #f8fafc;">
                        <p style="margin: 0; font-size: 0.75em; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">OPD Queue Token</p>
                        <h2 class="brand-accent-text" style="margin: 4px 0; font-size: 2.2em; font-weight: 900; line-height: 1;">${printInvoiceData.tokenNumber}</h2>
                        <p style="margin: 0; font-size: 0.8em; font-weight: bold; color: #334155;">${printInvoiceData.doctorName}</p>
                      </div>

                      <div class="dashed-divider"></div>

                      <div style="font-size: 0.9em; space-y: 4px;">
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span style="color: #64748b;">Patient:</span>
                          <span class="font-bold">${printInvoiceData.patientName}</span>
                        </div>
                        ${printInvoiceData.patientNo ? `
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span style="color: #64748b;">Patient No:</span>
                          <span class="font-bold brand-accent-text">${printInvoiceData.patientNo}</span>
                        </div>` : ''}
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span style="color: #64748b;">UID:</span>
                          <span class="font-bold">${printInvoiceData.patientId}</span>
                        </div>
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span style="color: #64748b;">Age/Gender:</span>
                          <span class="font-bold">${printInvoiceData.age} Yrs / ${printInvoiceData.gender}</span>
                        </div>
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span style="color: #64748b;">Contact:</span>
                          <span class="font-bold">${printInvoiceData.phone}</span>
                        </div>
                      </div>

                      <div class="dashed-divider"></div>

                      <div style="font-size: 0.9em;">
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span>${printInvoiceData.feeType}:</span>
                          <span class="font-bold">₹${printInvoiceData.amount}</span>
                        </div>
                        <div class="flex justify-between font-black solid-divider pt-2" style="font-size: 1.1em;">
                          <span>Paid Amount:</span>
                          <span class="brand-accent-text">₹${printInvoiceData.amount}</span>
                        </div>
                      </div>

                      ${footerContent}
                    </div>
                  `;

                  printIsolatedHtml("OPD Queue Slip", slipHtml);
                  setIsPrintModalOpen(false);
                }} 
                className="flex-1 font-bold rounded-xl"
              >
                <Printer size={16} className="mr-1.5" /> Execute Print
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsPrintModalOpen(false)}
                className="flex-1 font-bold rounded-xl"
              >
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
