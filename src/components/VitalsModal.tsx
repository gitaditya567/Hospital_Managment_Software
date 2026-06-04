import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { 
  Heart, Activity, Thermometer, Wind, Scale, 
  Droplet, Gauge, ClipboardList, Check 
} from 'lucide-react';

interface VitalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vitals: Array<{ name: string; value: string }>, pastDiagnoses: string) => void;
  initialVitals?: Array<{ name: string; value: string }>;
  initialPastDiagnoses?: string;
}

interface VitalMeta {
  name: string;
  label: string;
  unit: string;
  placeholder: string;
  icon: React.ComponentType<any>;
  defaultChecked: boolean;
}

const COMMON_VITALS: VitalMeta[] = [
  { name: 'Blood Pressure', label: 'Blood Pressure', unit: 'mmHg', placeholder: 'e.g. 120/80', icon: Activity, defaultChecked: true },
  { name: 'Heart Rate', label: 'Heart Rate (Pulse)', unit: 'bpm', placeholder: 'e.g. 72', icon: Heart, defaultChecked: true },
  { name: 'Temperature', label: 'Body Temperature', unit: '°F', placeholder: 'e.g. 98.6', icon: Thermometer, defaultChecked: true },
  { name: 'SpO2', label: 'SpO2 (Oxygen Saturation)', unit: '%', placeholder: 'e.g. 98', icon: Wind, defaultChecked: false },
  { name: 'Weight', label: 'Body Weight', unit: 'kg', placeholder: 'e.g. 70', icon: Scale, defaultChecked: false },
  { name: 'Blood Sugar', label: 'Blood Sugar', unit: 'mg/dL', placeholder: 'e.g. 100', icon: Droplet, defaultChecked: false },
  { name: 'Respiratory Rate', label: 'Respiratory Rate', unit: 'breaths/min', placeholder: 'e.g. 16', icon: Gauge, defaultChecked: false },
];

const COMMON_DIAGNOSES = [
  'Hypertension',
  'Diabetes (Type 2)',
  'Diabetes (Type 1)',
  'Asthma',
  'Thyroid Disorder',
  'Heart Disease',
  'COPD',
  'Chronic Allergy',
  'None (Healthy Profile)'
];

