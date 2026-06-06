import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Mic, CheckCircle, Clock, Users, UserCheck, Eye, EyeOff, ShieldAlert, FileText, Phone, User, Activity, Search, Keyboard, Trash2, Edit, X, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';

export function DoctorDashboard() {
  const { user } = useAuthStore();
  const { patients, updatePatientStatus, fetchHospitalData } = useHospitalStore();

  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isDndMode, setIsDndMode] = useState(false);
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Smart Dual-mode Entry states
  const [entryMode, setEntryMode] = useState<'voice' | 'manual'>('voice');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [manualMedicine, setManualMedicine] = useState('');
  const [manualDosage, setManualDosage] = useState('');
  const [manualDuration, setManualDuration] = useState('');

  const AI_MEDICINES = [
    { name: 'Paracetamol 500mg', category: 'Analgesic / Fever', defaultDosage: '1-0-1 (Post meals)', defaultDuration: '3 Days' },
    { name: 'Paracetamol 650mg (Dolo)', category: 'Analgesic / Fever', defaultDosage: '1-1-1 (Post meals)', defaultDuration: '3 Days' },
    { name: 'Amoxicillin 250mg', category: 'Antibiotic', defaultDosage: '1-0-1', defaultDuration: '5 Days' },
    { name: 'Amoxicillin 500mg', category: 'Antibiotic', defaultDosage: '1-0-1', defaultDuration: '5 Days' },
    { name: 'Ibuprofen 400mg', category: 'NSAID / Painkiller', defaultDosage: '1-0-1 (Post meals)', defaultDuration: '3 Days' },
    { name: 'Metformin 500mg', category: 'Antidiabetic', defaultDosage: '0-1-0 (Pre meals)', defaultDuration: '30 Days' },
    { name: 'Amlodipine 5mg', category: 'Antihypertensive', defaultDosage: '1-0-0 (Morning)', defaultDuration: '30 Days' },
    { name: 'Pantoprazole 40mg (Pan-D)', category: 'Antacid / Gastric', defaultDosage: '1-0-0 (Empty stomach)', defaultDuration: '10 Days' },
    { name: 'Cetirizine 10mg', category: 'Antihistamine / Allergy', defaultDosage: '0-0-1 (Night)', defaultDuration: '5 Days' },
    { name: 'Azithromycin 500mg', category: 'Antibiotic', defaultDosage: '1-0-0', defaultDuration: '3 Days' },
    { name: 'Montelukast 10mg', category: 'Anti-asthma', defaultDosage: '0-0-1 (Night)', defaultDuration: '15 Days' },
    { name: 'Loperamide 2mg', category: 'Anti-diarrheal', defaultDosage: '1-0-1', defaultDuration: '2 Days' },
  ];

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const filtered = AI_MEDICINES.filter(med =>
      med.name.toLowerCase().includes(query.toLowerCase()) ||
      med.category.toLowerCase().includes(query.toLowerCase())
    );
    setSearchSuggestions(filtered);
  };

  const handleSelectSuggestion = (med: any) => {
    setManualMedicine(med.name);
    setManualDosage(med.defaultDosage);
    setManualDuration(med.defaultDuration);
    setSearchQuery('');
    setSearchSuggestions([]);
  };

  const handleAddManualMedicine = () => {
    if (!manualMedicine.trim()) return;
    const newMed = {
      medicine: manualMedicine.trim(),
      dosage: manualDosage.trim() || '1-0-1',
      duration: manualDuration.trim() || '5 Days'
    };
    setPrescriptions(prev => [...prev, newMed]);
    setManualMedicine('');
    setManualDosage('');
    setManualDuration('');
  };

  // Inline Medication Editing states & handlers
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editMedicine, setEditMedicine] = useState('');
  const [editDosage, setEditDosage] = useState('');
  const [editDuration, setEditDuration] = useState('');

  const handleStartEdit = (index: number, p: any) => {
    setEditingIndex(index);
    setEditMedicine(p.medicine);
    setEditDosage(p.dosage);
    setEditDuration(p.duration);
  };

  const handleSaveEdit = (index: number) => {
    if (!editMedicine.trim()) return;
    setPrescriptions(prev => prev.map((p, idx) => idx === index ? {
      medicine: editMedicine.trim(),
      dosage: editDosage.trim() || '1-0-1',
      duration: editDuration.trim() || '5 Days'
    } : p));
    setEditingIndex(null);
  };

  const recognitionRef = useRef<any>(null);

  // Auto-deselect patient if DND mode is turned on
  // Load doctor DND status on mount
  useEffect(() => {
    if (!user?.email || !user?.hospitalId) return;
    const loadDoctorDnd = async () => {
      try {
        const res = await fetch(`/api/hospital/staff/profile/details?email=${user.email}&hospitalId=${user.hospitalId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'Inactive') {
            setIsDndMode(true);
          }
        }
      } catch (err) {
        console.error('Failed to load doctor profile status', err);
      }
    };
    loadDoctorDnd();
  }, [user]);

  // Sync DND state changes to database staff status
  const updateDndStatus = async (dndState: boolean) => {
    if (!user?.email || !user?.hospitalId) return;
    try {
      const nextStatus = dndState ? 'Inactive' : 'Active';
      await fetch('/api/hospital/staff/profile/details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          hospitalId: user.hospitalId,
          status: nextStatus
        })
      });
      // Refresh global hospital data
      await fetchHospitalData(user.hospitalId);
    } catch (error) {
      console.error('Failed to sync doctor DND status to backend', error);
    }
  };

  useEffect(() => {
    if (isDndMode) {
      setSelectedPatient(null);
    }
  }, [isDndMode]);

  // Real-time patient live-sync polling: Fetches database updates every 5 seconds
  useEffect(() => {
    if (!user?.hospitalId) return;

    // Initial load on dashboard mount
    fetchHospitalData(user.hospitalId);

    // Live polling stream interval
    const pollInterval = setInterval(() => {
      if (user?.hospitalId) {
        fetchHospitalData(user.hospitalId);
      }
    }, 5000); // 5 seconds refresh rate

    return () => clearInterval(pollInterval);
  }, [user?.hospitalId, fetchHospitalData]);

  // Fetch patient past visit history whenever a patient is selected
  // Sources: (1) Completed patient records in patients store matching phone number
  //          (2) Pharmacy prescriptions for this patient phone
  useEffect(() => {
    const buildHistory = async () => {
      if (!selectedPatient || !user?.hospitalId) {
        setPastVisits([]);
        return;
      }

      setLoadingHistory(true);
      try {
        // Source 1: All completed visits for this phone number from the in-memory store
        const completedVisits = patients
          .filter(p =>
            p.phone === selectedPatient.phone &&
            p.status === 'Completed'
          )
          .map(p => ({
            date: p.createdAt
              ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : p.timeRegistered || 'Unknown date',
            doctor: p.doctorName,
            tokenNumber: p.tokenNumber,
            medicines: 'Prescription pending pharmacy sync',
            rxCode: null as string | null,
            status: 'COMPLETED'
          }));

        // Source 2: Pharmacy prescriptions for richer medicine detail
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
              medicines: rx.items.length > 0
                ? rx.items.map((item: any) => `${item.name}`).join(', ')
                : 'No medicines recorded',
              rxCode: rx.code,
              status: rx.status
            }));
          }
        } catch {
          // Pharmacy might be offline — continue with completed visits
        }

        // Merge: prefer rxHistory entries (more detailed), fall back to completedVisits
        // De-duplicate by merging completed visits that have a matching rx prescription
        const mergedHistory = [
          ...rxHistory,
          ...completedVisits.filter(cv =>
            !rxHistory.some(rx => rx.date === cv.date && rx.doctor === cv.doctor)
          )
        ];

        setPastVisits(mergedHistory);
      } catch (error) {
        console.error('Failed to build past visits history', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    buildHistory();
  }, [selectedPatient?.id, user?.hospitalId]);

  // Filter patients allotted to this doctor who are either waiting or currently in consultation.
  // Sort so that the patient in consultation is always at the top of the queue.
  const doctorQueue = patients
    .filter(p =>
      p.doctorName.toLowerCase().trim() === user?.name?.toLowerCase().trim() &&
      (p.status === 'Waiting' || p.status === 'In Consultation')
    )
    .sort((a, b) => {
      if (a.status === 'In Consultation') return -1;
      if (b.status === 'In Consultation') return 1;
      return 0;
    });

  const waitingPatients = doctorQueue.filter(p => p.status === 'Waiting');

  const totalWaitingCount = doctorQueue.length;
  const checkedTodayCount = patients.filter(p =>
    p.doctorName.toLowerCase().trim() === user?.name?.toLowerCase().trim() &&
    p.status === 'Completed'
  ).length;

  // Auto-select active consultation patient on mount/update if not already selected
  useEffect(() => {
    if (!selectedPatient && !isDndMode) {
      const activeConsult = doctorQueue.find(p => p.status === 'In Consultation');
      if (activeConsult) {
        setSelectedPatient(activeConsult);
      }
    }
  }, [doctorQueue, selectedPatient, isDndMode]);

  // Handle selecting a patient: updates clicked patient to In Consultation and resets others to Waiting
  const handleSelectPatient = async (patient: any) => {
    setSelectedPatient(patient);

    try {
      // 1. Set clicked patient's status to 'In Consultation'
      if (patient.status !== 'In Consultation') {
        await updatePatientStatus(patient.id, 'In Consultation');
      }

      // 2. Set all other patients of this doctor who are currently 'In Consultation' back to 'Waiting'
      const otherConsulting = patients.filter(p =>
        p.id !== patient.id &&
        p.doctorName.toLowerCase().trim() === user?.name?.toLowerCase().trim() &&
        p.status === 'In Consultation'
      );

      for (const other of otherConsulting) {
        await updatePatientStatus(other.id, 'Waiting');
      }

      // 3. Refresh global hospital operational data
      if (user?.hospitalId) {
        await fetchHospitalData(user.hospitalId);
      }
    } catch (err) {
      console.error("Failed to transition patient statuses:", err);
    }
  };

  useEffect(() => {
    // Setup Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(prev => {
          const newText = prev + ' ' + currentTranscript;
          parseTranscript(currentTranscript);
          return newText;
        });
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
    } else {
      setTranscript('');
      recognitionRef.current?.start();
      setIsDictating(true);
    }
  };

  const parseTranscript = (text: string) => {
    // A simplified keyword scanner for demonstration
    // "Prescribing Paracetamol 500 milligram twice a day for five days"
    const lowerText = text.toLowerCase();

    if (lowerText.includes('paracetamol')) {
      // Avoid duplicates
      if (!prescriptions.some(p => p.medicine === 'Paracetamol 500mg')) {
        setPrescriptions(prev => [...prev, {
          medicine: 'Paracetamol 500mg',
          dosage: '1-0-1 (Twice a day)',
          duration: '5 Days'
        }]);
      }
    }
    if (lowerText.includes('amoxicillin')) {
      if (!prescriptions.some(p => p.medicine === 'Amoxicillin 250mg')) {
        setPrescriptions(prev => [...prev, {
          medicine: 'Amoxicillin 250mg',
          dosage: '1-1-1',
          duration: '3 Days'
        }]);
      }
    }
  };

  const handlePutOnHold = async () => {
    if (!selectedPatient || !user?.hospitalId) return;
    try {
      await updatePatientStatus(selectedPatient.id, 'Waiting');
      await fetchHospitalData(user.hospitalId);
      setSelectedPatient(null);
      setPrescriptions([]);
      setTranscript('');
    } catch (err) {
      console.error("Failed to put patient on hold:", err);
    }
  };

  const handleCompleteAndClose = async () => {
    if (!selectedPatient || !user?.hospitalId) return;
    if (prescriptions.length > 0) {
      await saveAndSend();
    } else {
      try {
        await updatePatientStatus(selectedPatient.id, 'Completed');
        await fetchHospitalData(user.hospitalId);
        setSelectedPatient(null);
        setPrescriptions([]);
        setTranscript('');
      } catch (err) {
        console.error("Failed to complete patient checkup:", err);
      }
    }
  };

  const saveAndSend = async () => {
    if (!selectedPatient || !user?.hospitalId) return;

    const rxCode = `RX-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // 1. Submit Prescription to the Pharmacy database
      await fetch('/api/pharmacy/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rxCode,
          patientNo: selectedPatient.patientNo,
          patientName: selectedPatient.name,
          patientPhone: selectedPatient.phone,
          doctorName: user.name,
          items: prescriptions.map(p => ({
            name: p.medicine,
            qty: p.qty || 10,
            price: p.price || 15.00,
            dosage: p.dosage || '',
            duration: p.duration || ''
          })),
          hospitalId: user.hospitalId
        })
      });

      // 2. Mark operational patient status as Completed
      await updatePatientStatus(selectedPatient.id, 'Completed');

      // 3. Refresh dashboard data
      await fetchHospitalData(user.hospitalId);

      alert(`Prescription saved! RX-Code: ${rxCode} sent to Pharmacy.`);
      setSelectedPatient(null);
      setTranscript('');
      setPrescriptions([]);
    } catch (error) {
      console.error('Failed to submit prescription', error);
      alert('Error connecting to operational pharmacy network.');
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 font-sans">
      {/* Left Column: Waiting Room */}
      <div className="w-1/3 glass-card rounded-2xl shadow-[0_8px_30px_rgba(13,148,136,0.03)] border border-teal-100/50 flex flex-col overflow-hidden">
        {/* Header with DND Toggle */}
        <div className="p-4 border-b border-teal-50 bg-teal-50/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isDndMode ? "bg-rose-500 animate-pulse" : "bg-emerald-500 animate-pulse"
            )} />
            <h2 className="font-bold text-slate-800 tracking-tight text-sm text-glow-teal">Waiting Room</h2>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={() => {
              const nextVal = !isDndMode;
              setIsDndMode(nextVal);
              updateDndStatus(nextVal);
            }}
            className={cn(
              "relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              isDndMode ? "bg-rose-500" : "bg-emerald-500"
            )}
            role="switch"
            aria-checked={isDndMode}
          >
            <span className="sr-only">Toggle DND Mode</span>
            <span
              className={cn(
                "pointer-events-none relative inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center",
                isDndMode ? "translate-x-5" : "translate-x-0"
              )}
            >
              {isDndMode ? (
                <EyeOff size={8} className="text-rose-600" />
              ) : (
                <Eye size={8} className="text-emerald-600" />
              )}
            </span>
          </button>
        </div>

        {/* Stats Row - Always Visible */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-teal-50/10 border-b border-teal-100/50">
          <div className="bg-white/80 backdrop-blur-md p-2.5 rounded-xl border border-teal-100/40 shadow-sm flex items-center gap-2 hover:border-teal-300 transition-colors">
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Users size={14} />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Total Waiting</p>
              <p className="text-sm font-bold text-slate-800">{totalWaitingCount}</p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-md p-2.5 rounded-xl border border-teal-100/40 shadow-sm flex items-center gap-2 hover:border-teal-300 transition-colors">
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <UserCheck size={14} />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Checked Today</p>
              <p className="text-sm font-bold text-slate-800">{checkedTodayCount}</p>
            </div>
          </div>
        </div>

        {/* Patient Queue Content or DND Mode View */}
        <div className="flex-1 overflow-y-auto p-2 relative">
          {isDndMode ? (
            /* Premium Focus Block Overlay */
            <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="relative mb-3">
                <div className="absolute -inset-1 rounded-full bg-rose-100 animate-ping opacity-75" />
                <div className="relative p-3 bg-rose-50 rounded-full text-rose-500 border border-rose-100 shadow-sm">
                  <ShieldAlert size={28} />
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-0.5">DND Mode Engaged</h3>
              <p className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-semibold inline-block mb-2">
                Clinical Focus Locked
              </p>
              <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed">
                Patient lists are hidden to ensure undisturbed workspace. Turn off DND above to resume patient intake.
              </p>
            </div>
          ) : (
            doctorQueue.length > 0 ? (
              doctorQueue.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className={cn(
                    "p-3 mb-2 rounded-xl border cursor-pointer transition-all duration-200",
                    selectedPatient?.id === patient.id
                      ? "border-teal-500 bg-teal-50/40 shadow-[0_4px_16px_rgba(20,184,166,0.1)]"
                      : "border-teal-100/30 bg-white/70 hover:border-teal-300 hover:bg-white"
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-slate-800 text-xs truncate">{patient.name}</h3>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-bold border whitespace-nowrap",
                      patient.status === 'In Consultation'
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse"
                        : "bg-teal-50 text-teal-700 border-teal-100/50"
                    )}>
                      {patient.status === 'In Consultation'
                        ? 'Consulting'
                        : `Waiting No. ${waitingPatients.indexOf(patient) + 1}`
                      }
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                      Token: {patient.tokenNumber}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-slate-400 flex-shrink-0" />
                      <span>{patient.timeRegistered || 'Just now'}</span>
                    </div>
                    {patient.gender && (
                      <span className="text-[9px] uppercase font-semibold tracking-wider text-slate-300">•</span>
                    )}
                    {patient.gender && (
                      <span>{patient.gender} • {patient.age} yrs</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 px-4 text-slate-400 font-medium">
                <Users className="mx-auto text-slate-300 mb-2 opacity-50" size={24} />
                <p className="text-xs">No patients waiting in queue</p>
                <p className="text-[10px] text-slate-400 mt-0.5">All set for now!</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Right Column: EMR / Workspace */}
      <div className="flex-1 glass-card rounded-2xl shadow-[0_8px_30px_rgba(13,148,136,0.03)] border border-teal-100/50 flex flex-col overflow-hidden">
        {selectedPatient ? (
          <div className="flex flex-col h-full animate-in fade-in">
            {/* Patient Header */}
            <div className="p-6 border-b border-teal-100/40 bg-teal-50/15 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-slate-800 text-glow-teal">{selectedPatient.name}</h2>
                  {(pastVisits && pastVisits.length > 0) ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-bold">Returning Patient</span>
                  ) : (
                    <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full font-bold">New Patient</span>
                  )}
                </div>
                <p className="text-slate-500">
                  Patient No: <span className="font-extrabold text-teal-600">{selectedPatient.patientNo || 'N/A'}</span> • Age: {selectedPatient.age} • Gender: {selectedPatient.gender || 'Not specified'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* ⏸️ Put on Hold (Recall Later) */}
                <button
                  type="button"
                  onClick={handlePutOnHold}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-extrabold rounded-full text-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-sm"
                  title="Put this patient back on the waiting queue to call them later"
                >
                  <Clock size={13} />
                  <span>Recall Later (Hold)</span>
                </button>

                {/* ✅ Complete & Close Check-up */}
                <button
                  type="button"
                  onClick={handleCompleteAndClose}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-full text-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-md shadow-emerald-500/10"
                  title="Complete consultation and close patient session"
                >
                  <CheckCircle size={13} />
                  <span>Complete & Close</span>
                </button>

                <span className="px-3 py-1.5 bg-teal-100 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                  <span>Consulting</span>
                </span>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left inner column: Patient Profile + Past History */}
              <div className="w-[38%] border-r border-teal-100/50 bg-slate-50/50 flex flex-col overflow-hidden">

                {/* Patient Info Card */}
                <div className="p-4 bg-gradient-to-br from-teal-50/50 to-cyan-50/50 border-b border-teal-100/40">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                      {selectedPatient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{selectedPatient.name}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        {selectedPatient.gender || 'Unknown'} • {selectedPatient.age} yrs
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <Phone size={10} className="text-teal-500 flex-shrink-0" />
                      <span className="font-mono">{selectedPatient.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <FileText size={10} className="text-teal-500 flex-shrink-0" />
                      <span className="font-medium">Token: {selectedPatient.tokenNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        type="button"
                        onClick={() => setIsHistoryModalOpen(true)}
                        className={`text-[10px] px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow ${
                          !loadingHistory && pastVisits.length > 0
                            ? 'bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10'
                            : 'bg-teal-600 border-teal-600 hover:bg-teal-700 text-white shadow-teal-500/10'
                        }`}
                      >
                        <FileText size={12} className="stroke-[2.5]" />
                        {loadingHistory ? 'Loading EMR logs...' : pastVisits.length > 0 ? `View ${pastVisits.length} Past Visit History` : 'First-time Visit'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clinical Vitals & Medical History Section (Premium visual metrics with smart status indicators) */}
                <div className="p-4 border-b border-slate-100 bg-white space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                      <Activity size={12} className="text-teal-600 animate-pulse" /> Clinical Vitals
                    </h3>
                    {selectedPatient.vitals && selectedPatient.vitals.length > 0 && (
                      <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold px-1.5 py-0.5 rounded-full uppercase">
                        Active Metrics
                      </span>
                    )}
                  </div>

                  {selectedPatient.vitals && selectedPatient.vitals.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedPatient.vitals.map((v: any) => {
                        // Smart colored thresholds for high-quality alerts
                        let alertClass = 'bg-slate-50 border-slate-200/60 text-slate-700';
                        let dotClass = 'bg-slate-400';

                        const numVal = parseFloat(v.value);

                        if (v.name === 'Temperature' && numVal > 100) {
                          alertClass = 'bg-amber-50 border-amber-200 text-amber-800';
                          dotClass = 'bg-amber-500 animate-pulse';
                        } else if (v.name === 'SpO2' && numVal < 95) {
                          alertClass = 'bg-rose-50 border-rose-200 text-rose-800';
                          dotClass = 'bg-rose-500 animate-pulse';
                        } else if (v.name === 'Blood Pressure') {
                          // e.g. 140/90
                          const systolic = parseInt(v.value.split('/')[0]);
                          if (systolic >= 140) {
                            alertClass = 'bg-rose-50 border-rose-200 text-rose-800';
                            dotClass = 'bg-rose-500 animate-pulse';
                          } else if (systolic >= 130) {
                            alertClass = 'bg-amber-50 border-amber-200 text-amber-800';
                            dotClass = 'bg-amber-500 animate-pulse';
                          } else {
                            alertClass = 'bg-emerald-50 border-emerald-100 text-emerald-800';
                            dotClass = 'bg-emerald-500';
                          }
                        } else if (v.name === 'Heart Rate') {
                          if (numVal > 100 || numVal < 60) {
                            alertClass = 'bg-amber-50 border-amber-200 text-amber-800';
                            dotClass = 'bg-amber-500 animate-pulse';
                          } else {
                            alertClass = 'bg-emerald-50 border-emerald-100 text-emerald-800';
                            dotClass = 'bg-emerald-500';
                          }
                        } else {
                          // Normal metrics
                          if (v.value.includes('bpm') || v.value.includes('%') || v.value.includes('mmHg') || v.value.includes('°F')) {
                            alertClass = 'bg-emerald-50 border-emerald-100 text-emerald-800';
                            dotClass = 'bg-emerald-500';
                          }
                        }

                        return (
                          <div key={v.name} className={`p-2.5 rounded-xl border flex flex-col justify-between font-medium ${alertClass}`}>
                            <span className="text-[9px] font-bold text-slate-400 truncate">{v.name}</span>
                            <div className="flex items-baseline justify-between mt-1">
                              <span className="text-xs font-black tracking-tight font-mono">{v.value}</span>
                              <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed text-slate-400 font-medium">
                      <p className="text-[10px]">No vitals captured during booking.</p>
                    </div>
                  )}

                  {/* Past Medical History Card */}
                  <div className="space-y-1.5 pt-1.5">
                    <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                      <FileText size={12} className="text-teal-500" /> Past Diagnoses
                    </h4>
                    {selectedPatient.pastDiagnoses ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedPatient.pastDiagnoses.split(',').map((diag: string, index: number) => (
                          <span
                            key={index}
                            className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold border ${
                              diag.toLowerCase().includes('none')
                                ? 'bg-slate-50 text-slate-500 border-slate-200'
                                : 'bg-teal-50 text-teal-700 border-teal-100/60 shadow-sm'
                            }`}
                          >
                            {diag.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No historical diagnoses logged.</p>
                    )}
                  </div>
                </div>

                {/* Past Visit History Timeline */}
                <div className="flex-1 overflow-y-auto p-3">
                  <h3 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                    <Clock size={10} /> Visit History
                  </h3>

                  {loadingHistory ? (
                    <div className="text-center py-8 text-slate-400">
                      <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span className="text-[11px]">Loading history...</span>
                    </div>
                  ) : pastVisits.length > 0 ? (
                    <div className="space-y-2">
                      {pastVisits.map((visit: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-xl border border-teal-100/50 shadow-sm p-2.5 hover:border-teal-200 hover:shadow-md transition-all duration-150">
                          {/* Visit number + status */}
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                {pastVisits.length - idx}
                              </span>
                              <span className="text-[10px] font-bold text-slate-700">{visit.date}</span>
                            </div>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border ${
                              visit.status === 'DISPENSED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : visit.status === 'COMPLETED'
                                ? 'bg-sky-50 text-sky-700 border-sky-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {visit.status}
                            </span>
                          </div>

                          {/* Doctor */}
                          <div className="flex items-center gap-1 mb-1.5">
                            <User size={9} className="text-slate-400 flex-shrink-0" />
                            <span className="text-[10px] text-slate-500 font-medium truncate">{visit.doctor}</span>
                          </div>

                          {/* Medicines */}
                          <div className="bg-slate-50 rounded p-1.5">
                            <p className="text-[10px] text-slate-600 leading-relaxed">
                              <strong className="text-slate-700">Medicines: </strong>
                              {visit.medicines}
                            </p>
                          </div>

                          {/* Token & RxCode */}
                          <div className="flex items-center justify-between mt-1.5 text-[9px] text-slate-400 font-mono">
                            {visit.tokenNumber && <span>Token: {visit.tokenNumber}</span>}
                            {visit.rxCode && <span className="text-teal-600 font-bold">Rx: {visit.rxCode}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                        <FileText size={16} className="text-slate-400" />
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500">No past visits</p>
                      <p className="text-[10px] text-slate-400">First-time patient</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right inner column: Current Prescription Pad */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
                <div className="flex border-b border-teal-100 text-xs font-bold text-slate-400">
                  <button
                    type="button"
                    onClick={() => setEntryMode('voice')}
                    className={`flex-1 pb-3 border-b-2 text-center transition-all flex items-center justify-center gap-1.5 ${
                    entryMode === 'voice' ? 'border-teal-600 text-teal-600 font-extrabold text-glow-teal' : 'border-transparent hover:text-slate-550'
                  }`}
                  >
                    <Mic size={14} className={entryMode === 'voice' ? 'text-teal-600' : ''} /> Voice Prescription (AI Speak)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode('manual')}
                    className={`flex-1 pb-3 border-b-2 text-center transition-all flex items-center justify-center gap-1.5 ${
                    entryMode === 'manual' ? 'border-teal-600 text-teal-600 font-extrabold text-glow-teal' : 'border-transparent hover:text-slate-550'
                  }`}
                  >
                    <Keyboard size={14} className={entryMode === 'manual' ? 'text-teal-600' : ''} /> Manual Smart Prescription (AI Search)
                  </button>
                </div>

                {/* Voice Entry Mode rendering */}
                {entryMode === 'voice' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Dictation Action */}
                    <div className="flex flex-col items-center justify-center p-8 bg-teal-50/15 rounded-2xl border-2 border-dashed border-teal-100/60 shadow-inner">
                      <button
                        type="button"
                        onClick={toggleDictation}
                        className={cn(
                          "w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                          isDictating
                            ? "bg-rose-500 text-white animate-pulse-fast shadow-rose-500/40 scale-110 pulse-ring"
                            : "bg-teal-600 text-white hover:bg-teal-700 hover:scale-105 shadow-teal-500/10"
                        )}
                      >
                        <Mic size={32} />
                      </button>
                      <p className="mt-4 font-medium text-slate-700">
                        {isDictating ? 'Listening... Speak now' : 'Click to Start Dictation'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Say "Prescribing Paracetamol..." to test</p>
                    </div>

                    {/* Transcript Text Box */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">AI Transcript</label>
                      <textarea
                        className="w-full h-24 p-3 rounded-xl border border-teal-100/60 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none font-medium text-slate-700 text-xs outline-none transition-all duration-200 shadow-inner"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder="Voice transcript will appear here..."
                      />
                    </div>
                  </div>
                )}

                {/* Manual Smart Autocomplete Entry Mode rendering */}
                {entryMode === 'manual' && (
                  <div className="space-y-4 animate-in fade-in duration-200 relative">
                    {/* Search Bar */}
                    <div className="relative">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Search Medicine (AI Autocomplete)
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Type medicine name (e.g. Paracetamol, Dolo, Pan-D, Amox)..."
                          value={searchQuery}
                          onChange={e => handleSearchChange(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border border-teal-100/60 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-bold text-slate-700 bg-slate-50/50 transition-all shadow-sm"
                        />
                      </div>

                      {/* Autocomplete Dropdown list */}
                      {searchQuery.trim().length > 0 && searchSuggestions.length > 0 && (
                        <div className="absolute inset-x-0 top-full mt-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto animate-in slide-in-from-top-1 duration-150">
                          {searchSuggestions.map((med: any) => (
                            <div
                              key={med.name}
                              onClick={() => handleSelectSuggestion(med)}
                              className="p-3 hover:bg-blue-50/40 cursor-pointer flex justify-between items-center text-xs font-semibold"
                            >
                              <div className="text-left">
                                <div className="text-slate-800 font-extrabold">{med.name}</div>
                                <span className="text-[9px] text-slate-400 font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-md font-mono mt-0.5 inline-block">
                                  {med.category}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-teal-600 font-bold font-mono uppercase bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                                  💡 AI Recommended
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Smart pre-filled details form */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-medium text-xs items-end">
                      <div className="space-y-1 text-left sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medicine Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Paracetamol 500mg"
                          value={manualMedicine}
                          onChange={e => setManualMedicine(e.target.value)}
                          className="w-full h-9 rounded-xl border border-teal-100/60 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dosage</label>
                        <input
                          type="text"
                          placeholder="e.g. 1-0-1 (Post meals)"
                          value={manualDosage}
                          onChange={e => {
                            const val = e.target.value;
                            if (/^\d{3}$/.test(val)) {
                              setManualDosage(val.split('').join('-'));
                            } else if (/^\d{4}$/.test(val)) {
                              setManualDosage(val.split('').join('-'));
                            } else {
                              setManualDosage(val);
                            }
                          }}
                          className="w-full h-9 rounded-xl border border-teal-100/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</label>
                        <input
                          type="text"
                          placeholder="e.g. 5 Days"
                          value={manualDuration}
                          onChange={e => setManualDuration(e.target.value)}
                          className="w-full h-9 rounded-xl border border-teal-100/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                        />
                      </div>
                      <div className="text-left w-full">
                        <button
                          type="button"
                          onClick={handleAddManualMedicine}
                          className="w-full h-9 bg-teal-600 hover:bg-teal-500 text-white font-extrabold rounded-full text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/10 hover:shadow-lg hover:shadow-teal-500/20 active:scale-95 transition-all text-glow-teal"
                        >
                          <Plus size={14} className="stroke-[3]" /> Add Medication
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Structured UI Table */}
                {prescriptions.length > 0 && (
                  <div className="space-y-2 animate-in slide-in-from-bottom-4">
                    <label className="text-sm font-medium text-slate-700">Extracted Medications</label>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 font-medium text-slate-700">Medicine</th>
                            <th className="px-4 py-3 font-medium text-slate-700">Dosage</th>
                            <th className="px-4 py-3 font-medium text-slate-700">Duration</th>
                            <th className="px-4 py-3 font-medium text-slate-700 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {prescriptions.map((p, i) => {
                            const isEditing = editingIndex === i;
                            if (isEditing) {
                              return (
                                <tr key={i} className="bg-teal-50/20 animate-in fade-in duration-150">
                                  <td className="px-4 py-2 font-medium">
                                    <input
                                      type="text"
                                      value={editMedicine}
                                      onChange={e => setEditMedicine(e.target.value)}
                                      className="w-full h-8 rounded-xl border border-teal-100/60 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-slate-600 font-medium">
                                    <input
                                      type="text"
                                      value={editDosage}
                                      onChange={e => {
                                        const val = e.target.value;
                                        if (/^\d{3}$/.test(val)) {
                                          setEditDosage(val.split('').join('-'));
                                        } else if (/^\d{4}$/.test(val)) {
                                          setEditDosage(val.split('').join('-'));
                                        } else {
                                          setEditDosage(val);
                                        }
                                      }}
                                      className="w-full h-8 rounded-xl border border-teal-100/60 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-slate-600 font-mono">
                                    <input
                                      type="text"
                                      value={editDuration}
                                      onChange={e => setEditDuration(e.target.value)}
                                      className="w-full h-8 rounded-xl border border-teal-100/60 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <div className="flex gap-1 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEdit(i)}
                                        title="Save Changes"
                                        className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-full hover:bg-emerald-50 transition-colors"
                                      >
                                        <CheckCircle size={14} className="stroke-[2.5]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingIndex(null)}
                                        title="Cancel"
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={i} className="bg-white hover:bg-slate-50/40 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-800">{p.medicine}</td>
                                <td className="px-4 py-3 text-slate-600 font-medium">{p.dosage}</td>
                                <td className="px-4 py-3 text-slate-600 font-mono">{p.duration}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(i, p)}
                                      title="Edit medication details"
                                      className="text-slate-400 hover:text-teal-600 p-1.5 rounded-full hover:bg-teal-50 transition-colors"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPrescriptions(prev => prev.filter((_, idx) => idx !== i))}
                                      title="Remove medication"
                                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-full hover:bg-rose-50 transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
              <Button size="lg" className="flex items-center gap-2" onClick={saveAndSend} disabled={prescriptions.length === 0}>
                <CheckCircle size={20} /> Save & Send to Pharmacy
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 p-8">
            <p>Select a patient from the waiting room to begin.</p>
          </div>
        )}
      </div>
      {/* Patient Medical History & Timeline Modal */}
      {selectedPatient && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`Complete Medical History: ${selectedPatient.name}`}
          className="max-w-xl md:max-w-2xl bg-white rounded-2xl text-left"
        >
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Patient summary header */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50/50 p-4 rounded-xl border border-teal-100/50 flex items-center justify-between shadow-sm">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-slate-800">{selectedPatient.name}</h3>
                <p className="text-[10px] text-slate-500 font-bold font-mono">
                  Phone: {selectedPatient.phone} • Age/Gender: {selectedPatient.age} Yrs / {selectedPatient.gender || 'Not specified'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Visits Captured</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {pastVisits.length} Records Found
                </span>
              </div>
            </div>

            {/* Historical timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-teal-600" /> Longitudinal Visit Timeline
              </h4>

              {loadingHistory ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs font-semibold">Loading EMR logs...</span>
                </div>
              ) : pastVisits.length > 0 ? (
                <div className="relative border-l border-teal-200 pl-5 ml-2.5 space-y-5 text-left">
                  {pastVisits.map((visit: any, index: number) => (
                    <div key={index} className="relative animate-in slide-in-from-left-2 duration-150">
                      {/* Timeline bullet */}
                      <div className="absolute -left-[26px] top-1.5 h-3.5 w-3.5 rounded-full bg-teal-600 border-2 border-white flex items-center justify-center text-white font-mono text-[7px] font-bold shadow-sm shadow-teal-500/20">
                        {pastVisits.length - index}
                      </div>

                      <div className="bg-slate-50 border border-teal-200/50 rounded-xl p-3.5 space-y-2 hover:border-teal-200/80 hover:bg-slate-50/80 hover:shadow-sm transition-all duration-200">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-xs text-slate-800 font-sans">Physician: {visit.doctor}</span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">{visit.date}</span>
                        </div>

                        {/* Prescribed medicines box */}
                        <div className="bg-white rounded-lg border border-slate-100 p-2.5 shadow-inner">
                          <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                            <strong className="text-slate-800 font-extrabold">Medication Plan: </strong>
                            {visit.medicines}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-slate-400">
                          {visit.tokenNumber && <span>Queue Token: {visit.tokenNumber}</span>}
                          {visit.rxCode && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 border border-teal-100/60 font-bold font-mono">
                              Rx: {visit.rxCode}
                            </span>
                          )}
                          <span className={`inline-flex px-1.5 py-0.2 rounded text-[8px] font-bold border uppercase ${
                            visit.status === 'DISPENSED' || visit.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {visit.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <FileText size={28} className="text-slate-300 mb-2.5" />
                  <p className="text-xs font-bold text-slate-500">First-Time Patient Profile</p>
                  <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mt-0.5">
                    This patient is newly registered today. No historical clinical timelines or prescriptions were found in active EMR logs.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-full text-xs font-bold hover:bg-slate-700 shadow-md shadow-slate-900/10 transition-colors w-full sm:w-auto"
              >
                Done & Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
