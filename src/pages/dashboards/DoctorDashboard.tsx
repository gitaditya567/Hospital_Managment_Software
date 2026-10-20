import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Mic, CheckCircle, Clock, Users, UserCheck, Eye, EyeOff, ShieldAlert, FileText, Phone, User, Activity, Search, Keyboard, Trash2, Edit, X, Plus, Maximize2, Minimize2, Printer, BarChart3, Calendar, CalendarDays } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { getPrintSettings, getHospitalDisplayName } from '../../utils/printSettings';
import { DataNavigationToolbar, INITIAL_FILTER_STATE, applyDataFilters } from '../../components/common/DataNavigationToolbar';
import type { FilterState } from '../../components/common/DataNavigationToolbar';
import { doctorTitle } from '../../lib/utils';

export function DoctorDashboard() {
  const { user } = useAuthStore();
  const { patients, invoices, updatePatientStatus, fetchHospitalData } = useHospitalStore();

  const [activeTab, setActiveTab] = useState<'CONSULTATION' | 'OVERVIEW'>('CONSULTATION');
  const [overviewSelectedDate, setOverviewSelectedDate] = useState(new Date().toDateString());
  const [overviewSearchQuery, setOverviewSearchQuery] = useState('');

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);

  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isDndMode, setIsDndMode] = useState(false);
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Fullscreen Workspace State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (workspaceRef.current?.requestFullscreen) {
        workspaceRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Advanced Medical Entity AI Voice Parser
  const parseTranscriptText = (text: string) => {
    if (!text || !text.trim()) return;
    const lowerText = text.toLowerCase();

    // Comprehensive Medicine Mapping Dictionary
    const MEDICINE_DICTIONARY: Array<{
      keywords: string[];
      medName: string;
      defaultDosage: string;
      defaultDuration: string;
    }> = [
      { keywords: ['paracetamol 650', 'dolo 650', 'dolo'], medName: 'Paracetamol 650mg (Dolo)', defaultDosage: '1-1-1 (Post meals)', defaultDuration: '3 Days' },
      { keywords: ['paracetamol 500', 'paracetamol', 'crocin', 'calpol', 'fever tab'], medName: 'Paracetamol 500mg', defaultDosage: '1-0-1 (Post meals)', defaultDuration: '3 Days' },
      { keywords: ['amoxicillin 500', 'amox 500', 'mox 500'], medName: 'Amoxicillin 500mg', defaultDosage: '1-0-1', defaultDuration: '5 Days' },
      { keywords: ['amoxicillin 250', 'amoxicillin', 'amox'], medName: 'Amoxicillin 250mg', defaultDosage: '1-0-1', defaultDuration: '5 Days' },
      { keywords: ['ibuprofen', 'brufen', 'painkiller'], medName: 'Ibuprofen 400mg', defaultDosage: '1-0-1 (Post meals)', defaultDuration: '3 Days' },
      { keywords: ['pantoprazole', 'pan d', 'pan-d', 'pan 40', 'pantocid', 'gas medicine'], medName: 'Pantoprazole 40mg (Pan-D)', defaultDosage: '1-0-0 (Empty stomach)', defaultDuration: '10 Days' },
      { keywords: ['cetirizine', 'cetzine', 'okacet', 'allergy tab'], medName: 'Cetirizine 10mg', defaultDosage: '0-0-1 (Night)', defaultDuration: '5 Days' },
      { keywords: ['azithromycin', 'azithral', 'azi 500'], medName: 'Azithromycin 500mg', defaultDosage: '1-0-0', defaultDuration: '3 Days' },
      { keywords: ['montelukast', 'montair', 'montair-lc'], medName: 'Montelukast 10mg', defaultDosage: '0-0-1 (Night)', defaultDuration: '15 Days' },
      { keywords: ['metformin', 'glycomet', 'sugar tab'], medName: 'Metformin 500mg', defaultDosage: '0-1-0 (Pre meals)', defaultDuration: '30 Days' },
      { keywords: ['amlodipine', 'amlong', 'bp tab'], medName: 'Amlodipine 5mg', defaultDosage: '1-0-0 (Morning)', defaultDuration: '30 Days' },
      { keywords: ['loperamide', 'imodium', 'loose motion'], medName: 'Loperamide 2mg', defaultDosage: '1-0-1', defaultDuration: '2 Days' }
    ];

    const extractDosage = (phrase: string, fallback: string) => {
      if (phrase.includes('once a day') || phrase.includes('once daily') || phrase.includes('ek baar')) return '1-0-0';
      if (phrase.includes('twice a day') || phrase.includes('twice daily') || phrase.includes('do baar') || phrase.includes('subah shaam')) return '1-0-1 (Twice a day)';
      if (phrase.includes('thrice a day') || phrase.includes('three times') || phrase.includes('tin baar')) return '1-1-1 (Thrice a day)';
      if (phrase.includes('four times')) return '1-1-1-1';
      return fallback;
    };

    const extractDuration = (phrase: string, fallback: string) => {
      const matchDays = phrase.match(/(\d+)\s*(day|days|din)/);
      if (matchDays) return `${matchDays[1]} Days`;
      const matchMonth = phrase.match(/(\d+)\s*(month|months|mahine)/);
      if (matchMonth) return `${matchMonth[1]} Months`;
      return fallback;
    };

    MEDICINE_DICTIONARY.forEach(entry => {
      const matchedKeyword = entry.keywords.find(kw => lowerText.includes(kw));
      if (matchedKeyword) {
        setPrescriptions(prev => {
          if (!prev.some(p => p.medicine.toLowerCase() === entry.medName.toLowerCase())) {
            const dosage = extractDosage(lowerText, entry.defaultDosage);
            const duration = extractDuration(lowerText, entry.defaultDuration);
            return [...prev, {
              medicine: entry.medName,
              dosage,
              duration
            }];
          }
          return prev;
        });
      }
    });
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Multi-language Indian English & Hinglish support

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        const cleaned = currentTranscript.trim();
        setTranscript(cleaned);
        parseTranscriptText(cleaned);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== 'no-speech') {
          setIsDictating(false);
        }
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleDictation = () => {
    if (isDictating) {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.error("Error stopping dictation:", err);
      }
      setIsDictating(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsDictating(true);
      } catch (err) {
        console.error("Could not start dictation:", err);
        setIsDictating(false);
      }
    }
  };

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
  const matchDoctorName = (pDoctor?: string, uName?: string) => {
    if (!uName || !pDoctor) return true;
    const uClean = uName.toLowerCase().replace(/dr\.?/g, '').trim();
    const pClean = pDoctor.toLowerCase().replace(/dr\.?/g, '').trim();
    
    if (uClean === 'doctor' || uClean === 'practitioner' || uClean === 'general opd' || !uClean) {
      return true;
    }
    
    const uFirstName = uClean.split(' ')[0];
    const pFirstName = pClean.split(' ')[0];

    return pClean.includes(uClean) || 
           uClean.includes(pClean) || 
           pClean.includes(uFirstName) || 
           uClean.includes(pFirstName);
  };

  const todayStr = new Date().toDateString();

  const parseToDateString = (dateVal: any) => {
    if (!dateVal) return todayStr;
    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split('-').map(Number);
        return new Date(y, m - 1, d).toDateString();
      }
      if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(clean)) {
        const [d, m, y] = clean.split(/[-/]/).map(Number);
        return new Date(y, m - 1, d).toDateString();
      }
    }
    const dObj = new Date(dateVal);
    return !isNaN(dObj.getTime()) ? dObj.toDateString() : todayStr;
  };

  const getStoredApptDate = (phone?: string, name?: string) => {
    if (!phone || !name) return '';
    try {
      const key = `appt_date_${phone.trim()}_${name.trim()}`.toLowerCase();
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  };

  const getPatientApptDateStr = (p: any) => {
    if (!p) return todayStr;
    if (p.appointmentDate && p.appointmentDate.trim() !== '') return parseToDateString(p.appointmentDate);
    const savedDate = getStoredApptDate(p.phone, p.name);
    if (savedDate) return parseToDateString(savedDate);
    if (p.createdAt) return parseToDateString(p.createdAt);
    return todayStr;
  };

  // Filter patients allotted to this doctor who are either waiting or currently in consultation.
  // Strictly sort by FIFO (First-In, First-Out): In Consultation patient first, then waiting patients ordered by createdAt timestamp ascending.
  const doctorQueue = patients
    .filter(p =>
      matchDoctorName(p.doctorName, user?.name) &&
      (p.status === 'Waiting' || p.status === 'In Consultation') &&
      (getPatientApptDateStr(p) === todayStr || p.status === 'In Consultation')
    )
    .sort((a, b) => {
      if (a.status === 'In Consultation') return -1;
      if (b.status === 'In Consultation') return 1;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });

  const filteredDoctorQueue = applyDataFilters(doctorQueue, filters);
  const totalWaitingCount = doctorQueue.length;
  const filteredWaitingCount = filteredDoctorQueue.length;
  const checkedTodayCount = patients.filter(p =>
    matchDoctorName(p.doctorName, user?.name) &&
    p.status === 'Completed'
  ).length;

  // Overview Tab Calculations
  const rawDoctorPatients = patients.filter(p => matchDoctorName(p.doctorName, user?.name));
  const doctorPatients = rawDoctorPatients.filter((p, index, self) => 
    index === self.findIndex(t => 
      t.id === p.id || 
      (t.phone === p.phone && t.name === p.name && getPatientApptDateStr(t) === getPatientApptDateStr(p) && (t.appointmentTime || '') === (p.appointmentTime || ''))
    )
  );

  // Today's Consulted Patients ("Aaj Kin Kin Ko Dekha")
  const consultedTodayList = doctorPatients.filter(p => 
    p.status === 'Completed' && 
    (p.createdAt ? new Date(p.createdAt).toDateString() === todayStr : true)
  );
  const consultedTodayCount = consultedTodayList.length;

  // Pending Patients in Live Queue
  const pendingWaitingCount = doctorPatients.filter(p => p.status === 'Waiting' || p.status === 'In Consultation').length;

  // Auto-select and real-time live sync for selected patient details (vitals, pastDiagnoses, status)
  useEffect(() => {
    if (isDndMode) return;

    if (selectedPatient) {
      const updated = patients.find(p => p.id === selectedPatient.id);
      if (updated) {
        if (
          updated.pastDiagnoses !== selectedPatient.pastDiagnoses ||
          updated.status !== selectedPatient.status ||
          JSON.stringify(updated.vitals) !== JSON.stringify(selectedPatient.vitals)
        ) {
          setSelectedPatient(updated);
        }
      }
    } else {
      const activeConsult = doctorQueue.find(p => p.status === 'In Consultation');
      if (activeConsult) {
        setSelectedPatient(activeConsult);
      } else if (doctorQueue.length > 0) {
        setSelectedPatient(doctorQueue[0]);
      }
    }
  }, [patients, selectedPatient, isDndMode]);

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

  // Print Prescription Slip
  const handlePrintPrescription = (patientObj?: any, customRxCode?: string, medList?: any[]) => {
    const pat = patientObj || selectedPatient;
    if (!pat) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const settings = getPrintSettings();
    const rxRef = customRxCode || `RX-${Math.floor(1000 + Math.random() * 9000)}`;
    const itemsToPrint = medList && medList.length > 0 ? medList : prescriptions;

    const medicinesHtml = itemsToPrint.map((med: any) => {
      const medName = med.medicine || med.name || (typeof med === 'string' ? med : 'Medication');
      const dosage = med.dosage || '1-0-1';
      const duration = med.duration || '5 Days';
      const qty = med.qty || 10;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: bold; color: #1e293b; text-align: left;">${medName}</td>
          <td style="padding: 10px; text-align: center; font-family: monospace; font-weight: 700; color: ${settings.accentColor}; background-color: #f8fafc; border-radius: 6px;">${dosage}</td>
          <td style="padding: 10px; text-align: center; color: #64748b; font-weight: 500;">${duration}</td>
          <td style="padding: 10px; text-align: center; font-family: monospace; font-weight: bold; color: #334155;">${qty}</td>
        </tr>
      `;
    }).join('');

    const headerBlock = settings.showHeader
      ? `<div class="header">
          <div class="clinic-details">
            <h1>${getHospitalDisplayName()}</h1>
            <p>State-of-the-Art Digital EMR Clinical Prescription</p>
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
          <title>Prescription Slip - ${rxRef}</title>
          <style>
            @page { size: A4 portrait; margin: ${settings.margin}mm; }
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: ${settings.padding * 2}px; color: #334155; line-height: 1.5; font-size: ${settings.fontSize}px; }
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
          </style>
        </head>
        <body>
          ${headerBlock}
          <div class="meta-grid">
            <div class="meta-item">
              <p><strong>Patient Name:</strong> ${pat.name}</p>
              <p><strong>Age / Gender:</strong> ${pat.age} Yrs / ${pat.gender || 'Not specified'}</p>
              <p><strong>Contact Phone:</strong> ${pat.phone}</p>
            </div>
            <div class="meta-item" style="text-align: right;">
              <p><strong>Prescription Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <p><strong>Consulting Doctor:</strong> ${doctorTitle(user?.name, 'Practitioner')}</p>
              <p><strong>Rx Code Reference:</strong> <span style="font-family: monospace; font-weight: 800; color: ${settings.accentColor};">${rxRef}</span></p>
            </div>
          </div>
          <h3 style="font-size: 14px; font-weight: 850; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; border-left: 4px solid ${settings.accentColor}; padding-left: 8px;">Prescribed Medications</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align: left; padding-left: 10px;">Medicine Name</th>
                <th style="width: 130px;">Dosage</th>
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
              <p style="margin: 4px 0 0 0; font-size: 12px; text-align: center; color: #475569; font-weight: 700;">${doctorTitle(user?.name, 'Doctor')}</p>
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

  // Upcoming 15 Days Date Generator for Agenda Overview
  const generateNext15Days = () => {
    const dates = [];
    const base = new Date();
    base.setHours(0,0,0,0);
    for (let i = 0; i < 15; i++) {
      const d = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toDateString();
      const isToday = i === 0;
      const count = doctorPatients.filter(p => {
        return getPatientApptDateStr(p) === dateStr;
      }).length;
      dates.push({ dateStr, count, isToday, rawDate: d });
    }
    return dates;
  };

  const upcomingDatesList = generateNext15Days();

  // Patients for selected date in Overview tab
  const patientsForOverviewSelectedDate = doctorPatients.filter(p => {
    const pDateStr = getPatientApptDateStr(p);
    const matchesDate = pDateStr === overviewSelectedDate;
    const matchesSearch = !overviewSearchQuery || 
      p.name.toLowerCase().includes(overviewSearchQuery.toLowerCase()) ||
      (p.patientNo && p.patientNo.toLowerCase().includes(overviewSearchQuery.toLowerCase())) ||
      (p.phone && p.phone.includes(overviewSearchQuery));
    return matchesDate && matchesSearch;
  });

  const overviewDateCount = doctorPatients.filter(p => {
    return getPatientApptDateStr(p) === overviewSelectedDate;
  }).length;

  return (
    <div className="space-y-4 font-sans">
      {/* Top Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white p-2 rounded-2xl border border-teal-100/60 shadow-xs gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('CONSULTATION')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeTab === 'CONSULTATION'
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                : "text-slate-600 hover:bg-teal-50 hover:text-teal-700"
            )}
          >
            <Activity size={15} /> Live Consultation Workstation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative",
              activeTab === 'OVERVIEW'
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                : "text-slate-600 hover:bg-teal-50 hover:text-teal-700"
            )}
          >
            <BarChart3 size={15} /> Patient Analytics &amp; Schedule Overview
            {consultedTodayCount > 0 && (
              <span className="ml-1 bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {consultedTodayCount} Consulted Today
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 px-3">
          <span className="text-xs font-extrabold text-slate-800">{doctorTitle(user?.name, 'Practitioner')}</span>
          <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
            {(user as any)?.department || 'General OPD'}
          </span>
        </div>
      </div>

      {activeTab === 'CONSULTATION' ? (
        <div className="space-y-4">
          {/* Interactive Data Navigation & Filter Toolbar */}
          <DataNavigationToolbar
            filters={filters}
            onFilterChange={setFilters}
            totalRecordsCount={totalWaitingCount}
            filteredCount={filteredWaitingCount}
            title="Doctor Consultation Control & Data Filters"
            subtitle="Filter waiting queue and historical visit records by Date Range, Patient Type, and Status"
          />

          <div className="flex h-[calc(100vh-14rem)] gap-6">
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
                <p className="text-sm font-bold text-slate-800">{filteredWaitingCount}</p>
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
                <h3 className="font-extrabold text-slate-800 text-sm">Doctor Consultation Paused</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-xs leading-relaxed">
                  Do Not Disturb mode active. OPD Queue updates are temporarily paused.
                </p>
              </div>
            ) : (
              filteredDoctorQueue.length > 0 ? (
                filteredDoctorQueue.map((patient) => (
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
                        : `Pos #${doctorQueue.indexOf(patient)} (${doctorQueue.indexOf(patient) === 1 ? 'Next' : 'Waiting'})`
                      }
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                    <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold font-mono whitespace-nowrap">
                      {patient.patientNo || 'PAT-1001'}
                    </span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                      Token: {patient.tokenNumber}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-slate-400 flex-shrink-0" />
                      <span>{patient.appointmentTime || patient.timeRegistered || 'Just now'}</span>
                    </div>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-md font-extrabold border ml-auto",
                      patient.paymentStatus === 'Paid'
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      {patient.paymentStatus === 'Paid' ? 'Paid ✓' : 'Fee Pending ⏳'}
                    </span>
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
      <div 
        ref={workspaceRef}
        className={cn(
          "flex-1 glass-card rounded-2xl shadow-[0_8px_30px_rgba(13,148,136,0.03)] border border-teal-100/50 flex flex-col overflow-hidden transition-all duration-300",
          isFullscreen && "fixed inset-0 z-[9999] rounded-none p-6 bg-slate-900/95 backdrop-blur-2xl w-screen h-screen"
        )}
      >
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
                {/* 🖥️ Full Screen Toggle Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-extrabold rounded-full text-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-sm"
                  title={isFullscreen ? "Exit Full Screen Mode" : "Enter Full Screen Mode"}
                >
                  {isFullscreen ? <Minimize2 size={13} className="text-teal-600" /> : <Maximize2 size={13} className="text-teal-600" />}
                  <span>{isFullscreen ? "Exit Full Screen" : "Full Screen"}</span>
                </button>

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

                          {/* Token & RxCode & Print */}
                          <div className="flex items-center justify-between mt-1.5 text-[9px] text-slate-400 font-mono">
                            {visit.rxCode ? <span className="text-teal-600 font-bold">Rx: {visit.rxCode}</span> : <span>Token: {visit.tokenNumber || 'N/A'}</span>}
                            <button
                              type="button"
                              onClick={() => handlePrintPrescription(selectedPatient, visit.rxCode, typeof visit.medicines === 'string' ? [{ name: visit.medicines }] : visit.medicines)}
                              className="text-teal-600 hover:text-teal-800 font-bold flex items-center gap-0.5 hover:underline font-sans"
                            >
                              <Printer size={10} /> Print Rx
                            </button>
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
                    <Mic size={14} className={entryMode === 'voice' ? 'text-teal-600' : ''} /> Voice Prescription
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode('manual')}
                    className={`flex-1 pb-3 border-b-2 text-center transition-all flex items-center justify-center gap-1.5 ${
                    entryMode === 'manual' ? 'border-teal-600 text-teal-600 font-extrabold text-glow-teal' : 'border-transparent hover:text-slate-550'
                  }`}
                  >
                    <Keyboard size={14} className={entryMode === 'manual' ? 'text-teal-600' : ''} /> Manual Prescription Search
                  </button>
                </div>

                {/* Voice Entry Mode rendering */}
                {entryMode === 'voice' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Dictation Action */}
                    <div className="flex flex-col items-center justify-center p-6 bg-teal-50/15 rounded-2xl border-2 border-dashed border-teal-100/60 shadow-inner">
                      <button
                        type="button"
                        onClick={toggleDictation}
                        className={cn(
                          "w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                          isDictating
                            ? "bg-rose-500 text-white animate-pulse shadow-rose-500/40 scale-110 ring-4 ring-rose-300"
                            : "bg-teal-600 text-white hover:bg-teal-700 hover:scale-105 shadow-teal-500/20"
                        )}
                      >
                        <Mic size={32} />
                      </button>
                      <p className="mt-4 font-bold text-slate-800 text-xs">
                        {isDictating ? '🎙️ Listening... Speak prescription clearly' : 'Click Mic to Start Voice Dictation'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Supports English, Hinglish, & Multi-Medicine Clinical Terms</p>
                    </div>

                    {/* Quick Sample Voice Prompts */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Quick Voice Prompts (Click to Test)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Prescribe Dolo 650 twice a day for 5 days",
                          "Give Pan-D once daily for 10 days",
                          "Cetirizine 10mg at night for 5 days",
                          "Amoxicillin 500mg twice a day for 5 days"
                        ].map((promptText, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => {
                              setTranscript(promptText);
                              parseTranscriptText(promptText);
                            }}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 text-teal-800 rounded-lg text-[10px] font-semibold transition-all hover:scale-105"
                          >
                            ⚡ "{promptText}"
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Transcript Text Box & Action */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">Speech Transcript</label>
                        {transcript && (
                          <button
                            type="button"
                            onClick={() => setTranscript('')}
                            className="text-[10px] font-bold text-slate-400 hover:text-rose-500"
                          >
                            Clear Transcript
                          </button>
                        )}
                      </div>
                      <textarea
                        className="w-full h-24 p-3 rounded-xl border border-teal-100/60 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none font-medium text-slate-700 text-xs outline-none transition-all duration-200 shadow-inner"
                        value={transcript}
                        onChange={(e) => {
                          setTranscript(e.target.value);
                          parseTranscriptText(e.target.value);
                        }}
                        placeholder="Spoken words will appear here automatically..."
                      />
                      <Button
                        type="button"
                        onClick={() => parseTranscriptText(transcript)}
                        disabled={!transcript.trim()}
                        className="w-full h-9 text-xs font-bold gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                      >
                        <Mic size={13} /> Extract & Add Prescriptions from Voice Text
                      </Button>
                    </div>
                  </div>
                )}

                {/* Manual Smart Autocomplete Entry Mode rendering */}
                {entryMode === 'manual' && (
                  <div className="space-y-4 animate-in fade-in duration-200 relative">
                    {/* Search Bar */}
                    <div className="relative">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Search Medicine (Quick Autocomplete)
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
                                  💡 Verified Medicine
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
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex items-center gap-2 border-teal-200 text-teal-700 hover:bg-teal-50"
                onClick={() => handlePrintPrescription(selectedPatient)}
                disabled={prescriptions.length === 0}
              >
                <Printer size={18} /> Print Rx Slip
              </Button>

              <Button
                type="button"
                size="lg"
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={saveAndSend}
                disabled={prescriptions.length === 0}
              >
                <CheckCircle size={18} /> Save & Send to Pharmacy
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 p-8">
            <p>Select a patient from the waiting room to begin.</p>
          </div>
        )}
      </div>
    </div>
  </div>
  ) : (
        /* OVERVIEW TAB CONTENT */
        <div className="space-y-6 animate-in fade-in duration-200 pb-16">
          {/* Header & Search */}
          <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 p-6 rounded-2xl shadow-lg border border-teal-400/30 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-teal-200">Doctor Patient Registry &amp; Analytics</span>
              <h2 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
                <Users size={22} className="text-teal-200" /> Patient Overview &amp; Appointment Schedule
              </h2>
              <p className="text-xs text-teal-100 mt-0.5">
                Complete log of patients consulted today, date-wise appointment schedule, and pending queue
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full md:w-72">
              <Search size={14} className="absolute left-3 top-3 text-teal-300" />
              <input
                type="text"
                placeholder="Search patient name, PAT-No, phone..."
                value={overviewSearchQuery}
                onChange={e => setOverviewSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-xs text-white placeholder-teal-100 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
          </div>

          {/* Top KPI Cards (Consulted Today, Pending Queue, Future Booked) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-teal-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consulted Today</p>
                <h3 className="text-2xl font-black text-emerald-700 mt-0.5">{consultedTodayCount} Patients</h3>
                <p className="text-[10px] text-emerald-600 font-bold">Consultation completed ✓</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-200">
                <UserCheck size={22} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-teal-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Live Queue</p>
                <h3 className="text-2xl font-black text-amber-600 mt-0.5">{pendingWaitingCount} Patients</h3>
                <p className="text-[10px] text-amber-600 font-bold">Waiting in OPD room</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold border border-amber-200">
                <Clock size={22} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-teal-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Booked on Date</p>
                <h3 className="text-2xl font-black text-[#3683F8] mt-0.5">{overviewDateCount} Patients</h3>
                <p className="text-[10px] text-blue-600 font-bold truncate max-w-[150px]">{overviewSelectedDate}</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-[#EBF3FE] text-[#3683F8] flex items-center justify-center font-bold border border-blue-200">
                <CalendarDays size={22} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-teal-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Patient Records</p>
                <h3 className="text-2xl font-black text-slate-800 mt-0.5">{doctorPatients.length} Patients</h3>
                <p className="text-[10px] text-slate-500 font-bold">Lifetime directory</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold border border-slate-200">
                <Users size={22} />
              </div>
            </div>
          </div>

          {/* Section 1: Today's Consulted Patient Directory */}
          <div className="bg-white rounded-2xl border border-teal-100 shadow-xs p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-teal-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-600" />
                  Today's Consulted Patient Directory ({new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })})
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Complete record of patients consulted by you today</p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black">
                {consultedTodayCount} Consulted Today
              </span>
            </div>

            {consultedTodayList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {consultedTodayList.map(pat => (
                  <div key={pat.id} className="p-3.5 bg-emerald-50/20 border border-emerald-100 rounded-xl space-y-2 hover:border-emerald-300 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                          {pat.name}
                          <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-mono font-bold">
                            {pat.patientNo || 'PAT-1001'}
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {pat.age} Yrs / {pat.gender || 'Male'} • Phone: <span className="font-mono">{pat.phone}</span>
                        </p>
                      </div>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                        <CheckCircle size={10} /> Consulted
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-emerald-100/60 font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-slate-400" />
                        Time: {pat.timeRegistered || 'Today'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedPatient(pat);
                          setActiveTab('CONSULTATION');
                        }}
                        className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all"
                      >
                        <FileText size={10} /> View Prescription / EMR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs font-semibold space-y-1">
                <UserCheck size={28} className="mx-auto text-slate-300 opacity-60" />
                <p>No patients consulted yet today.</p>
              </div>
            )}
          </div>

          {/* Section 2: 15-Day Appointment Agenda Schedule */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Date Picker Agenda Card */}
            <div className="bg-white rounded-2xl p-5 border border-teal-100 shadow-xs space-y-3">
              <div className="border-b border-teal-100 pb-2">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                  <CalendarDays size={16} className="text-teal-600" /> 15-Day Appointment Agenda Schedule
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold">Click any date to view scheduled appointments</p>
              </div>

              {/* Upcoming 15 Days List */}
              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                {upcomingDatesList.map(({ dateStr, count, isToday }) => {
                  const isSelected = overviewSelectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setOverviewSelectedDate(dateStr)}
                      className={cn(
                        "w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all text-xs font-bold",
                        isSelected
                          ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                          : isToday
                          ? "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100/50"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Calendar size={13} className={isSelected ? "text-white" : "text-teal-600"} />
                        {dateStr} {isToday && "(Today)"}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black",
                        isSelected
                          ? "bg-white text-teal-800"
                          : count > 0
                          ? "bg-teal-100 text-teal-800 border border-teal-200"
                          : "bg-slate-100 text-slate-500"
                      )}>
                        {count} Patients
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Detailed Schedule List for Selected Date */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-teal-100 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-teal-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Appointments Scheduled for {overviewSelectedDate}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">List of patients assigned for this date</p>
                </div>
                <span className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-extrabold">
                  {patientsForOverviewSelectedDate.length} Patients Scheduled
                </span>
              </div>

              <div className="divide-y divide-slate-100 overflow-hidden">
                {patientsForOverviewSelectedDate.map(pat => {
                  const pInv = invoices.find(i => i.patientName === pat.name || i.patientPhone === pat.phone);
                  const isPaid = pat.paymentStatus === 'Paid' || pInv?.status === 'Paid';

                  return (
                    <div key={pat.id} className="py-3 flex items-center justify-between hover:bg-teal-50/20 px-2 rounded-xl transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-800">{pat.name}</span>
                          <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-mono font-bold">
                            {pat.patientNo || 'PAT-1001'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">({pat.age} Yrs / {pat.gender || 'Male'})</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-semibold">
                          <span className="flex items-center gap-1"><Clock size={11} className="text-teal-600" /> Slot: {pat.appointmentTime || 'OPD Walk-In'}</span>
                          <span className="text-slate-400 font-mono">Phone: {pat.phone}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border",
                          pat.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          pat.status === 'In Consultation' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-teal-50 text-teal-700 border-teal-200"
                        )}>
                          {pat.status}
                        </span>

                        {/* Payment Status Badge */}
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border",
                          isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                        )}>
                          {isPaid ? 'Paid ✓' : 'Fee Pending ⏳'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {patientsForOverviewSelectedDate.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs font-semibold space-y-1">
                    <CalendarDays size={28} className="mx-auto text-slate-300 opacity-60" />
                    <p>No appointments scheduled for {overviewSelectedDate}.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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

            <div className="flex justify-between items-center pt-2 border-t border-slate-100 gap-2">
              <button
                onClick={() => {
                  const hospitalTitle = getHospitalDisplayName();
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) return;

                  const visitsHtml = (pastVisits || []).map((v: any, idx: number) => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #cbd5e1;">${idx + 1}</td>
                      <td style="padding: 8px; border: 1px solid #cbd5e1;">${v.date}</td>
                      <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${v.doctor}</b></td>
                      <td style="padding: 8px; border: 1px solid #cbd5e1;">${v.medicines}</td>
                      <td style="padding: 8px; border: 1px solid #cbd5e1;">${v.status || 'COMPLETED'}</td>
                    </tr>
                  `).join('');

                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Clinical History - ${selectedPatient.name}</title>
                        <style>
                          body { font-family: sans-serif; padding: 25px; color: #1e293b; }
                          h1 { font-size: 22px; color: #0d9488; margin: 0; }
                          .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                          th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
                        </style>
                      </head>
                      <body>
                        <h1>${hospitalTitle} - Longitudinal Patient EMR Summary</h1>
                        <p style="font-size: 12px; color: #64748b; margin-top: 2px;">Printed by ${doctorTitle(user?.name, 'Doctor')}</p>
                        <div class="box">
                          <div><b>Patient Name:</b> ${selectedPatient.name}</div>
                          <div><b>Patient UID:</b> ${selectedPatient.patientNo || selectedPatient.id}</div>
                          <div><b>Phone:</b> ${selectedPatient.phone}</div>
                          <div><b>Age / Gender:</b> ${selectedPatient.age} Yrs / ${selectedPatient.gender || 'N/A'}</div>
                        </div>
                        <h3>EMR Clinical Visit History</h3>
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Date</th>
                              <th>Doctor</th>
                              <th>Medication Plan</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${visitsHtml || '<tr><td colSpan="5">No prior visit records available.</td></tr>'}
                          </tbody>
                        </table>
                        <script>window.onload = function() { window.print(); }</script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Printer size={14} /> Print Patient Record
              </button>

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
