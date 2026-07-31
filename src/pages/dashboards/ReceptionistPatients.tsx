import { useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { PatientRecord } from '../../store/useHospitalStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { VitalsModal } from '../../components/VitalsModal';
import {
  Users, Search, FileText, UserPlus, Calendar, Shield, CheckCircle2,
  TrendingUp, Award, UserCheck, Activity, Printer
} from 'lucide-react';
import { DataNavigationToolbar, INITIAL_FILTER_STATE, applyDataFilters } from '../../components/common/DataNavigationToolbar';
import type { FilterState } from '../../components/common/DataNavigationToolbar';
import { getHospitalDisplayName } from '../../utils/printSettings';

export function ReceptionistPatients() {
  const { patients, staff, registerPatient, invoices, addPatientInvoice } = useHospitalStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEXT_APPOINTMENT' | 'FIRST_APPOINTMENT'>('ALL');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);

  // Quick check-in states
  const [checkInDoctorId, setCheckInDoctorId] = useState('');
  const [checkInFeeType, setCheckInFeeType] = useState('OPD Consultation Fee');
  const [payNow, setPayNow] = useState(true);
  const [checkInSuccessData, setCheckInSuccessData] = useState<any>(null);

  // Vitals & diagnoses state for Quick Check-In
  const [vitals, setVitals] = useState<Array<{ name: string; value: string }>>([]);
  const [pastDiagnoses, setPastDiagnoses] = useState('');
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);

  // Fetch active doctors
  const activeDoctors = staff.filter(s => s.role === 'Doctor' && s.status === 'Active');

  // Aggregate unique patients by phone number to create a true master patient directory
  const uniquePatientsMap = new Map<string, PatientRecord & { visitsCount: number; allVisits: PatientRecord[] }>();

  (patients || []).forEach(p => {
    if (!p) return;
    const key = (p.phone && p.phone.trim())
      ? `phone:${p.phone.trim()}`
      : (p.patientNo && p.patientNo.trim())
        ? `no:${p.patientNo.trim()}`
        : `id:${p.id || p.name ? p.name.trim().toLowerCase() : Math.random().toString()}`;

    const existing = uniquePatientsMap.get(key);
    if (existing) {
      existing.visitsCount += 1;
      existing.allVisits.push(p);
    } else {
      uniquePatientsMap.set(key, {
        ...p,
        visitsCount: 1,
        allVisits: [p]
      });
    }
  });

  const uniquePatients = Array.from(uniquePatientsMap.values());

  // Counts for tabs
  const countAll = uniquePatients.length;
  const countFirst = uniquePatients.filter(p => p.visitsCount === 1).length;
  const countNext = uniquePatients.filter(p => p.visitsCount > 1 || p.status === 'Waiting' || p.status === 'In Consultation' || p.appointmentTime).length;

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);

  // Filter unique patients based on toolbar filters (date, searchQuery), search & active tab
  const filteredPatients = applyDataFilters(uniquePatients, filters).filter(p => {
    // Tab filter logic
    if (activeTab === 'FIRST_APPOINTMENT' && p.visitsCount !== 1) {
      return false;
    }
    if (activeTab === 'NEXT_APPOINTMENT' && !(p.visitsCount > 1 || p.status === 'Waiting' || p.status === 'In Consultation' || p.appointmentTime)) {
      return false;
    }

    const query = search.trim().toLowerCase();
    if (!query) return true;

    const name = (p.name || '').toString().toLowerCase();
    const phone = (p.phone || '').toString().toLowerCase();
    const patientNo = (p.patientNo || '').toString().toLowerCase();
    const id = (p.id || '').toString().toLowerCase();

    return (
      name.includes(query) ||
      phone.includes(query) ||
      patientNo.includes(query) ||
      id.includes(query)
    );
  });

  const handlePrintPatientRecord = (patient: any) => {
    const hospitalTitle = getHospitalDisplayName();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const visitsHtml = (patient.allVisits || []).map((v: any, idx: number) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.timeRegistered || 'N/A'}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><b>${v.doctorName || 'General'}</b></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">Token #${v.tokenNumber || '-'}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${v.status || 'Registered'}</td>
      </tr>
    `).join('');

    const billingHtml = (patient.billing || []).map((b: any) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${b.date || 'N/A'}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${b.feeType || 'OPD Fee'}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">₹${b.amount}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><b>${b.status}</b></td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Patient Medical Record - ${patient.name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; }
            .header { border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .hospital-title { font-size: 24px; font-weight: 800; color: #1e293b; margin: 0; }
            .sub { color: #64748b; font-size: 13px; font-weight: 600; }
            .patient-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 15px; margin-bottom: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .field { font-size: 13px; }
            .field label { font-weight: 700; color: #475569; display: block; font-size: 11px; text-transform: uppercase; }
            .field span { font-weight: 800; color: #0f172a; font-size: 15px; }
            h3 { color: #2563eb; font-size: 15px; font-weight: 800; margin-top: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #334155; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; pt: 15px; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="hospital-title">${hospitalTitle}</h1>
              <div class="sub">Official Patient Master Medical & Clinical Log Record</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; font-weight: 800; color: #2563eb;">CONFIDENTIAL</div>
              <div style="font-size: 10px; color: #64748b;">Printed on: ${new Date().toLocaleString()}</div>
            </div>
          </div>

          <div class="patient-box">
            <div class="field"><label>Patient Name</label><span>${patient.name}</span></div>
            <div class="field"><label>Patient Unique No (UID)</label><span style="color:#2563eb;">${patient.patientNo || patient.id}</span></div>
            <div class="field"><label>Contact Phone</label><span>${patient.phone}</span></div>
            <div class="field"><label>Age / Gender</label><span>${patient.age} Yrs / ${patient.gender || 'Male'}</span></div>
            <div class="field"><label>Total Visits Recorded</label><span>${patient.visitsCount || 1} Visits</span></div>
            <div class="field"><label>Primary Assigned Physician</label><span>${patient.doctorName}</span></div>
          </div>

          <h3>Clinical Visit History</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Registration Date / Time</th>
                <th>Doctor</th>
                <th>Token</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${visitsHtml}
            </tbody>
          </table>

          ${patient.billing && patient.billing.length > 0 ? `
            <h3>Billing & Payment Records</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fee Particular</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${billingHtml}
              </tbody>
            </table>
          ` : ''}

          <div class="footer">
            Generated automatically by ${hospitalTitle} Medical Information System.
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Calculate stats
  const totalUnique = uniquePatients.length;
  const returningPatients = uniquePatients.filter(p => p.visitsCount > 1).length;
  const returningRate = totalUnique > 0 ? Math.round((returningPatients / totalUnique) * 100) : 0;
  const newPatientsToday = uniquePatients.filter(p => p.timeRegistered === 'Just now' || p.timeRegistered.includes('mins')).length;

  const handleOpenHistory = (patient: any) => {
    // Find billing records linked to this patient's phone
    const patientBilling = invoices.filter(inv => inv.patientPhone === patient.phone);
    setSelectedPatient({
      ...patient,
      billing: patientBilling
    });
    setIsHistoryModalOpen(true);
  };

  const handleOpenCheckIn = (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setCheckInSuccessData(null);
    setVitals([]);
    setPastDiagnoses('');
    if (activeDoctors.length > 0) {
      setCheckInDoctorId(activeDoctors[0].id);
    }
    setIsCheckInModalOpen(true);
  };

  const handleQuickCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !checkInDoctorId) return;

    const selectedDoc = activeDoctors.find(d => d.id === checkInDoctorId);
    const doctorName = selectedDoc ? selectedDoc.name : 'General Physician';

    // Register
    const newPatient = await registerPatient({
      name: selectedPatient.name,
      phone: selectedPatient.phone,
      age: selectedPatient.age,
      gender: selectedPatient.gender || 'Male',
      doctorName,
      vitals,
      pastDiagnoses,
      payNow
    });

    // Add Invoice
    const feeAmount = checkInFeeType === 'Emergency Consultation Fee' ? 1200 : 500;
    addPatientInvoice({
      patientName: selectedPatient.name,
      patientPhone: selectedPatient.phone,
      amount: feeAmount,
      status: payNow ? 'Paid' : 'Pending',
      doctorName,
      feeType: checkInFeeType
    });

    setCheckInSuccessData({
      tokenNumber: newPatient.tokenNumber,
      doctorName,
      amount: feeAmount,
      feeType: checkInFeeType
    });

    setVitals([]);
    setPastDiagnoses('');
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header and Action */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-blue-600" /> Patient Master List
          </h1>
          <p className="text-slate-500">Comprehensive index of all patient profiles, historical check-ins, and diagnostics</p>
        </div>
      </div>

      {/* Stats Summary Rows */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Patients */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Patients</p>
            <h3 className="text-xl font-extrabold text-slate-800 mt-1">{totalUnique} Profiles</h3>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Unique contacts stored</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Users size={20} />
          </div>
        </div>

        {/* New Patients Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Onboarded Today</p>
            <h3 className="text-xl font-extrabold text-indigo-700 mt-1">+{newPatientsToday} New</h3>
            <p className="text-[10px] text-indigo-600 font-semibold mt-1">First-time walk-ins</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <UserCheck size={20} />
          </div>
        </div>

        {/* Return Patient Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Return Visit Rate</p>
            <h3 className="text-xl font-extrabold text-emerald-700 mt-1">{returningRate}%</h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">Patients with &gt; 1 check-in</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Standard Medical Grade Badge */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Security Clearance</p>
            <h3 className="text-sm font-extrabold text-slate-800 mt-1.5 flex items-center gap-1">
              <Shield size={14} className="text-emerald-500" /> AES-256 Compliant
            </h3>
            <p className="text-[10px] text-slate-500 font-medium mt-1">HIPAA compliant records encryption</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200">
            <Award size={20} />
          </div>
        </div>
      </div>

      {/* Date & Interactive Toolbar Filter */}
      <DataNavigationToolbar
        filters={filters}
        onFilterChange={setFilters}
        totalRecordsCount={totalUnique}
        filteredCount={filteredPatients.length}
        title="Patient Master Database Filters"
        subtitle="Filter clinical patient records by Date Range, Visit Type, or Query Search"
      />

      {/* Main Database Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 flex flex-col flex-1 overflow-hidden">
        {/* Search & Subcategory Navigation Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50/50">
          {/* Subcategory Tabs */}
          <div className="flex items-center bg-slate-200/60 p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'ALL'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <Users size={14} />
              <span>All Patient</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'ALL' ? 'bg-blue-50 text-blue-700' : 'bg-slate-300 text-slate-700'}`}>
                {countAll}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('NEXT_APPOINTMENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'NEXT_APPOINTMENT'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <Calendar size={14} />
              <span>Next Appointment</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'NEXT_APPOINTMENT' ? 'bg-blue-50 text-blue-700' : 'bg-slate-300 text-slate-700'}`}>
                {countNext}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('FIRST_APPOINTMENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'FIRST_APPOINTMENT'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <UserPlus size={14} />
              <span>First Appointment</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'FIRST_APPOINTMENT' ? 'bg-blue-50 text-blue-700' : 'bg-slate-300 text-slate-700'}`}>
                {countFirst}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients by name, phone or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs font-semibold text-slate-700 bg-white"
            />
          </div>
        </div>

        {/* Database Grid */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3.5">Patient UID</th>
                <th className="px-5 py-3.5">Patient Name</th>
                <th className="px-5 py-3.5">Age/Gender</th>
                <th className="px-5 py-3.5">Phone Number</th>
                <th className="px-5 py-3.5">Visits Count</th>
                <th className="px-5 py-3.5">Last Doctor Assigned</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold font-sans">
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <span className="px-2.5 py-1 bg-blue-50 border border-blue-200/60 text-blue-700 rounded-lg font-extrabold font-mono">
                      {patient.patientNo || 'PAT-NEW'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-extrabold text-slate-800">{patient.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">Ref: {patient.id}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {patient.age} Yrs / <span className="font-medium text-slate-500">{patient.gender || 'Male'}</span>
                  </td>
                  <td className="px-5 py-4 font-bold font-mono text-slate-700">
                    {patient.phone}
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100/50 font-bold text-[10px] font-mono">
                      {patient.visitsCount} visits
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-800 font-bold">
                    {patient.doctorName}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintPatientRecord(patient)}
                        className="rounded-full text-[10px] h-8 font-bold text-slate-600 hover:text-blue-700 flex gap-1 items-center"
                        title="Print Complete Patient Record"
                      >
                        <Printer size={12} /> Print
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenHistory(patient)}
                        className="rounded-full text-[10px] h-8 font-bold text-slate-600 hover:text-slate-800 flex gap-1 items-center"
                      >
                        <FileText size={12} /> History
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenCheckIn(patient)}
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-full text-[10px] h-8 font-bold flex gap-1 items-center"
                      >
                        <UserPlus size={12} /> Check-In
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-bold">
                    {activeTab === 'FIRST_APPOINTMENT'
                      ? 'No first-time (single visit) patient profiles found.'
                      : activeTab === 'NEXT_APPOINTMENT'
                      ? 'No repeat or upcoming appointment patient records found.'
                      : 'No matching patient profiles in clinical records.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History and Timeline Drawer Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Patient Medical Profile & History"
        className="max-w-md sm:max-w-lg"
      >
        {selectedPatient && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">{selectedPatient.name}</h3>
                <p className="text-[10px] text-slate-500 font-bold font-mono">
                  Patient No: <span className="text-blue-600 font-extrabold">{selectedPatient.patientNo || 'N/A'}</span>
                </p>
                <p className="text-[10px] text-slate-500 font-bold font-mono">
                  UID: {selectedPatient.id} • Age/Gender: {selectedPatient.age} Yrs / {selectedPatient.gender || 'Male'}
                </p>
                <p className="text-[10px] text-slate-500 font-bold font-mono">Phone: {selectedPatient.phone}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                  Active File
                </span>
              </div>
            </div>

            {/* Visit Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Calendar size={14} className="text-blue-500" /> Historical Check-In Logs ({selectedPatient.allVisits.length})
              </h4>
              <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
                {selectedPatient.allVisits.map((visit: any, index: number) => (
                  <div key={index} className="relative">
                    {/* Bullet */}
                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white"></div>
                    <div className="space-y-0.5 text-xs font-medium">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-800">Assigned: {visit.doctorName}</span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">{visit.timeRegistered}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Token Issued: <span className="font-bold font-mono text-slate-700">{visit.tokenNumber}</span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                          visit.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          visit.status === 'In Consultation' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {visit.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Invoice Logs */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <FileText size={14} className="text-emerald-500" /> Linked OPD Payments
              </h4>
              {selectedPatient.billing && selectedPatient.billing.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                  {selectedPatient.billing.map((inv: any) => (
                    <div key={inv.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between font-medium">
                      <div>
                        <div className="font-bold text-slate-800">{inv.feeType}</div>
                        <div className="text-[10px] text-slate-500 font-bold font-mono mt-0.5">{inv.id} • {inv.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-slate-900">₹{inv.amount}</div>
                        <span className={`inline-flex px-1.5 py-0.2 rounded text-[8px] font-bold border ${
                          inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-xs font-semibold italic text-center py-4 bg-slate-50 rounded-xl border border-slate-200/50">
                  No billing history recorded for this patient.
                </p>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 gap-2">
              <Button
                variant="outline"
                onClick={() => handlePrintPatientRecord(selectedPatient)}
                className="font-bold rounded-full text-xs flex items-center gap-1.5 border-slate-300 text-slate-700 hover:text-blue-600"
              >
                <Printer size={14} /> Print Patient Record
              </Button>
              <Button
                onClick={() => setIsHistoryModalOpen(false)}
                className="font-bold rounded-full"
              >
                Close Profile
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Lightning Quick Re-Check-In Modal */}
      <Modal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        title="Lightning Quick Patient Check-In"
        className="max-w-xs sm:max-w-sm"
      >
        {selectedPatient && (
          <div className="space-y-4">
            {!checkInSuccessData ? (
              <form onSubmit={handleQuickCheckInSubmit} className="space-y-4 text-xs font-medium">
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                  <p className="text-[10px] text-blue-500 font-extrabold uppercase tracking-wider">Checking In Patient</p>
                  <h4 className="text-sm font-extrabold text-slate-800 mt-0.5">{selectedPatient.name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold font-mono mt-0.5">Phone: {selectedPatient.phone} • Age: {selectedPatient.age}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assign OPD Shift Doctor</label>
                  <select
                    className="flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    value={checkInDoctorId}
                    onChange={e => setCheckInDoctorId(e.target.value)}
                    required
                  >
                    {activeDoctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
                    ))}
                    {activeDoctors.length === 0 && <option value="">No doctors active on shift</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">OPD Billing Config</label>
                  <select
                    className="flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    value={checkInFeeType}
                    onChange={e => setCheckInFeeType(e.target.value)}
                  >
                    <option>OPD Consultation Fee</option>
                    <option>Emergency Consultation Fee</option>
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

                <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Consultation Fee</span>
                  <span className="text-slate-800 font-extrabold text-sm">
                    ₹{(checkInFeeType === 'Emergency Consultation Fee' ? 1200 : 500).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-blue-50/50 border border-blue-100 rounded-xl px-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-extrabold text-slate-800">Collect Fee Upfront (Pay Now)</span>
                    <span className="text-[8px] text-slate-500 font-bold">Paid status routes directly to Doctor Queue</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={payNow}
                    onChange={e => setPayNow(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 font-bold rounded-full text-xs bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    Register Check-In
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCheckInModalOpen(false)}
                    className="flex-1 font-bold rounded-full text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-center p-4 space-y-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-emerald-800 text-sm">Patient Check-in Successful!</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Walk-in queue registration has been logged.</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2 font-mono text-[10px] text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Queue Token:</span>
                    <span className="font-black text-xs text-slate-900">{checkInSuccessData.tokenNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Doc:</span>
                    <span className="font-bold text-slate-800">{checkInSuccessData.doctorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fee Logged:</span>
                    <span className="font-bold text-slate-800">₹{checkInSuccessData.amount} ({checkInSuccessData.feeType})</span>
                  </div>
                </div>

                <Button
                  onClick={() => setIsCheckInModalOpen(false)}
                  className="w-full font-bold rounded-full text-xs mt-2"
                >
                  Done & Close
                </Button>
              </div>
            )}
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
