import { useMemo, useState } from 'react';
import { Wallet, Search, Download, IndianRupee, Clock, Pill, Stethoscope, Boxes, Users, CreditCard } from 'lucide-react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import { Modal } from '../../components/ui/Modal';
import { doctorTitle } from '../../lib/utils';
import { CollectFeeModal, ToastStack, useToasts } from './reception/receptionShared';
import { RangePicker, buildTransactions, downloadCsv, inRange, money, type RangeKey, type Txn } from './admin/adminReports';

type Tab = 'transactions' | 'dues' | 'patients';

export function HospitalAdminAccounts() {
  const { patients, invoices, collectPatientFee } = useHospitalStore();
  const { bills, inventory } = usePharmacyStore();
  const { toasts, push, dismiss } = useToasts();
  const [tab, setTab] = useState<Tab>('transactions');
  const [range, setRange] = useState<RangeKey>('month');
  const [kind, setKind] = useState<'all' | 'OPD' | 'Pharmacy'>('all');
  const [query, setQuery] = useState('');
  const [collect, setCollect] = useState<Txn | null>(null);
  const [person, setPerson] = useState<string | null>(null);

  const txns = useMemo(() => buildTransactions(invoices, bills, patients), [invoices, bills, patients]);
  const inR = txns.filter(t => inRange(t.date, range));
  const q = query.trim().toLowerCase();
  const matches = (t: Txn) => !q || [t.ref, t.patientName, t.patientNo, t.phone, t.doctorName, t.description].some(v => (v || '').toLowerCase().includes(q));

  const opdPaid = inR.filter(t => t.kind === 'OPD' && t.status === 'Paid').reduce((s, t) => s + t.amount, 0);
  const pharmacy = inR.filter(t => t.kind === 'Pharmacy').reduce((s, t) => s + t.amount, 0);
  const allDues = txns.filter(t => t.status === 'Pending');
  const duesTotal = allDues.reduce((s, t) => s + t.amount, 0);
  const stockValue = inventory.reduce((s, m) => s + m.stock * m.price, 0);

  const list = inR.filter(t => (kind === 'all' || t.kind === kind) && matches(t));

  // Patient ledger: one row per person (patient number, or phone + name for older records)
  const ledger = useMemo(() => {
    const keyOf = (no?: string, phone?: string, name?: string) => no || `${phone}:${(name || '').trim().toLowerCase()}`;
    const map = new Map<string, { key: string; name: string; patientNo?: string; phone: string; visits: number; opd: number; due: number; pharmacy: number; txns: Txn[] }>();
    const byPhoneName = new Map<string, string>();
    patients.forEach(p => {
      const key = keyOf(p.patientNo, p.phone, p.name);
      byPhoneName.set(`${p.phone}:${p.name.trim().toLowerCase()}`, key);
      const row = map.get(key) || { key, name: p.name, patientNo: p.patientNo, phone: p.phone, visits: 0, opd: 0, due: 0, pharmacy: 0, txns: [] };
      row.visits += 1;
      map.set(key, row);
    });
    txns.forEach(t => {
      // Older invoices carry no patient number: fall back to phone + name
      const row = (t.patientNo && map.get(t.patientNo)) || map.get(byPhoneName.get(`${t.phone}:${t.patientName.trim().toLowerCase()}`) || '');
      if (!row) return;
      row.txns.push(t);
      if (t.kind === 'OPD') { if (t.status === 'Paid') row.opd += t.amount; else row.due += t.amount; }
      else row.pharmacy += t.amount;
    });
    return [...map.values()].sort((a, b) => (b.opd + b.pharmacy) - (a.opd + a.pharmacy));
  }, [patients, txns]);
  const ledgerRows = ledger.filter(r => !q || [r.name, r.patientNo, r.phone].some(v => (v || '').toLowerCase().includes(q)));
  const selectedPerson = ledger.find(r => r.key === person) || null;

  const exportCsv = () => {
    if (tab === 'patients') {
      downloadCsv('patient-ledger.csv', ['Patient', 'Patient no', 'Phone', 'Visits', 'OPD paid', 'OPD due', 'Pharmacy', 'Total paid'],
        ledgerRows.map(r => [r.name, r.patientNo || '', r.phone, r.visits, r.opd, r.due, r.pharmacy, r.opd + r.pharmacy]));
      return;
    }
    const rows = tab === 'dues' ? allDues.filter(matches) : list;
    downloadCsv(`${tab}-${range}.csv`, ['Date', 'Type', 'Reference', 'Patient', 'Patient no', 'Phone', 'Doctor', 'Description', 'Amount', 'Status', 'Payment mode'],
      rows.map(t => [t.date ? t.date.toLocaleDateString('en-IN') : '', t.kind, t.ref, t.patientName, t.patientNo || '', t.phone, t.doctorName, t.description, t.amount, t.status, t.paymentMode]));
  };

  const row = (t: Txn, actions = false) => (
    <tr key={t.id}>
      <td className="px-4 py-3 text-slate-500 font-semibold whitespace-nowrap">{t.date ? t.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${t.kind === 'OPD' ? 'bg-[#EBF3FE] border-blue-200 text-[#3683F8]' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
          {t.kind === 'OPD' ? <Stethoscope size={11} /> : <Pill size={11} />} {t.kind}
        </span>
        <div className="font-mono text-[11px] font-bold mt-1">{t.ref}</div>
      </td>
      <td className="px-4 py-3"><div className="font-extrabold">{t.patientName}</div><div className="text-[11px] text-slate-500">{[t.patientNo, t.phone].filter(Boolean).join(' · ')}</div></td>
      <td className="px-4 py-3 text-slate-600">{t.description}{t.doctorName && <div className="text-[11px] text-slate-400">{doctorTitle(t.doctorName)}</div>}</td>
      <td className="px-4 py-3 text-right font-extrabold whitespace-nowrap">{money(t.amount)}</td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${t.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{t.status === 'Paid' ? `Paid · ${t.paymentMode}` : 'Due'}</span>
      </td>
      {actions && (
        <td className="px-4 py-3 text-right">
          <button type="button" onClick={() => setCollect(t)} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1"><CreditCard size={13} /> Record payment</button>
        </td>
      )}
    </tr>
  );

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><Wallet size={22} /> Accounts</h1>
          <p className="text-blue-50 text-xs font-semibold mt-1">Every OPD fee and pharmacy bill in one ledger, with dues and patient-wise totals.</p>
        </div>
        <button type="button" onClick={exportCsv} className="h-11 px-4 rounded-xl bg-white text-[#3683F8] font-bold text-sm inline-flex items-center gap-2"><Download size={16} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Collected (period)', value: money(opdPaid + pharmacy), icon: IndianRupee },
          { label: 'OPD fees (period)', value: money(opdPaid), icon: Stethoscope },
          { label: 'Pharmacy (period)', value: money(pharmacy), icon: Pill },
          { label: 'Fees due (all)', value: money(duesTotal), icon: Clock },
          { label: 'Stock value', value: money(stockValue), icon: Boxes }
        ].map(k => (
          <div key={k.label} className="bg-white p-4 rounded-2xl border border-[#D8D8D8] flex items-center justify-between gap-2">
            <div className="min-w-0"><p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{k.label}</p><p className="text-xl font-extrabold">{k.value}</p></div>
            <k.icon size={19} className="text-[#3683F8] shrink-0" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
        <div className="p-4 border-b border-[#D8D8D8] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {([['transactions', 'Transactions', Wallet], ['dues', `Dues (${allDues.length})`, Clock], ['patients', 'Patient ledger', Users]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`h-9 px-3 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 ${tab === k ? 'bg-[#3683F8] border-[#3683F8] text-white' : 'bg-white border-[#D8D8D8] text-slate-600'}`}><Icon size={14} /> {label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'transactions' && <RangePicker value={range} onChange={setRange} />}
            {tab === 'transactions' && (
              <select aria-label="Type" value={kind} onChange={e => setKind(e.target.value as typeof kind)} className="h-9 px-2 rounded-lg border border-[#D8D8D8] text-xs font-bold bg-white">
                <option value="all">OPD + Pharmacy</option><option value="OPD">OPD only</option><option value="Pharmacy">Pharmacy only</option>
              </select>
            )}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patient, ref, doctor" className="h-9 w-56 pl-8 pr-3 rounded-xl border border-[#D8D8D8] text-xs font-semibold focus:outline-none focus:border-[#3683F8]" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === 'patients' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EBF3FE]/60 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                <tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3 text-right">Visits</th><th className="px-4 py-3 text-right">OPD paid</th><th className="px-4 py-3 text-right">Due</th><th className="px-4 py-3 text-right">Pharmacy</th><th className="px-4 py-3 text-right">Total paid</th></tr>
              </thead>
              <tbody className="divide-y divide-[#D8D8D8]/60">
                {ledgerRows.slice(0, 300).map(r => (
                  <tr key={r.key} onClick={() => setPerson(r.key)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3"><div className="font-extrabold">{r.name}</div><div className="text-[11px] text-slate-500">{[r.patientNo, r.phone].filter(Boolean).join(' · ')}</div></td>
                    <td className="px-4 py-3 text-right font-mono">{r.visits}</td>
                    <td className="px-4 py-3 text-right font-bold">{money(r.opd)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${r.due > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{money(r.due)}</td>
                    <td className="px-4 py-3 text-right font-bold">{money(r.pharmacy)}</td>
                    <td className="px-4 py-3 text-right font-extrabold">{money(r.opd + r.pharmacy)}</td>
                  </tr>
                ))}
                {ledgerRows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-sm font-bold text-slate-400">No patients found.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EBF3FE]/60 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type · Ref</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Details</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th>{tab === 'dues' && <th className="px-4 py-3 text-right">Action</th>}</tr>
              </thead>
              <tbody className="divide-y divide-[#D8D8D8]/60">
                {(tab === 'dues' ? allDues.filter(matches) : list).slice(0, 500).map(t => row(t, tab === 'dues'))}
                {(tab === 'dues' ? allDues.filter(matches) : list).length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm font-bold text-slate-400">{tab === 'dues' ? 'No pending dues. 🎉' : 'No transactions in this period.'}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal isOpen={!!selectedPerson} onClose={() => setPerson(null)} title={selectedPerson ? `${selectedPerson.name} · ledger` : ''} className="max-w-2xl">
        {selectedPerson && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['OPD paid', selectedPerson.opd], ['Due', selectedPerson.due], ['Pharmacy', selectedPerson.pharmacy]].map(([label, v]) => (
                <div key={label as string} className="rounded-xl bg-slate-50 border border-[#D8D8D8] p-2"><div className="text-[10px] font-bold uppercase text-slate-400">{label}</div><div className="font-extrabold">{money(v as number)}</div></div>
              ))}
            </div>
            <div className="max-h-[55vh] overflow-y-auto divide-y divide-[#D8D8D8]/60 border border-[#D8D8D8] rounded-xl">
              {selectedPerson.txns.map(t => (
                <div key={t.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div><div className="font-bold">{t.kind} · {t.ref}</div><div className="text-slate-500">{t.date?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {t.description}</div></div>
                  <div className="text-right"><div className="font-extrabold">{money(t.amount)}</div><div className={t.status === 'Paid' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{t.status === 'Paid' ? t.paymentMode : 'Due'}</div></div>
                </div>
              ))}
              {selectedPerson.txns.length === 0 && <p className="p-4 text-center text-sm text-slate-400">No payments yet.</p>}
            </div>
          </div>
        )}
      </Modal>

      <CollectFeeModal
        open={!!collect}
        onClose={() => setCollect(null)}
        patientName={collect?.patientName || ''}
        amount={collect?.amount || 0}
        feeType={collect?.description || ''}
        onConfirm={async (mode) => {
          if (!collect) return;
          await collectPatientFee(collect.ref, mode);
          push('success', `${money(collect.amount)} recorded for ${collect.patientName} (${mode}).`);
          setCollect(null);
        }}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
