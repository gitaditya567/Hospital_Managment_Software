import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Printer, Pill, ShoppingCart, ClipboardList, IndianRupee, AlertTriangle, CalendarX, RefreshCw,
  Plus, Trash2, CheckCircle2, User, Stethoscope, PackagePlus, X
} from 'lucide-react';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import type { Medicine, PaymentMode, PharmacyBill, Prescription } from '../../store/usePharmacyStore';
import { Modal } from '../../components/ui/Modal';
import { doctorTitle } from '../../lib/utils';
import { printIsolatedHtml } from '../../utils/printHelper';
import { buildPharmacyBillSlipHtml } from '../../utils/thermalSlipTemplates';
import { PaymentModePicker, ToastStack, formatWait, useNow, useToasts } from './reception/receptionShared';

const REFRESH_MS = 10000;
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayLabel = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const money = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

type LineStatus = 'ok' | 'short' | 'missing' | 'expired';

interface Line {
  key: string;
  name: string;
  medicine?: Medicine;
  qty: number;
  prescribedQty?: number;
  dosage?: string;
  timing?: string;
  duration?: string;
  include: boolean;
}

const statusOf = (line: Line): LineStatus => {
  if (!line.medicine) return 'missing';
  if (line.medicine.expiryDate && line.medicine.expiryDate < todayYMD()) return 'expired';
  if (line.medicine.stock < line.qty) return 'short';
  return 'ok';
};

export function printPharmacyBill(bill: PharmacyBill) {
  printIsolatedHtml('Pharmacy Bill', buildPharmacyBillSlipHtml({
    billId: bill.billNo || bill.id,
    rxCode: bill.rxCode,
    patientName: bill.patientName,
    patientPhone: bill.patientPhone,
    patientNo: bill.patientNo,
    doctorName: bill.doctorName,
    date: bill.date,
    items: bill.items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    total: bill.total,
    discount: bill.discount,
    paymentMode: bill.paymentMode
  }));
}

