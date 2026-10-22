import { useMemo, useState } from 'react';
import { Receipt, Search, Printer, Download, IndianRupee, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import type { PharmacyBill } from '../../store/usePharmacyStore';
import { doctorTitle } from '../../lib/utils';
import { printPharmacyBill } from './PharmacyDashboard';

type Range = 'today' | '7' | '30' | 'all';

const money = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const billTime = (b: PharmacyBill) => (b.createdAt ? new Date(b.createdAt) : new Date(b.date));

export function PharmacyOrders() {
  const { bills } = usePharmacyStore();
  const [range, setRange] = useState<Range>('today');
  const [type, setType] = useState<'all' | 'Prescription' | 'Counter'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range === '7') start.setDate(start.getDate() - 6);
    if (range === '30') start.setDate(start.getDate() - 29);
    const q = query.trim().toLowerCase();
    return bills
      .filter(b => range === 'all' || billTime(b) >= start)
      .filter(b => type === 'all' || b.saleType === type)
      .filter(b => !q || [b.billNo, b.rxCode, b.patientName, b.patientPhone, b.patientNo, ...b.items.map(i => i.name)].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => billTime(b).getTime() - billTime(a).getTime());
  }, [bills, range, type, query]);

  const total = filtered.reduce((s, b) => s + b.total, 0);
  const byMode = (mode: string) => filtered.filter(b => b.paymentMode === mode).reduce((s, b) => s + b.total, 0);
  const discounts = filtered.reduce((s, b) => s + (b.discount || 0), 0);

  const exportCsv = () => {
    const rows = filtered.map(b => [
      b.billNo || b.id, billTime(b).toLocaleString('en-IN'), b.saleType, b.rxCode, b.patientName, b.patientPhone,
      b.items.map(i => `${i.name} x${i.qty}`).join('; '), b.subtotal, b.discount, b.total, b.paymentMode
    ]);
    const csv = [['Bill no', 'Date & time', 'Type', 'Rx code', 'Customer', 'Phone', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment'], ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy-sales-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><Receipt size={22} /> Sales history</h1>
          <p className="text-blue-50 text-xs font-semibold mt-1">Every pharmacy bill, with reprint and export for accounts.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!filtered.length} className="h-11 px-4 rounded-xl bg-white text-[#3683F8] font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Total (${filtered.length} bills)`, value: money(total), icon: IndianRupee },
          { label: 'Cash', value: money(byMode('Cash')), icon: Banknote },
          { label: 'UPI', value: money(byMode('UPI')), icon: Smartphone },
          { label: 'Card', value: money(byMode('Card')), icon: CreditCard }
        ].map(k => (
          <div key={k.label} className="bg-white p-4 rounded-2xl border border-[#D8D8D8] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
              <p className="text-2xl font-extrabold">{k.value}</p>
            </div>
            <k.icon size={20} className="text-[#3683F8]" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
        <div className="p-4 border-b border-[#D8D8D8] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {([['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setRange(k)} className={`h-8 px-3 rounded-lg text-xs font-bold border ${range === k ? 'bg-[#060606] border-[#060606] text-white' : 'bg-white border-[#D8D8D8] text-slate-600'}`}>{label}</button>
            ))}
            <select value={type} onChange={e => setType(e.target.value as typeof type)} aria-label="Sale type" className="h-8 px-2 rounded-lg border border-[#D8D8D8] text-xs font-bold bg-white">
              <option value="all">All sales</option>
              <option value="Prescription">Prescriptions</option>
              <option value="Counter">Counter sales</option>
            </select>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Bill, Rx, customer, medicine" className="h-9 w-64 pl-8 pr-3 rounded-xl border border-[#D8D8D8] text-xs font-semibold focus:outline-none focus:border-[#3683F8]" />
          </div>
        </div>
        {discounts > 0 && <p className="px-4 pt-3 text-[11px] font-semibold text-slate-500">Discounts given in this period: {money(discounts)}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#EBF3FE]/60 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
              <tr><th className="px-4 py-3">Bill</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Items</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Paid by</th><th className="px-4 py-3 text-right">Reprint</th></tr>
            </thead>
            <tbody className="divide-y divide-[#D8D8D8]/60">
              {filtered.map(b => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold">{b.billNo || '—'}</div>
                    <div className={`text-[10px] font-extrabold ${b.saleType === 'Counter' ? 'text-violet-600' : 'text-[#3683F8]'}`}>{b.saleType === 'Counter' ? 'Counter sale' : b.rxCode}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-semibold whitespace-nowrap">{billTime(b).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3"><div className="font-extrabold">{b.patientName}</div><div className="text-[11px] text-slate-500">{[b.patientNo, b.patientPhone, b.doctorName && doctorTitle(b.doctorName)].filter(Boolean).join(' · ')}</div></td>
                  <td className="px-4 py-3 text-slate-600 max-w-[280px]">{b.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
                  <td className="px-4 py-3 text-right font-extrabold whitespace-nowrap">{money(b.total)}{b.discount > 0 && <div className="text-[10px] text-slate-400 font-semibold">−{money(b.discount)} off</div>}</td>
                  <td className="px-4 py-3 font-bold">{b.paymentMode}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => printPharmacyBill(b)} className="h-8 px-3 rounded-lg border border-[#D8D8D8] text-[11px] font-bold text-[#3683F8] inline-flex items-center gap-1"><Printer size={13} /> Print</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm font-bold text-slate-400">No bills in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
