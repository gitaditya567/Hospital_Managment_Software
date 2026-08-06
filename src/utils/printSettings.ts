export interface PrintSettings {
  margin: number;       // In mm
  padding: number;      // In px
  fontSize: number;     // In px
  accentColor: string;  // Hex string
  paperSize: '80mm' | 'A4';
  showHeader: boolean;
  showFooter: boolean;
  customHeaderText: string;
  customFooterText: string;
  logoUrl: string;      // Base64 encoded logo string
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  margin: 10,
  padding: 12,
  fontSize: 12,
  accentColor: '#1e293b', // Slate-800 default brand color
  paperSize: '80mm',
  showHeader: true,
  showFooter: true,
  customHeaderText: '',
  customFooterText: 'Thank you for visiting! Keep medicines out of reach of children.',
  logoUrl: ''
};

const LOCAL_STORAGE_KEY = 'smarthospital_print_settings';
const GLOBAL_ADMIN_KEY = 'medisaas_global_admin_print_settings';
export const PRINT_SETTINGS_EVENT = 'medisaas-print-settings-changed';

export function getPrintSettings(): PrintSettings {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem(GLOBAL_ADMIN_KEY);
    const fallbackLogo = localStorage.getItem('medisaas_hospital_logo') || '';
    if (!saved) {
      return {
        ...DEFAULT_PRINT_SETTINGS,
        logoUrl: fallbackLogo
      };
    }
    
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_PRINT_SETTINGS,
      logoUrl: parsed.logoUrl || fallbackLogo,
      ...parsed
    };
  } catch (e) {
    console.error('Failed to parse print settings', e);
    const fallbackLogo = localStorage.getItem('medisaas_hospital_logo') || '';
    return {
      ...DEFAULT_PRINT_SETTINGS,
      logoUrl: fallbackLogo
    };
  }
}

export function savePrintSettings(settings: Partial<PrintSettings>): PrintSettings {
  const current = getPrintSettings();
  const updated = { ...current, ...settings };
  const jsonStr = JSON.stringify(updated);
  
  // Persist globally across local role scopes and admin settings
  localStorage.setItem(LOCAL_STORAGE_KEY, jsonStr);
  localStorage.setItem(GLOBAL_ADMIN_KEY, jsonStr);
  
  // Dispatch custom event to alert all role components in real-time within current window
  window.dispatchEvent(new CustomEvent(PRINT_SETTINGS_EVENT, { detail: updated }));
  return updated;
}

// Cross-tab / cross-window sync listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LOCAL_STORAGE_KEY || event.key === GLOBAL_ADMIN_KEY) {
      const updated = getPrintSettings();
      window.dispatchEvent(new CustomEvent(PRINT_SETTINGS_EVENT, { detail: updated }));
    }
  });
}

export function getHospitalDisplayName(): string {
  const settings = getPrintSettings();
  if (settings.customHeaderText && settings.customHeaderText.trim() !== '' && settings.customHeaderText !== 'Smart Hospital') {
    return settings.customHeaderText;
  }
  const savedHospitalName = localStorage.getItem('medisaas_hospital_name');
  return savedHospitalName || 'Apollo Hospital';
}
