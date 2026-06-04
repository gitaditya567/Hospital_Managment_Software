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
  customHeaderText: 'City Care Hospital',
  customFooterText: 'Thank you for cooperation',
  logoUrl: ''
};

const LOCAL_STORAGE_KEY = 'medisaas_print_settings';
export const PRINT_SETTINGS_EVENT = 'medisaas-print-settings-changed';

export function getPrintSettings(): PrintSettings {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return DEFAULT_PRINT_SETTINGS;
    
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_PRINT_SETTINGS,
      ...parsed
    };
  } catch (e) {
    console.error('Failed to parse print settings', e);
    return DEFAULT_PRINT_SETTINGS;
  }
}

export function savePrintSettings(settings: Partial<PrintSettings>): PrintSettings {
  const current = getPrintSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  
  // Dispatch custom event to alert other components in real-time
  window.dispatchEvent(new CustomEvent(PRINT_SETTINGS_EVENT, { detail: updated }));
  return updated;
}