export function PharmacyDashboard() {
  const { inventory, prescriptions, bills, fetchPharmacyData, dispensePrescription, lastSync } = usePharmacyStore();
  const { toasts, push, dismiss } = useToasts();
  const now = useNow(15000);

  // Live refresh so new prescriptions from doctors appear without reloading
  useEffect(() => {
    fetchPharmacyData();
    const id = setInterval(() => { if (document.visibilityState === 'visible') fetchPharmacyData(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchPharmacyData]);

  const pending = useMemo(
    () => prescriptions.filter(p => p.status === 'PENDING').sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [prescriptions]
  );
  const todaysBills = bills.filter(b => b.date === todayLabel());
  const salesToday = todaysBills.reduce((s, b) => s + b.total, 0);
  const lowStock = inventory.filter(m => m.stock <= m.minThreshold).length;
  const in30 = new Date(Date.now() + 30 * 86400000);
  const in30YMD = `${in30.getFullYear()}-${String(in30.getMonth() + 1).padStart(2, '0')}-${String(in30.getDate()).padStart(2, '0')}`;
  const expiring = inventory.filter(m => m.stock > 0 && m.expiryDate && m.expiryDate <= in30YMD).length;

  // ───────── Queue search ─────────
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const queue = pending.filter(p => !q || [p.id, p.patientName, p.patientPhone, p.patientNo, p.doctorName].some(v => (v || '').toLowerCase().includes(q)));

  // ───────── Bill being prepared ─────────
  const [mode, setMode] = useState<'rx' | 'counter' | null>(null);
  const [rx, setRx] = useState<Prescription | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [payMode, setPayMode] = useState<PaymentMode>('Cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<PharmacyBill | null>(null);

  const findMedicine = (name: string) => inventory.find(m => m.name.trim().toLowerCase() === name.trim().toLowerCase());

  const reset = () => {
    setMode(null); setRx(null); setLines([]); setCustomerName(''); setCustomerPhone(''); setDiscount(''); setPayMode('Cash'); setError('');
  };

  const openRx = (p: Prescription) => {
    setMode('rx');
    setRx(p);
    setError('');
    setDiscount('');
    setPayMode('Cash');
    setLines(p.items.map((item, i) => {
      const medicine = findMedicine(item.name);
      const line: Line = { key: `${item.name}-${i}`, name: item.name, medicine, qty: item.qty, prescribedQty: item.qty, dosage: item.dosage, timing: item.timing, duration: item.duration, include: true };
      // Items the pharmacy cannot supply start excluded (patient buys them outside)
      const st = statusOf(line);
      return { ...line, include: st === 'ok' || (st === 'short' && (medicine?.stock || 0) > 0) };
    }));
  };

  // Keep stock figures on the open bill current after a refresh
  useEffect(() => {
    setLines(ls => ls.map(l => ({ ...l, medicine: findMedicine(l.name) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory]);

  // Lookup by exact Rx code / phone / patient no. opens it directly
  const tryOpen = (value: string) => {
    const v = value.trim().toUpperCase();
    if (!v) return false;
    const exact = pending.find(p => p.id.toUpperCase() === v || p.patientNo?.toUpperCase() === v)
      || [...pending].reverse().find(p => p.patientPhone === v.replace(/\D/g, '') && v.replace(/\D/g, '').length === 10);
    if (exact) { openRx(exact); setQuery(''); return true; }
    return false;
  };

  const startCounterSale = () => {
    reset();
    setMode('counter');
  };

  // Counter-sale medicine search
  const [medQuery, setMedQuery] = useState('');
  const medResults = medQuery.trim()
    ? inventory.filter(m => m.name.toLowerCase().includes(medQuery.trim().toLowerCase()) || m.category.toLowerCase().includes(medQuery.trim().toLowerCase())).slice(0, 8)
    : [];
  const addMedicineLine = (m: Medicine) => {
    if (lines.some(l => l.medicine?.id === m.id)) { push('error', `${m.name} is already on the bill.`); return; }
    setLines(ls => [...ls, { key: m.id, name: m.name, medicine: m, qty: 1, include: true }]);
    setMedQuery('');
  };

  const included = lines.filter(l => l.include);
  const subtotal = included.reduce((s, l) => s + l.qty * (l.medicine?.price || 0), 0);
  const off = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = subtotal - off;
  const blocking = included.filter(l => statusOf(l) !== 'ok');

  const checkout = async () => {
    if (saving) return;
    setError('');
    if (!included.length) return setError('Add at least one medicine to the bill.');
    if (blocking.length) return setError(`Fix the highlighted items first: ${blocking.map(l => l.name).join(', ')}.`);
    setSaving(true);
    const result = await dispensePrescription({
      rxCode: mode === 'rx' ? rx?.id : undefined,
      patientName: mode === 'counter' ? (customerName.trim() || 'Walk-in customer') : undefined,
      patientPhone: mode === 'counter' ? customerPhone.trim() : undefined,
      items: included.map(l => ({ medicineId: l.medicine?.id, name: l.name, qty: l.qty })),
      paymentMode: payMode,
      discount: off
    });
    setSaving(false);
    if (!result.success || !result.bill) {
      setError(result.error || 'Billing failed.');
      if (mode === 'rx' && /already been dispensed/i.test(result.error || '')) reset();
      return;
    }
    setReceipt(result.bill);
    reset();
  };

  const statusBadge = (st: LineStatus, l: Line) => {
    switch (st) {
      case 'ok': return <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{l.medicine!.stock} in stock</span>;
      case 'short': return <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Only {l.medicine!.stock} left</span>;
      case 'expired': return <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Expired {l.medicine!.expiryDate}</span>;
      default: return <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Not stocked</span>;
    }
  };

  const syncedAgo = Math.max(0, Math.round((now - lastSync) / 1000));

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><ShoppingCart size={22} /> Pharmacy counter</h1>
          <p className="text-blue-50 text-xs font-semibold mt-1">Dispense prescriptions from doctors, sell over the counter and print bills.</p>
        </div>
        <button type="button" onClick={startCounterSale} className="h-11 px-5 rounded-xl bg-white text-[#3683F8] font-extrabold text-sm inline-flex items-center gap-2 hover:bg-blue-50">
          <Plus size={17} /> Counter sale
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Pending Rx', value: pending.length, icon: ClipboardList, tone: 'text-[#3683F8] bg-[#EBF3FE] border-blue-200' },
          { label: 'Sales today', value: money(salesToday), icon: IndianRupee, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: 'Bills today', value: todaysBills.length, icon: Printer, tone: 'text-slate-600 bg-slate-50 border-slate-200' },
          { label: 'Low stock', value: lowStock, icon: AlertTriangle, tone: 'text-amber-600 bg-amber-50 border-amber-200', to: '/pharmacy/alerts' },
          { label: 'Expiring ≤30 days', value: expiring, icon: CalendarX, tone: 'text-rose-600 bg-rose-50 border-rose-200', to: '/pharmacy/alerts' }
        ].map(k => {
          const body = (
            <div className="bg-white p-4 rounded-2xl border border-[#D8D8D8] flex items-center justify-between gap-3 h-full">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{k.label}</p>
                <p className="text-2xl font-extrabold tracking-tight">{k.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${k.tone}`}><k.icon size={19} /></div>
            </div>
          );
          return k.to ? <Link key={k.label} to={k.to} className="hover:-translate-y-0.5 transition-transform">{body}</Link> : <div key={k.label}>{body}</div>;
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Pending prescriptions */}
        <aside className="xl:col-span-4 bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
          <div className="p-4 border-b border-[#D8D8D8] space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-2"><ClipboardList size={16} className="text-[#3683F8]" /> Prescriptions to dispense</h2>
              <button type="button" onClick={() => fetchPharmacyData()} title="Refresh" className="h-8 w-8 rounded-lg border border-[#D8D8D8] inline-flex items-center justify-center text-slate-500 hover:text-[#3683F8]"><RefreshCw size={14} /></button>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={e => { setQuery(e.target.value); tryOpen(e.target.value); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!tryOpen(query) && queue[0]) { openRx(queue[0]); setQuery(''); } } }}
                placeholder="Rx code, phone, patient no. or name"
                aria-label="Find prescription"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#D8D8D8] text-sm font-semibold focus:outline-none focus:border-[#3683F8]"
              />
            </div>
            <p className="text-[11px] text-slate-400 font-semibold">Updates automatically · {syncedAgo < 5 ? 'just now' : `${syncedAgo}s ago`}</p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#D8D8D8]/70">
            {queue.map(p => (
              <button key={p.id} type="button" onClick={() => openRx(p)} className={`w-full text-left p-3 ${rx?.id === p.id ? 'bg-[#EBF3FE]' : 'hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100">{p.id}</span>
                  <span className="text-[10px] font-bold text-slate-400">{formatWait(p.createdAt, now)}</span>
                </div>
                <div className="text-sm font-extrabold mt-1">{p.patientName}</div>
                <div className="text-[11px] text-slate-500 font-semibold">{doctorTitle(p.doctorName)} · {p.items.length} item{p.items.length === 1 ? '' : 's'}</div>
              </button>
            ))}
            {queue.length === 0 && <p className="p-6 text-center text-xs font-semibold text-slate-400">{pending.length ? 'No prescription matches your search.' : 'No prescriptions waiting.'}</p>}
          </div>
        </aside>

        {/* Bill */}
        <section className="xl:col-span-8">
          {!mode ? (
            <div className="bg-white rounded-2xl border border-[#D8D8D8] p-10 text-center">
              <Pill size={40} className="mx-auto text-slate-200" />
              <h2 className="text-lg font-extrabold mt-3">{pending.length ? 'Pick a prescription to dispense' : 'No prescriptions waiting'}</h2>
              <p className="text-sm text-slate-500 mt-1">Prescriptions saved by doctors appear on the left within a few seconds. You can also make a counter sale.</p>
              <div className="mt-5 flex flex-wrap gap-2 justify-center">
                {pending[0] && <button type="button" onClick={() => openRx(pending[0])} className="h-11 px-5 rounded-xl bg-[#3683F8] text-white font-bold text-sm">Open {pending[0].id}</button>}
                <button type="button" onClick={startCounterSale} className="h-11 px-5 rounded-xl border border-[#D8D8D8] font-bold text-sm">Counter sale</button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
              <div className="p-4 border-b border-[#D8D8D8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {mode === 'rx' && rx ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[#060606] text-white">{rx.id}</span>
                      <h2 className="text-lg font-extrabold">{rx.patientName}</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5 flex flex-wrap gap-x-3">
                      <span className="inline-flex items-center gap-1"><User size={12} /> {rx.patientNo || '—'} · {rx.patientPhone}</span>
                      <span className="inline-flex items-center gap-1"><Stethoscope size={12} /> {doctorTitle(rx.doctorName)}</span>
                      {rx.diagnosis && <span>Dx: {rx.diagnosis}</span>}
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2 flex-1">
                    <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (optional)" className="h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm focus:outline-none focus:border-[#3683F8]" />
                    <input value={customerPhone} inputMode="numeric" onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Phone (optional)" className="h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm font-mono focus:outline-none focus:border-[#3683F8]" />
                  </div>
                )}
                <button type="button" onClick={reset} className="h-9 px-3 rounded-xl border border-[#D8D8D8] text-xs font-bold inline-flex items-center gap-1 text-slate-600 shrink-0"><X size={14} /> Close</button>
              </div>

              {mode === 'counter' && (
                <div className="p-4 border-b border-[#D8D8D8] relative">
                  <Search size={15} className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={medQuery} onChange={e => setMedQuery(e.target.value)} placeholder="Search medicine to add" aria-label="Search medicine to add" className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#D8D8D8] text-sm focus:outline-none focus:border-[#3683F8]" />
                  {medResults.length > 0 && (
                    <div className="absolute z-20 left-4 right-4 mt-1 bg-white border border-[#D8D8D8] rounded-xl shadow-xl overflow-hidden">
                      {medResults.map(m => (
                        <button key={m.id} type="button" onClick={() => addMedicineLine(m)} className="w-full text-left px-3 py-2 hover:bg-[#EBF3FE] flex items-center justify-between gap-3">
                          <span><span className="text-sm font-bold">{m.name}</span><span className="block text-[11px] text-slate-500">{m.category} · {money(m.price)} · rack {m.location}</span></span>
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${m.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{m.stock > 0 ? `${m.stock} in stock` : 'Out of stock'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="divide-y divide-[#D8D8D8]/70">
                {lines.map(l => {
                  const st = statusOf(l);
                  return (
                    <div key={l.key} className={`p-4 flex flex-col md:flex-row md:items-center gap-3 ${!l.include ? 'bg-slate-50 opacity-70' : st !== 'ok' ? 'bg-rose-50/40' : ''}`}>
                      <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                        <input type="checkbox" checked={l.include} onChange={e => setLines(ls => ls.map(x => (x.key === l.key ? { ...x, include: e.target.checked } : x)))} className="mt-1 rounded border-[#D8D8D8] text-[#3683F8]" aria-label={`Include ${l.name}`} />
                        <span className="min-w-0">
                          <span className="text-sm font-extrabold flex flex-wrap items-center gap-2">{l.name} {statusBadge(st, l)}</span>
                          {(l.dosage || l.duration) && (
                            <span className="block text-xs text-slate-600 font-semibold">{[l.dosage, l.timing, l.duration].filter(Boolean).join(' · ')}{l.prescribedQty ? ` · prescribed ${l.prescribedQty}` : ''}</span>
                          )}
                          {!l.include && <span className="block text-[11px] font-bold text-slate-500">Not billed — patient buys outside</span>}
                          {l.medicine && <span className="block text-[11px] text-slate-400">Rack {l.medicine.location} · batch {l.medicine.batchNo}</span>}
                        </span>
                      </label>
                      <div className="flex items-center gap-3 md:justify-end">
                        <input
                          type="number"
                          min={1}
                          value={l.qty}
                          disabled={!l.include}
                          aria-label={`Quantity of ${l.name}`}
                          onChange={e => setLines(ls => ls.map(x => (x.key === l.key ? { ...x, qty: Math.max(1, parseInt(e.target.value, 10) || 1) } : x)))}
                          className="w-20 h-9 px-2 rounded-lg border border-[#D8D8D8] text-sm font-mono font-bold text-center disabled:bg-slate-100"
                        />
                        <span className="w-24 text-right text-sm font-extrabold">{l.medicine ? money(l.qty * l.medicine.price) : '—'}</span>
                        {mode === 'counter' && (
                          <button type="button" aria-label={`Remove ${l.name}`} onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 inline-flex items-center justify-center"><Trash2 size={15} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {lines.length === 0 && <p className="p-8 text-center text-sm font-semibold text-slate-400">{mode === 'counter' ? 'Search above to add medicines.' : 'This prescription has no medicines.'}</p>}
              </div>

              {blocking.length > 0 && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 flex flex-wrap items-center gap-2">
                  <AlertTriangle size={14} /> Untick items you can't supply, or reduce the quantity.
                  <Link to="/pharmacy/inventory" className="font-bold text-[#3683F8] inline-flex items-center gap-1"><PackagePlus size={13} /> Receive stock</Link>
                </div>
              )}
              {error && <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">{error}</div>}

              <div className="p-4 grid md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Payment</span>
                  <PaymentModePicker value={payMode} onChange={setPayMode} />
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    Discount ₹
                    <input type="number" min={0} value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" aria-label="Discount" className="w-24 h-9 px-2 rounded-lg border border-[#D8D8D8] text-sm font-mono" />
                  </label>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600 flex justify-between"><span>Subtotal ({included.length} item{included.length === 1 ? '' : 's'})</span><span className="font-bold">{money(subtotal)}</span></div>
                  {off > 0 && <div className="text-sm text-slate-600 flex justify-between"><span>Discount</span><span className="font-bold">−{money(off)}</span></div>}
                  <div className="text-lg flex justify-between font-black"><span>Total</span><span>{money(total)}</span></div>
                  <button
                    type="button"
                    onClick={checkout}
                    disabled={saving || !included.length}
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} /> {saving ? 'Saving…' : `Collect ${money(total)} & save bill`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <Modal isOpen={!!receipt} onClose={() => setReceipt(null)} title="Bill saved" className="max-w-sm">
        {receipt && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-slate-300 p-4 font-mono text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Bill</span><span className="font-bold">{receipt.billNo}</span></div>
              {receipt.rxCode && <div className="flex justify-between"><span className="text-slate-500">Rx</span><span className="font-bold">{receipt.rxCode}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-bold">{receipt.patientName}</span></div>
              <div className="border-t border-dashed border-slate-300 my-2" />
              {receipt.items.map(i => <div key={i.name} className="flex justify-between"><span>{i.name} × {i.qty}</span><span>{money(i.qty * i.price)}</span></div>)}
              {receipt.discount > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>−{money(receipt.discount)}</span></div>}
              <div className="flex justify-between font-black text-sm pt-1"><span>Total ({receipt.paymentMode})</span><span>{money(receipt.total)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => printPharmacyBill(receipt)} className="h-11 rounded-xl bg-[#3683F8] text-white font-bold text-sm inline-flex items-center justify-center gap-1.5"><Printer size={16} /> Print bill</button>
              <button type="button" onClick={() => setReceipt(null)} className="h-11 rounded-xl border border-[#D8D8D8] font-bold text-sm">Done</button>
            </div>
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
