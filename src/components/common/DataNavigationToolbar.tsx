import { useState } from 'react';
import { Calendar, Filter, Search, RotateCcw, ChevronDown, Activity, Layers, Tag } from 'lucide-react';
import { Button } from '../ui/Button';

export interface FilterState {
  datePreset: 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
  startDate?: string;
  endDate?: string;
  patientType: 'ALL' | 'OPD' | 'EMERGENCY' | 'IPD' | 'FOLLOWUP';
  statusFilter: 'ALL' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED';
  searchQuery: string;
}

export const INITIAL_FILTER_STATE: FilterState = {
  datePreset: 'ALL',
  startDate: '',
  endDate: '',
  patientType: 'ALL',
  statusFilter: 'ALL',
  searchQuery: ''
};

interface DataNavigationToolbarProps {
  filters: FilterState;
  onFilterChange: (updated: FilterState) => void;
  totalRecordsCount?: number;
  filteredCount?: number;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function DataNavigationToolbar({
  filters,
  onFilterChange,
  totalRecordsCount,
  filteredCount,
  title = "Interactive Data Control & Filters",
  subtitle = "Filter live clinical records by date range, patient type, and operational status",
  className = ""
}: DataNavigationToolbarProps) {
  const [showCustomDate, setShowCustomDate] = useState(filters.datePreset === 'CUSTOM');
  const [isExpanded, setIsExpanded] = useState(true);

  const activeFiltersCount = [
    filters.datePreset !== 'ALL',
    filters.patientType !== 'ALL',
    filters.statusFilter !== 'ALL',
    !!filters.searchQuery.trim()
  ].filter(Boolean).length;

  const handleDatePresetChange = (preset: FilterState['datePreset']) => {
    if (preset === 'CUSTOM') {
      setShowCustomDate(true);
      onFilterChange({ ...filters, datePreset: 'CUSTOM' });
    } else {
      setShowCustomDate(false);
      onFilterChange({
        ...filters,
        datePreset: preset,
        startDate: '',
        endDate: ''
      });
    }
  };

  const handleReset = () => {
    setShowCustomDate(false);
    onFilterChange(INITIAL_FILTER_STATE);
  };

  return (
    <div className={`glass-card rounded-2xl border border-teal-100/60 bg-white/70 shadow-sm p-4 transition-all duration-200 ${className}`}>
      {/* Header bar */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-teal-50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100/60">
            <Filter size={16} className="text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight text-glow-teal">{title}</h3>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-600 text-white shadow-sm">
                  {activeFiltersCount} Active {activeFiltersCount === 1 ? 'Filter' : 'Filters'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalRecordsCount !== undefined && filteredCount !== undefined && (
            <div className="px-3 py-1 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-600 flex items-center gap-1.5 font-mono">
              <Activity size={12} className="text-teal-500" />
              <span>Showing <strong>{filteredCount}</strong> of <strong>{totalRecordsCount}</strong></span>
            </div>
          )}

          {activeFiltersCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8 text-xs font-bold gap-1 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
            >
              <RotateCcw size={12} /> Reset
            </Button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Toggle Toolbar"
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Controls Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3.5 animate-in fade-in duration-200">
          {/* Live Search */}
          <div className="lg:col-span-4 relative">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Search Keywords</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Name, Phone, PAT-ID or Rx Code..."
                value={filters.searchQuery}
                onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Date Range Presets */}
          <div className="lg:col-span-4 space-y-1">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              <Calendar size={10} className="inline mr-1 text-teal-600" /> Date Range Filter
            </label>
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today' },
                { id: 'YESTERDAY', label: 'Yesterday' },
                { id: 'WEEK', label: 'This Week' },
                { id: 'MONTH', label: 'This Month' },
                { id: 'CUSTOM', label: 'Custom' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleDatePresetChange(p.id as FilterState['datePreset'])}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all border ${
                    filters.datePreset === p.id
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Patient Type Filter */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              <Layers size={10} className="inline mr-1 text-teal-600" /> Patient Type
            </label>
            <select
              value={filters.patientType}
              onChange={(e) => onFilterChange({ ...filters, patientType: e.target.value as FilterState['patientType'] })}
              className="w-full h-8 px-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            >
              <option value="ALL">All Patient Types</option>
              <option value="OPD">OPD Consultation</option>
              <option value="EMERGENCY">Emergency Care</option>
              <option value="IPD">IPD / In-Patient</option>
              <option value="FOLLOWUP">Follow-Up Visit</option>
            </select>
          </div>

          {/* Operational Status Filter */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              <Tag size={10} className="inline mr-1 text-teal-600" /> Status
            </label>
            <select
              value={filters.statusFilter}
              onChange={(e) => onFilterChange({ ...filters, statusFilter: e.target.value as FilterState['statusFilter'] })}
              className="w-full h-8 px-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="WAITING">Waiting Queue</option>
              <option value="IN_CONSULTATION">In Consultation</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Custom Date Pickers (Conditional) */}
          {showCustomDate && (
            <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/70 rounded-xl animate-in slide-in-from-top-2 duration-150">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase">From Date</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
                  className="w-full h-8 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase">To Date</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
                  className="w-full h-8 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Utility helper to filter records array by FilterState
export function applyDataFilters<T extends Record<string, any>>(items: T[], filters: FilterState): T[] {
  if (!items || items.length === 0) return [];

  // Local YYYY-MM-DD date formatter helper avoiding timezone shift bugs
  const formatLocalYYYYMMDD = (dateObj: Date): string => {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getLocalDateStr = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') {
      const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return formatLocalYYYYMMDD(d);
  };

  const now = new Date();
  const todayStr = formatLocalYYYYMMDD(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = formatLocalYYYYMMDD(yesterday);

  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const weekAgoStr = formatLocalYYYYMMDD(weekAgo);

  const monthAgo = new Date(now);
  monthAgo.setDate(now.getDate() - 30);
  const monthAgoStr = formatLocalYYYYMMDD(monthAgo);

  return items.filter((item) => {
    // 1. Search Query Filter
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      const name = (item.name || item.patientName || '').toLowerCase();
      const phone = (item.phone || item.patientPhone || '').toLowerCase();
      const patientNo = (item.patientNo || '').toLowerCase();
      const rxCode = (item.rxCode || item.code || item.id || '').toLowerCase();
      const doctor = (item.doctorName || item.doctor || '').toLowerCase();

      const matches = name.includes(q) || phone.includes(q) || patientNo.includes(q) || rxCode.includes(q) || doctor.includes(q);
      if (!matches) return false;
    }

    // 2. Status Filter
    if (filters.statusFilter !== 'ALL') {
      const rawStatus = (item.status || '').toLowerCase();
      if (filters.statusFilter === 'WAITING' && !(rawStatus.includes('waiting') || rawStatus.includes('pending') || rawStatus.includes('unpaid'))) {
        return false;
      }
      if (filters.statusFilter === 'IN_CONSULTATION' && !(rawStatus.includes('consulting') || rawStatus.includes('consultation') || rawStatus.includes('active'))) {
        return false;
      }
      if (filters.statusFilter === 'COMPLETED' && !(rawStatus.includes('completed') || rawStatus.includes('dispensed') || rawStatus.includes('paid'))) {
        return false;
      }
    }

    // 3. Patient Type Filter
    if (filters.patientType !== 'ALL') {
      const feeType = (item.feeType || '').toLowerCase();
      const patientType = (item.patientType || item.type || '').toLowerCase();
      const timeReg = (item.timeRegistered || '').toLowerCase();

      const isEmergency = feeType.includes('emergency') || patientType.includes('emergency') || timeReg.includes('emergency');
      const isIPD = feeType.includes('ipd') || feeType.includes('bed') || patientType.includes('ipd') || patientType.includes('in-patient');
      const isFollowup = feeType.includes('follow') || feeType.includes('review') || patientType.includes('follow') || timeReg.includes('follow');
      const isOPD = !isEmergency && !isIPD && !isFollowup;

      if (filters.patientType === 'OPD' && !isOPD) return false;
      if (filters.patientType === 'EMERGENCY' && !isEmergency) return false;
      if (filters.patientType === 'IPD' && !isIPD) return false;
      if (filters.patientType === 'FOLLOWUP' && !isFollowup) return false;
    }

    // 4. Date Range Filter
    if (filters.datePreset !== 'ALL') {
      const rawDate = item.appointmentDate || item.date || item.createdAt || item.timestamp;
      const itemDateStr = getLocalDateStr(rawDate) || todayStr;

      if (filters.datePreset === 'TODAY' && itemDateStr !== todayStr) return false;
      if (filters.datePreset === 'YESTERDAY' && itemDateStr !== yesterdayStr) return false;
      if (filters.datePreset === 'WEEK' && itemDateStr < weekAgoStr) return false;
      if (filters.datePreset === 'MONTH' && itemDateStr < monthAgoStr) return false;
      if (filters.datePreset === 'CUSTOM') {
        if (filters.startDate && itemDateStr < filters.startDate) return false;
        if (filters.endDate && itemDateStr > filters.endDate) return false;
      }
    }

    return true;
  });
}
