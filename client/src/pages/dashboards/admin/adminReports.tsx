import { useMemo, useState } from 'react';
import type { PatientInvoice, PatientRecord } from '../../../store/useHospitalStore';
import type { PharmacyBill } from '../../../store/usePharmacyStore';

// ───────── Dates & ranges ─────────

export type RangeKey = 'today' | '7' | '30' | 'month' | 'all';
export const RANGES: Array<[RangeKey, string]> = [['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['all', 'All time']];

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

// Invoice/bill dates are stored as "22 Oct 2026"; parse them as local dates
export function parseLabelDate(label?: string): Date | null {
  if (!label) return null;
  const m = /^(\d{1,2})\s+([A-Za-z]{3,4})\.?\s+(\d{4})$/.exec(label.trim());
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) return new Date(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]));
  const d = new Date(label);
  return isNaN(d.getTime()) ? null : d;
}

export function rangeStart(range: RangeKey): Date | null {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === 'today') return d;
  if (range === '7') { d.setDate(d.getDate() - 6); return d; }
  if (range === '30') { d.setDate(d.getDate() - 29); return d; }
  if (range === 'month') { d.setDate(1); return d; }
  return null;
}

export const inRange = (date: Date | null, range: RangeKey) => {
  if (!date) return range === 'all';
  const start = rangeStart(range);
  return !start || date >= start;
};

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const money = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ───────── Unified money movements ─────────

export interface Txn {
  id: string;
  date: Date | null;
  kind: 'OPD' | 'Pharmacy';
  ref: string;
  patientName: string;
  patientNo?: string;
  phone: string;
  doctorName: string;
  description: string;
  amount: number;
  status: 'Paid' | 'Pending';
  paymentMode: string;
}

export function buildTransactions(invoices: PatientInvoice[], bills: PharmacyBill[], patients: PatientRecord[]): Txn[] {
  const byId = new Map(patients.map(p => [p.id, p]));
  const opd: Txn[] = invoices.map(inv => {
    const visit = inv.patientId ? byId.get(inv.patientId) : undefined;
    return {
      id: `inv-${inv.id}`,
      date: parseLabelDate(inv.date),
      kind: 'OPD',
      ref: inv.id,
      patientName: inv.patientName,
      patientNo: visit?.patientNo,
      phone: inv.patientPhone,
      doctorName: inv.doctorName,
      description: inv.feeType,
      amount: inv.amount,
      status: inv.status,
      paymentMode: inv.status === 'Paid' ? (inv.paymentMode || 'Not recorded') : '—'
    };
  });
  const pharmacy: Txn[] = bills.map(b => ({
    id: `bill-${b.id}`,
    date: b.createdAt ? new Date(b.createdAt) : parseLabelDate(b.date),
    kind: 'Pharmacy',
    ref: b.billNo || b.rxCode || b.id,
    patientName: b.patientName,
    patientNo: b.patientNo,
    phone: b.patientPhone,
    doctorName: b.doctorName,
    description: b.saleType === 'Counter' ? `Counter sale · ${b.items.length} item${b.items.length === 1 ? '' : 's'}` : `Rx ${b.rxCode} · ${b.items.length} item${b.items.length === 1 ? '' : 's'}`,
    amount: b.total,
    status: 'Paid',
    paymentMode: b.paymentMode
  }));
  return [...opd, ...pharmacy].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
}

export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ───────── Range picker ─────────

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range">
      {RANGES.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={`h-9 px-3 rounded-lg text-xs font-bold border ${value === k ? 'bg-[#060606] border-[#060606] text-white' : 'bg-white border-[#D8D8D8] text-slate-600 hover:border-slate-400'}`}>{label}</button>
      ))}
    </div>
  );
}

// ───────── Charts ─────────
// Series colours: validated pair (brand blue = OPD, orange = Pharmacy) — never reused for status.
export const SERIES = { opd: '#3683F8', pharmacy: '#eb6834' };

export interface DayPoint { key: string; label: string; opd: number; pharmacy: number }

export function dailySeries(txns: Txn[], range: RangeKey): DayPoint[] {
  const start = rangeStart(range === 'all' ? '30' : range) || new Date();
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const days: DayPoint[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({ key: dayKey(d), label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), opd: 0, pharmacy: 0 });
  }
  const index = new Map(days.map(p => [p.key, p]));
  txns.forEach(t => {
    if (t.status !== 'Paid' || !t.date) return;
    const p = index.get(dayKey(t.date));
    if (!p) return;
    if (t.kind === 'OPD') p.opd += t.amount;
    else p.pharmacy += t.amount;
  });
  return days;
}

