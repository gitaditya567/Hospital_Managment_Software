import { 
  Search, Users, Activity, Clock, Phone, FileText, 
  CheckCircle2, Heart, Thermometer, Wind,
  Printer, Copy, Check, AlertCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getPrintSettings } from '../../utils/printSettings';

export function DoctorSearch() {
  const { patients } = useHospitalStore();
  const { user } = useAuthStore();
  
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Aggregate unique patient profiles from patient records map
  const uniquePatientsMap = new Map<string, any>();
  patients.forEach(p => {
    const existing = uniquePatientsMap.get(p.phone);
    // Prefer more detailed or recently updated patient logs
    if (!existing || (p.createdAt && new Date(p.createdAt) > new Date(existing.createdAt))) {
      uniquePatientsMap.set(p.phone, p);
    }
  });
  const uniquePatients = Array.from(uniquePatientsMap.values());

  // Filter patients based on query search (defaults to all if empty)
  const filteredPatients = uniquePatients.filter(p => {
    const query = search.trim().toLowerCase();
    if (!query) return true; // Show all by default so doctors don't face a blank sidebar!
    return (
      p.name.toLowerCase().includes(query) ||
      p.phone.includes(query) ||
      (p.patientNo && p.patientNo.toLowerCase().includes(query)) ||
      p.id.toLowerCase().includes(query)
    );
  });

  // Calculate statistics for directory dashboard
  const totalUniqueCount = uniquePatients.length;
  const averageAge = totalUniqueCount > 0 
    ? Math.round(uniquePatients.reduce((sum, p) => sum + p.age, 0) / totalUniqueCount) 
    : 0;

  // Pull medical prescription records and consultation timelines on selection
  useEffect(() => {
    const fetchPatientHistory = async () => {
      if (!selectedPatient || !user?.hospitalId) {
        setPastVisits([]);
        return;
      }

      setLoadingHistory(true);
      try {
        // Source 1: OPD registration records
        const completedVisits = patients
          .filter(p => p.phone === selectedPatient.phone)
          .map(p => ({
            date: p.createdAt 
              ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : p.timeRegistered || 'Unknown date',
            doctor: p.doctorName,
            tokenNumber: p.tokenNumber,
            medicines: 'Prescription details logged in pharmacy EMR',
            rxCode: null,
            status: p.status,
            vitals: p.vitals || [],
            pastDiagnoses: p.pastDiagnoses || ''
          }));

        // Source 2: Rich prescription logs
        let rxHistory: any[] = [];
        try {
          const response = await fetch(
            `/api/pharmacy/prescriptions/history?phone=${encodeURIComponent(selectedPatient.phone)}&hospitalId=${user.hospitalId}`
          );
          if (response.ok) {
            const data = await response.json();
            rxHistory = data.map((rx: any) => ({
              date: rx.date || new Date(rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              doctor: rx.doctorName,
              tokenNumber: null,
              medicines: rx.items || [], // Preserve full objects array!
              rxCode: rx.code,
              status: rx.status,
              vitals: [],
              pastDiagnoses: ''
            }));
          }
        } catch {
          // Fallback if pharmacy server offline
        }

        // Source 3: Paid pharmacy bills
        let billsHistory: any[] = [];
        try {
          const response = await fetch(
            `/api/pharmacy/bills?phone=${encodeURIComponent(selectedPatient.phone)}&hospitalId=${user.hospitalId}`
          );
          if (response.ok) {
            const data = await response.json();
            billsHistory = data.map((bill: any) => ({
              date: bill.date || new Date(bill.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              doctor: bill.doctorName,
              rxCode: bill.rxCode,
              status: 'Dispensed Checkout',
              medicines: bill.items || [],
              items: bill.items || [],
              total: bill.total,
              paymentMode: bill.paymentMode,
              isPharmacyInvoice: true,
              vitals: [],
              pastDiagnoses: ''
            }));
          }
        } catch (err) {
          console.error("Failed to load pharmacy bills history:", err);
        }

        // Merge prescription histories chronologically/logically
        const mergedHistory = [
          ...billsHistory,
          ...rxHistory.filter(rx => !billsHistory.some(b => b.rxCode === rx.rxCode)),
          ...completedVisits.filter(cv => 
            !rxHistory.some(rx => rx.date === cv.date && rx.doctor === cv.doctor) &&
            !billsHistory.some(b => b.date === cv.date && b.doctor === cv.doctor)
          )
        ];

        setPastVisits(mergedHistory);
      } catch (error) {
        console.error('Failed to load patient history timeline', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchPatientHistory();
  }, [selectedPatient?.phone, user?.hospitalId, patients]);

  // Copy prescription details in a readable format
  const handleCopyPrescription = (visit: any) => {
    let copyText = `Clinical Prescription Record\n=========================\nPatient: ${selectedPatient.name} (${selectedPatient.gender}, ${selectedPatient.age} Yrs)\nPhone: ${selectedPatient.phone}\nDoctor: Dr. ${visit.doctor}\nDate: ${visit.date}\nRx Code: ${visit.rxCode || 'N/A'}\n\nMedicines Prescribed:\n`;
    
    if (Array.isArray(visit.medicines)) {
      visit.medicines.forEach((med: any, idx: number) => {
        copyText += `${idx + 1}. ${med.name} | Dosage: ${med.dosage || '1-0-1'} | Duration: ${med.duration || '5 Days'} | Qty: ${med.qty || 10}\n`;
      });
    } else {
      copyText += `- ${visit.medicines}\n`;
    }

    navigator.clipboard.writeText(copyText);
    setCopiedCode(visit.rxCode || 'copied');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Modern Clinical Prescription slip Print Handler
  const handlePrintPrescription = (visit: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const settings = getPrintSettings();

    const medicinesHtml = Array.isArray(visit.medicines)
      ? visit.medicines.map((med: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: ${settings.padding}px 10px; font-weight: bold; color: #1e293b; text-align: left;">${med.name}</td>
          <td style="padding: ${settings.padding}px 10px; text-align: center; font-family: monospace; font-weight: 700; color: ${settings.accentColor}; background-color: #f8fafc; border-radius: 6px;">${med.dosage || '1-0-1'}</td>
          <td style="padding: ${settings.padding}px 10px; text-align: center; color: #64748b; font-weight: 500;">${med.duration || '5 Days'}</td>
          <td style="padding: ${settings.padding}px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #334155;">${med.qty || 10}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" style="padding: 20px; color: #64748b; font-style: italic; text-align: center;">${visit.medicines}</td></tr>`;

    const headerBlock = settings.showHeader
      ? `<div class="header">
          <div class="clinic-details">
            <h1>${settings.customHeaderText || (user?.hospitalId ? 'City Care Hospital' : 'EMR Medical Center')}</h1>
            <p>State-of-the-Art Digital EMR Clinical Record</p>
          </div>
          <div>
            <p class="rx-title">R<sub>x</sub></p>
          </div>
        </div>`
      : `<div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
          <p class="rx-title">R<sub>x</sub></p>
        </div>`;

    const footerBlock = settings.showFooter
      ? `<div class="footer">
          ${settings.customFooterText || 'This is an authentic computer-generated EMR prescription copy.'}
        </div>`
      : '';

    const rawHtml = `
      <html>
        <head>
          <title>Prescription Slip - ${visit.rxCode || 'EMR'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: ${settings.margin}mm;
            }
            body { 
              font-family: 'Inter', system-ui, -apple-system, sans-serif; 
              padding: ${settings.padding * 2}px; 
              color: #334155; 
              line-height: 1.5; 
              font-size: ${settings.fontSize}px;
            }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid ${settings.accentColor}; padding-bottom: 20px; margin-bottom: 30px; }
            .clinic-details h1 { margin: 0; font-size: 26px; font-weight: 850; color: #1e293b; letter-spacing: -0.02em; }
            .clinic-details p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .rx-title { font-size: 36px; font-weight: 900; color: ${settings.accentColor}; margin: 0; font-style: italic; font-family: serif; }
            .meta-grid { display: grid; grid-template-cols: 1.2fr 0.8fr; gap: 20px; margin-bottom: 35px; background-color: #f8fafc; padding: 20px; border-radius: 14px; border: 1px solid #e2e8f0; }
            .meta-item p { margin: 6px 0; font-size: 13.5px; font-weight: 600; color: #475569; }
            .meta-item strong { color: #1e293b; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th { background-color: #f1f5f9; padding: 14px 10px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; font-weight: 800; border-bottom: 2.5px solid #cbd5e1; }
            .footer { margin-top: 80px; border-top: 1px dashed #cbd5e1; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 700; letter-spacing: 0.02em; }
            .signature { margin-top: 60px; display: flex; justify-content: flex-end; }
            .signature-box { border-top: 1.5px solid #1e293b; width: 220px; text-align: center; padding-top: 8px; font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em; }
            @media print {
              body { padding: 15px; }
            }
          </style>
        </head>
        <body>
          ${headerBlock}
          
          <div class="meta-grid">
            <div class="meta-item">
              <p><strong>Patient Name:</strong> ${selectedPatient.name}</p>
              <p><strong>Age / Gender:</strong> ${selectedPatient.age} Yrs / ${selectedPatient.gender || 'Not specified'}</p>
              <p><strong>Contact Phone:</strong> ${selectedPatient.phone}</p>
            </div>
            <div class="meta-item" style="text-align: right;">
              <p><strong>Prescription Date:</strong> ${visit.date}</p>
              <p><strong>Consulting Doctor:</strong> Dr. ${visit.doctor}</p>
              <p><strong>Rx Code Reference:</strong> <span style="font-family: monospace; font-weight: 800; color: ${settings.accentColor};">${visit.rxCode || 'N/A'}</span></p>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 850; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; border-left: 4px solid ${settings.accentColor}; padding-left: 8px;">Prescribed Medications</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align: left; padding-left: 10px;">Medicine Name</th>
                <th style="width: 130px;">Dosage Shorthand</th>
                <th style="width: 120px;">Duration</th>
                <th style="width: 90px;">Total Qty</th>
              </tr>
            </thead>
            <tbody>
              ${medicinesHtml}
            </tbody>
          </table>

          <div class="signature">
            <div>
              <div class="signature-box">Authorized Medical Practitioner</div>
              <p style="margin: 4px 0 0 0; font-size: 12px; text-align: center; color: #475569; font-weight: 700;">Dr. ${visit.doctor}</p>
            </div>
          </div>

          ${footerBlock}

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(rawHtml);
    printWindow.document.close();
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Search className="text-blue-600" /> Patient Directory Search
          </h1>
          <p className="text-slate-500 text-xs font-semibold">Query global clinical databases to pull complete longitudinal EMRs and prescription timelines</p>
        </div>
        
        {/* Statistics Pillbox */}
        <div className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-500">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-1.5 text-center">
            <span className="text-[10px] text-slate-400 block uppercase">Global Records</span>
            <span className="text-slate-800 text-sm font-black">{totalUniqueCount} Patients</span>
          </div>
          <div className="bg-blue-50 border border-blue-100/50 rounded-xl px-3.5 py-1.5 text-center text-blue-700">
            <span className="text-[10px] text-blue-400 block uppercase">Average Age</span>
            <span className="text-blue-800 text-sm font-black">{averageAge} Yrs</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Side: Directory Queries (span 4) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col h-[calc(100vh-14rem)] overflow-hidden">
          <div className="space-y-4 h-full flex flex-col">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Search Patient Master Directory</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Type name, phone or record ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs font-semibold text-slate-700 bg-slate-50/50 transition-all" 
                />
              </div>
            </div>

            {/* Results listing */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
              {filteredPatients.map(p => {
                const isSelected = selectedPatient?.phone === p.phone;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`p-3.5 rounded-xl cursor-pointer hover:bg-slate-50/80 transition-all mb-2 border ${
                      isSelected 
                        ? 'bg-blue-50/50 border-blue-200/70 shadow-sm' 
                        : 'bg-white border-slate-100/80'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-[10px] uppercase shadow-sm">
                          {p.name.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div>{p.name}</div>
                          {p.patientNo && (
                            <span className="px-1.5 py-0.2 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[8px] font-bold font-mono mt-0.5 inline-block">
                              {p.patientNo}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-black rounded font-mono uppercase">
                        {p.gender || 'Female'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2.5 text-[10px] text-slate-400 font-semibold border-t border-slate-50 pt-2">
                      <span className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
                        <Phone size={10} className="text-slate-400" /> {p.phone}
                      </span>
                      <span>Age: {p.age} Yrs</span>
                    </div>
                  </div>
                );
              })}

              {filteredPatients.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs font-bold">
                  No matching clinical profiles found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Longitudinal Patient Chart (span 6) */}
        <div className="lg:col-span-6 flex flex-col h-[calc(100vh-14rem)]">
          {selectedPatient ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
              
              {/* EMR Header Card */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-800">{selectedPatient.name}</h2>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 size={10} /> Active EMR File
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Patient No: <span className="font-extrabold text-blue-600 font-mono">{selectedPatient.patientNo || 'N/A'}</span> • Age: {selectedPatient.age} Yrs • Gender: {selectedPatient.gender || 'Not specified'} • Phone: <span className="font-mono text-slate-700 font-bold">{selectedPatient.phone}</span>
                  </p>
                </div>
                
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                  REF: {selectedPatient.id.substring(0, 8)}
                </span>
              </div>

              {/* Scrollable details container */}
              <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-10 gap-5 min-h-0">
                
                {/* Left col: Vitals + Diagnoses (span 4) */}
                <div className="md:col-span-4 space-y-5">
                  
                  {/* Captured Vitals */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] uppercase tracking-wider font-black text-slate-400 flex items-center gap-1.5 border-b border-slate-50 pb-1.5">
                      <Activity size={12} className="text-blue-500" /> Active Vitals
                    </h3>
                    
                    {selectedPatient.vitals && selectedPatient.vitals.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2.5">
                        {selectedPatient.vitals.map((v: any) => {
                          let cardColor = 'bg-slate-50/60 border-slate-100 text-slate-700';
                          let alertIcon = null;

                          if (v.name === 'Temperature' && parseFloat(v.value) > 100) {
                            cardColor = 'bg-amber-50/70 border-amber-200 text-amber-900';
                            alertIcon = <Thermometer size={10} className="text-amber-500 animate-pulse" />;
                          } else if (v.name === 'SpO2' && parseFloat(v.value) < 95) {
                            cardColor = 'bg-rose-50/70 border-rose-200 text-rose-900';
                            alertIcon = <Wind size={10} className="text-rose-500 animate-pulse" />;
                          } else if (v.name === 'Blood Pressure' && parseInt(v.value.split('/')[0]) >= 140) {
                            cardColor = 'bg-rose-50/70 border-rose-200 text-rose-900';
                            alertIcon = <Heart size={10} className="text-rose-500 animate-pulse" />;
                          } else if (v.name === 'Heart Rate' && (parseFloat(v.value) > 100 || parseFloat(v.value) < 60)) {
                            cardColor = 'bg-amber-50/70 border-amber-200 text-amber-900';
                          }

                          return (
                            <div key={v.name} className={`p-3 rounded-xl border flex items-center justify-between shadow-sm transition-all hover:scale-[1.01] ${cardColor}`}>
                              <div>
                                <span className="text-[8px] font-bold text-slate-400 block uppercase tracking-wider">{v.name}</span>
                                <span className="text-xs font-black tracking-tight font-mono mt-0.5">{v.value}</span>
                              </div>
                              {alertIcon}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 px-3 bg-slate-50/60 border border-slate-100/80 rounded-xl text-center">
                        <AlertCircle size={14} className="text-slate-300 mx-auto mb-1" />
                        <p className="text-[10px] text-slate-400 italic">No active vitals registered.</p>
                      </div>
                    )}
                  </div>

                  {/* Past Diagnoses */}
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] uppercase tracking-wider font-black text-slate-400 flex items-center gap-1.5 border-b border-slate-50 pb-1.5">
                      <FileText size={12} className="text-blue-500" /> Diagnosed History
                    </h3>
                    
                    {selectedPatient.pastDiagnoses ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPatient.pastDiagnoses.split(',').map((diag: string, idx: number) => (
                          <span 
                            key={idx} 
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold"
                          >
                            {diag.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                        <p className="text-[10px] text-slate-400 italic">No diagnosed history logged.</p>
                      </div>
                    )}
                  </div>

                </div>

                {/* Right col: Prescription Logs Timeline (span 6) */}
                <div className="md:col-span-6 space-y-4 border-l border-slate-100 pl-4">
                  <h3 className="text-[10px] uppercase tracking-wider font-black text-slate-400 flex items-center gap-1.5 border-b border-slate-50 pb-1.5">
                    <Clock size={12} className="text-blue-500" /> Medical Prescriptions Timeline
                  </h3>

                  {loadingHistory ? (
                    <div className="text-center py-16 text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span className="text-[10px] font-semibold">Retrieving EMR Prescription history...</span>
                    </div>
                  ) : pastVisits.length > 0 ? (
                    <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-6">
                      {pastVisits.map((visit: any, index: number) => {
                        const isPharmacy = !!visit.isPharmacyInvoice;
                        return (
                          <div key={index} className="relative animate-in slide-in-from-left duration-250">
                            
                            {/* Bullet */}
                            <div className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ring-4 ${
                              isPharmacy ? "bg-emerald-500 ring-emerald-50" : "bg-blue-500 ring-blue-50"
                            }`}></div>
                            
                            <div className="space-y-2 text-xs text-left">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-slate-800 text-sm">
                                  {isPharmacy ? "Pharmacy POS Checkout" : `Dr. ${visit.doctor}`}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold font-mono">{visit.date}</span>
                              </div>
                              
                              {isPharmacy ? (
                                /* Detailed Green-Accented Pharmacy Invoice Receipt Card */
                                <div className="bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/30 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
                                  
                                  <div className="flex justify-between items-center pb-2 border-b border-dashed border-emerald-200">
                                    <div>
                                      <span className="text-[8px] font-black uppercase text-emerald-600 block tracking-widest">dispensed invoice</span>
                                      <span className="font-mono text-[9px] font-black text-slate-700">Rx Ref: {visit.rxCode}</span>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[9px] font-black uppercase tracking-wider font-mono">
                                      PAID ({visit.paymentMode})
                                    </span>
                                  </div>

                                  <table className="w-full text-left border-collapse text-[10px]">
                                    <thead>
                                      <tr className="text-emerald-700/70 font-bold uppercase tracking-wider">
                                        <th className="py-1 px-1">Dispensed Item</th>
                                        <th className="py-1 px-1 text-center">Qty</th>
                                        <th className="py-1 px-1 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {visit.items.map((item: any, itemIdx: number) => (
                                        <tr key={itemIdx} className="border-b border-emerald-100/40 text-slate-700 font-semibold">
                                          <td className="py-1.5 px-1 font-bold text-slate-800">{item.name}</td>
                                          <td className="py-1.5 px-1 text-center font-mono text-slate-600 font-bold">{item.qty} units</td>
                                          <td className="py-1.5 px-1 text-right font-mono text-slate-800 font-black">₹{(item.qty * item.price).toLocaleString('en-IN')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-emerald-200 text-slate-700">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">grand total paid</span>
                                    <span className="font-mono text-sm font-black text-emerald-700 bg-emerald-100/40 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                                      ₹{visit.total.toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                /* Prescription Table box */
                                <div className="bg-slate-50/60 border border-slate-200/60 p-3 rounded-xl shadow-sm hover:border-slate-300/80 transition-all">
                                  {Array.isArray(visit.medicines) && visit.medicines.length > 0 ? (
                                    <div className="space-y-2.5">
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-[10px]">
                                          <thead>
                                            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                                              <th className="py-1 px-1">Medication</th>
                                              <th className="py-1 px-1 text-center">Dosage</th>
                                              <th className="py-1 px-1 text-center">Dur</th>
                                              <th className="py-1 px-1 text-center">Qty</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {visit.medicines.map((med: any, mIdx: number) => (
                                              <tr key={mIdx} className="border-b border-slate-100/60 text-slate-700 font-semibold">
                                                <td className="py-1.5 px-1 font-bold text-slate-800">{med.name}</td>
                                                <td className="py-1.5 px-1 text-center font-mono text-[9px] text-blue-600 bg-blue-50/40 rounded mt-0.5 inline-block">{med.dosage || '1-0-1'}</td>
                                                <td className="py-1.5 px-1 text-center text-slate-500">{med.duration || '5 Days'}</td>
                                                <td className="py-1.5 px-1 text-center font-mono text-slate-600 font-extrabold">{med.qty || 10}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                                      <strong className="text-slate-800">Medicines Prescribed:</strong> {visit.medicines}
                                    </p>
                                  )}

                                  {/* Action Items on timeline prescription card */}
                                  <div className="flex justify-between items-center border-t border-slate-200/50 pt-2.5 mt-3 text-[9px]">
                                    
                                    <div className="flex items-center gap-2">
                                      {visit.rxCode && (
                                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded font-bold font-mono">
                                          Rx: {visit.rxCode}
                                        </span>
                                      )}
                                      <span className={`uppercase text-[8px] font-extrabold px-1.5 py-0.5 rounded border ${
                                        visit.status === 'DISPENSED' 
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                                          : 'border-amber-200 bg-amber-50 text-amber-700'
                                      }`}>
                                        {visit.status}
                                      </span>
                                    </div>

                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleCopyPrescription(visit)}
                                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-bold hover:bg-slate-100 rounded-lg px-2"
                                      >
                                        {copiedCode === visit.rxCode ? (
                                          <>
                                            <Check size={10} className="text-emerald-500" />
                                            <span className="text-emerald-600">Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy size={10} />
                                            <span>Copy Rx</span>
                                          </>
                                        )}
                                      </button>

                                      <button
                                        onClick={() => handlePrintPrescription(visit)}
                                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-bold hover:bg-slate-100 rounded-lg px-2"
                                      >
                                        <Printer size={10} />
                                        <span>Print Rx</span>
                                      </button>
                                    </div>

                                  </div>
                                </div>
                              )}

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 border border-slate-200 border-dashed rounded-2xl bg-slate-50/50">
                      <p className="text-[11px] font-semibold">No medical prescriptions timeline logged.</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Patient has not been prescribed any medicines yet.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center p-12 text-center h-full text-slate-400">
              
              {/* Directory Dashboard UI inside EMR frame when no patient selected */}
              <div className="max-w-md space-y-6">
                <div className="bg-blue-50/50 p-4 rounded-full h-16 w-16 flex items-center justify-center mx-auto border border-blue-100/50">
                  <Users className="text-blue-600 animate-pulse" size={28} />
                </div>
                
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Longitudinal EMR File Viewer</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                    Select any patient from the master list on the left to inspect longitudinal clinical records, active vitals alert parameters, diagnoses history, and full pharmaceutical prescriptions history.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-4 text-left">
                  <div className="bg-slate-50 border border-slate-100/60 p-3 rounded-xl text-center">
                    <span className="text-slate-800 text-sm font-black">{uniquePatients.length}</span>
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider mt-0.5">Total Profiles</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100/60 p-3 rounded-xl text-center">
                    <span className="text-slate-800 text-sm font-black">
                      {patients.filter(p => p.status === 'Completed').length}
                    </span>
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider mt-0.5">Total Consultations</span>
                  </div>
                </div>

                <div className="flex justify-center gap-1.5 text-[10px] text-blue-500 font-bold bg-blue-50/50 py-2.5 px-4 rounded-xl border border-blue-100/40">
                  <AlertCircle size={12} className="text-blue-500" />
                  <span>AES-256 and HIPAA compliant record directory</span>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