export function VitalsModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialVitals = [], 
  initialPastDiagnoses = '' 
}: VitalsModalProps) {
  
  // Track selection state
  const [selectedVitals, setSelectedVitals] = useState<Record<string, boolean>>({});
  // Track input values
  const [vitalValues, setVitalValues] = useState<Record<string, string>>({});
  // Track diagnoses tags selected
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  // Custom detailed medical history text
  const [customHistory, setCustomHistory] = useState('');

  // Synchronize initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set vitals selection and values from initials or defaults
      const selections: Record<string, boolean> = {};
      const values: Record<string, string> = {};

      COMMON_VITALS.forEach(v => {
        const found = initialVitals.find(iv => iv.name === v.name);
        if (found) {
          selections[v.name] = true;
          values[v.name] = found.value;
        } else {
          selections[v.name] = v.defaultChecked;
          values[v.name] = '';
        }
      });

      setSelectedVitals(selections);
      setVitalValues(values);

      // Parse initial diagnoses
      const activeDiagnoses: string[] = [];
      let customText = '';

      if (initialPastDiagnoses) {
        const tags = initialPastDiagnoses.split(',').map(t => t.trim());
        tags.forEach(t => {
          if (COMMON_DIAGNOSES.includes(t)) {
            activeDiagnoses.push(t);
          } else if (t) {
            customText = customText ? `${customText}, ${t}` : t;
          }
        });
      }

      setSelectedDiagnoses(activeDiagnoses);
      setCustomHistory(customText);
    }
  }, [isOpen, initialVitals, initialPastDiagnoses]);

  // Toggle selection
  const handleToggleVital = (name: string) => {
    setSelectedVitals(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Handle value inputs
  const handleValueChange = (name: string, value: string) => {
    setVitalValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Toggle diagnoses tag selection
  const handleToggleDiagnosis = (tag: string) => {
    if (tag === 'None (Healthy Profile)') {
      setSelectedDiagnoses(['None (Healthy Profile)']);
      return;
    }

    setSelectedDiagnoses(prev => {
      const filtered = prev.filter(t => t !== 'None (Healthy Profile)');
      if (filtered.includes(tag)) {
        return filtered.filter(t => t !== tag);
      } else {
        return [...filtered, tag];
      }
    });
  };

  const handleSave = () => {
    // 1. Build vitals payload from checked & filled values
    const vitalsPayload = COMMON_VITALS.filter(v => selectedVitals[v.name] && vitalValues[v.name]?.trim())
      .map(v => ({
        name: v.name,
        value: `${vitalValues[v.name].trim()} ${v.unit}`
      }));

    // 2. Build past diagnoses string
    const diagnosesArray = [...selectedDiagnoses];
    if (customHistory.trim()) {
      diagnosesArray.push(customHistory.trim());
    }
    const pastDiagnosesPayload = diagnosesArray.join(', ');

    onSave(vitalsPayload, pastDiagnosesPayload);
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Clinical Vitals & Medical History"
      className="max-w-2xl bg-white rounded-2xl"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 pr-2">
        
        {/* Intro */}
        <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl flex gap-2.5 items-start">
          <div className="h-7 w-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100 mt-0.5">
            <ClipboardList size={16} />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 tracking-tight">Record Patient Vital Metrics</h4>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              Select key vitals from the checklists and enter clinical measurements below. Highlight past historical diagnoses to sync directly with the EMR record.
            </p>
          </div>
        </div>

        {/* Vitals Input Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Checklist: Common Vitals</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {COMMON_VITALS.map(v => {
              const Icon = v.icon;
              const isChecked = !!selectedVitals[v.name];
              const value = vitalValues[v.name] || '';

              return (
                <div 
                  key={v.name}
                  onClick={() => !isChecked && handleToggleVital(v.name)}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                    isChecked 
                      ? 'border-blue-500/80 bg-blue-50/20 shadow-sm' 
                      : 'border-slate-100 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2.5">
                      {/* Checkbox */}
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleVital(v.name)}
                        onClick={e => e.stopPropagation()}
                        className="h-4 w-4 text-blue-600 border-slate-300 rounded cursor-pointer"
                      />
                      
                      {/* Icon & Label */}
                      <div className={`p-1.5 rounded-lg flex items-center justify-center border ${
                        isChecked 
                          ? 'bg-blue-50 text-blue-600 border-blue-100' 
                          : 'bg-slate-50 text-slate-400 border-slate-100'
                      }`}>
                        <Icon size={16} />
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">{v.label}</span>
                    </div>
                    
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">{v.unit}</span>
                  </div>

                  {/* Value input (only shown/active if checked) */}
                  {isChecked && (
                    <div className="mt-3.5 flex gap-2 items-center animate-in slide-in-from-top-2 duration-150" onClick={e => e.stopPropagation()}>
                      <input 
                        type="text"
                        placeholder={v.placeholder}
                        value={value}
                        onChange={e => handleValueChange(v.name, e.target.value)}
                        className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono"
                      />
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">{v.unit}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnoses Section */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Past Medical Diagnoses</h3>
          
          {/* Quick Tags */}
          <div className="flex flex-wrap gap-2">
            {COMMON_DIAGNOSES.map(tag => {
              const isSelected = selectedDiagnoses.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleDiagnosis(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1 hover:scale-105 active:scale-95 ${
                    isSelected 
                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {isSelected && <Check size={12} className="stroke-[3]" />}
                  {tag}
                </button>
              );
            })}
          </div>

          {/* Custom additional history input */}
          <div className="space-y-1 mt-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Additional History / Custom Conditions</label>
            <input 
              type="text"
              placeholder="e.g. Chronic Kidney Disease, Previous Heart Surgery"
              value={customHistory}
              onChange={e => setCustomHistory(e.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          
          <button 
            type="button" 
            onClick={handleSave} 
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 shadow-md shadow-blue-500/10 transition-colors"
          >
            Save Details
          </button>
        </div>

      </div>
    </Modal>
  );
}