// Stacked daily collections (OPD below, pharmacy above), with hover tooltip and a table view
export function TrendChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...data.map(d => d.opd + d.pharmacy));
  const niceMax = useMemo(() => {
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / step) * step;
  }, [max]);
  const H = 180;
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600" aria-label="Legend">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.opd }} /> OPD fees</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.pharmacy }} /> Pharmacy</span>
        </div>
        <button type="button" onClick={() => setAsTable(!asTable)} className="text-[11px] font-bold text-[#3683F8]">{asTable ? 'View as chart' : 'View as table'}</button>
      </div>
      {asTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-[10px] uppercase"><tr><th className="text-left py-1">Day</th><th className="text-right">OPD</th><th className="text-right">Pharmacy</th><th className="text-right">Total</th></tr></thead>
            <tbody>{data.map(d => <tr key={d.key} className="border-t border-slate-100"><td className="py-1">{d.label}</td><td className="text-right">{money(d.opd)}</td><td className="text-right">{money(d.pharmacy)}</td><td className="text-right font-bold">{money(d.opd + d.pharmacy)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <div className="flex">
            <div className="flex flex-col justify-between text-[10px] text-slate-400 font-semibold pr-2 text-right w-14 shrink-0" style={{ height: H }}>
              <span>{money(niceMax)}</span><span>{money(niceMax / 2)}</span><span>₹0</span>
            </div>
            <div className="relative flex-1" style={{ height: H }}>
              {[0, 0.5, 1].map(f => <div key={f} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: `${f * 100}%` }} />)}
              <div className="absolute inset-0 flex items-end gap-[2px]">
                {data.map((d, i) => {
                  const opdH = (d.opd / niceMax) * H;
                  const phH = (d.pharmacy / niceMax) * H;
                  return (
                    <div
                      key={d.key}
                      className="relative flex-1 h-full flex flex-col justify-end cursor-default"
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      tabIndex={0}
                      aria-label={`${d.label}: OPD ${money(d.opd)}, pharmacy ${money(d.pharmacy)}`}
                    >
                      {hover === i && <div className="absolute inset-0 bg-slate-100/70 rounded" />}
                      {phH > 0 && <div className="relative rounded-t-[4px]" style={{ height: phH, background: SERIES.pharmacy, marginBottom: opdH > 0 ? 2 : 0 }} />}
                      {opdH > 0 && <div className={`relative ${phH > 0 ? '' : 'rounded-t-[4px]'}`} style={{ height: opdH, background: SERIES.opd }} />}
                    </div>
                  );
                })}
              </div>
              {hover !== null && data[hover] && (
                <div
                  className="absolute z-10 -top-2 bg-white border border-[#D8D8D8] rounded-xl shadow-lg px-3 py-2 text-xs pointer-events-none"
                  style={{ left: `${Math.min(80, (hover / Math.max(1, data.length - 1)) * 100)}%` }}
                >
                  <div className="font-bold mb-1">{data[hover].label}</div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: SERIES.opd }} /> OPD <span className="font-bold ml-auto pl-3">{money(data[hover].opd)}</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: SERIES.pharmacy }} /> Pharmacy <span className="font-bold ml-auto pl-3">{money(data[hover].pharmacy)}</span></div>
                  <div className="border-t border-slate-100 mt-1 pt-1 flex justify-between font-bold"><span>Total</span><span>{money(data[hover].opd + data[hover].pharmacy)}</span></div>
                </div>
              )}
            </div>
          </div>
          <div className="flex ml-14 mt-1">
            {data.map((d, i) => <div key={d.key} className="flex-1 text-center text-[10px] text-slate-400 font-semibold">{i % labelEvery === 0 ? d.label : ''}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// Single-series ranked bars with direct labels
export function BarList({ rows, emptyText }: { rows: Array<{ label: string; value: number; detail?: string }>; emptyText: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <p className="text-sm text-slate-400 font-semibold py-6 text-center">{emptyText}</p>;
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label} title={`${r.label}: ${money(r.value)}${r.detail ? ` · ${r.detail}` : ''}`}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-bold text-slate-700 truncate">{r.label}</span>
            <span className="font-extrabold text-[#060606] shrink-0 pl-2">{money(r.value)}{r.detail && <span className="text-slate-400 font-semibold"> · {r.detail}</span>}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: SERIES.opd }} />
          </div>
        </div>
      ))}
    </div>
  );
}
