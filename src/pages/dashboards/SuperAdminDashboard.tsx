import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Key, IndianRupee, Activity, Gift, AlertTriangle, Phone, Mail, Plus, Copy, Check, PauseCircle, TrendingUp } from 'lucide-react';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import type { Tenant } from '../../store/useSuperAdminStore';
import { Modal } from '../../components/ui/Modal';

const REFRESH_MS = 30000;
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// Calendar days until expiry (valid through the expiry date itself)
const daysLeft = (ymd?: string) => {
  const [y, m, d] = (ymd || '').split('-').map(Number);
  if (!y) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
};

export function SuperAdminDashboard() {
  const { tenants, licenses, plans, activities, invoices, generateLicense, fetchSuperAdminData } = useSuperAdminStore();

  useEffect(() => {
    fetchSuperAdminData();
    const id = setInterval(() => { if (document.visibilityState === 'visible') fetchSuperAdminData(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchSuperAdminData]);

  const planOf = (t: Tenant) => plans.find(p => p.id === t.planId);
  const live = tenants.filter(t => t.status === 'Active' && daysLeft(t.subscriptionExpiryDate) >= 0);
  const paying = live.filter(t => !t.isTrial);
  const trials = live.filter(t => t.isTrial);
  const suspended = tenants.filter(t => t.status !== 'Active').length;
  const expired = tenants.filter(t => t.status === 'Active' && daysLeft(t.subscriptionExpiryDate) < 0);

  // Monthly recurring revenue from paying hospitals only (trials pay nothing)
  const mrr = paying.reduce((s, t) => {
    const p = planOf(t);
    return p && p.durationMonths > 0 ? s + p.price / p.durationMonths : s;
  }, 0);

  const unusedLicenses = licenses.filter(l => !l.isUsed && l.status !== 'Expired').length;

  // Follow-up list: trials ending in ≤7 days, and paid plans expiring in ≤30 days or already expired
  const followUps = useMemo(() => [
    ...trials.filter(t => daysLeft(t.subscriptionExpiryDate) <= 7).map(t => ({ t, reason: 'Trial ending' as const })),
    ...paying.filter(t => daysLeft(t.subscriptionExpiryDate) <= 30).map(t => ({ t, reason: 'Renewal due' as const })),
    ...expired.map(t => ({ t, reason: 'Expired' as const }))
  ].sort((a, b) => daysLeft(a.t.subscriptionExpiryDate) - daysLeft(b.t.subscriptionExpiryDate)), [trials, paying, expired]);

  // Subscription money actually received in each of the last 12 months
  const months = useMemo(() => {
    const now = new Date();
    const list = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), revenue: 0, signups: 0 };
    });
    const idx = new Map(list.map((m, i) => [m.key, i]));
    invoices.forEach(inv => {
      if (inv.status !== 'Paid' || !inv.date) return;
      const i = idx.get(inv.date.slice(0, 7));
      if (i !== undefined) list[i].revenue += inv.amount;
    });
    tenants.forEach(t => {
      if (!t.createdAt) return;
      const d = new Date(t.createdAt);
      const i = idx.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      if (i !== undefined) list[i].signups += 1;
    });
    return list;
  }, [invoices, tenants]);
  const maxRev = Math.max(1, ...months.map(m => m.revenue));
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const thisYear = months.slice(-12).reduce((s, m) => s + m.revenue, 0);

  // License generator
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [planId, setPlanId] = useState('');
  const [validity, setValidity] = useState(12);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!planId && plans[0]) setPlanId(plans[0].id); }, [plans, planId]);
  const generate = async () => setCode(await generateLicense(planId, validity));
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Platform overview</h1>
          <p className="text-blue-50 text-xs font-semibold mt-1">Hospitals, trials, renewals and subscription revenue.</p>
        </div>
        <button type="button" onClick={() => { setCode(''); setLicenseOpen(true); }} className="h-11 px-5 rounded-xl bg-white text-[#3683F8] font-extrabold text-sm inline-flex items-center gap-2"><Plus size={17} /> Generate license key</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Paying hospitals', value: paying.length, icon: Building2 },
          { label: 'Free trials', value: trials.length, icon: Gift },
          { label: 'MRR (paying)', value: money(mrr), icon: IndianRupee },
          { label: 'Received (12 mo)', value: money(thisYear), icon: TrendingUp },
          { label: 'Unused licenses', value: unusedLicenses, icon: Key },
          { label: 'Expired / suspended', value: expired.length + suspended, icon: PauseCircle }
        ].map(k => (
          <div key={k.label} className="bg-white p-4 rounded-2xl border border-[#D8D8D8] flex items-center justify-between gap-2">
            <div className="min-w-0"><p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{k.label}</p><p className="text-xl font-extrabold">{k.value}</p></div>
            <k.icon size={19} className="text-[#3683F8] shrink-0" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#D8D8D8] p-5">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-extrabold">Subscription revenue received</h2>
              <p className="text-xs text-slate-500 font-semibold">Paid subscription invoices per month, last 12 months.</p>
            </div>
            <button type="button" onClick={() => setAsTable(!asTable)} className="text-[11px] font-bold text-[#3683F8] shrink-0">{asTable ? 'View as chart' : 'View as table'}</button>
          </div>
          {asTable ? (
            <table className="w-full text-xs">
              <thead className="text-slate-500 text-[10px] uppercase"><tr><th className="text-left py-1">Month</th><th className="text-right">Revenue</th><th className="text-right">New hospitals</th></tr></thead>
              <tbody>{months.map(m => <tr key={m.key} className="border-t border-slate-100"><td className="py-1">{m.label}</td><td className="text-right font-bold">{money(m.revenue)}</td><td className="text-right">{m.signups}</td></tr>)}</tbody>
            </table>
          ) : (
            <div className="relative" onMouseLeave={() => setHover(null)}>
              <div className="flex items-end gap-[2px] h-44 border-b border-slate-200">
                {months.map((m, i) => (
                  <div key={m.key} className="relative flex-1 h-full flex flex-col justify-end" onMouseEnter={() => setHover(i)} tabIndex={0} onFocus={() => setHover(i)} aria-label={`${m.label}: ${money(m.revenue)}, ${m.signups} new hospitals`}>
                    {hover === i && <div className="absolute inset-0 bg-slate-100/70 rounded" />}
                    {m.revenue > 0 && <div className="relative rounded-t-[4px] bg-[#3683F8]" style={{ height: `${(m.revenue / maxRev) * 100}%` }} />}
                  </div>
                ))}
              </div>
              <div className="flex mt-1">{months.map((m, i) => <div key={m.key} className="flex-1 text-center text-[10px] font-semibold text-slate-400">{i % 2 === 1 ? m.label : ''}</div>)}</div>
              {hover !== null && (
                <div className="absolute top-0 bg-white border border-[#D8D8D8] rounded-xl shadow-lg px-3 py-2 text-xs pointer-events-none" style={{ left: `${Math.min(75, (hover / 11) * 100)}%` }}>
                  <div className="font-bold">{months[hover].label}</div>
                  <div>Revenue <span className="font-extrabold">{money(months[hover].revenue)}</span></div>
                  <div>New hospitals <span className="font-extrabold">{months[hover].signups}</span></div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
          <div className="p-5 border-b border-[#D8D8D8]">
            <h2 className="text-base font-extrabold flex items-center gap-2"><AlertTriangle size={17} className="text-amber-600" /> Follow up ({followUps.length})</h2>
            <p className="text-xs text-slate-500 font-semibold">Trials ending within 7 days, renewals due within 30 days, and expired plans.</p>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-[#D8D8D8]/70">
            {followUps.map(({ t, reason }) => {
              const d = daysLeft(t.subscriptionExpiryDate);
              return (
                <div key={t.id} className="p-4 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold truncate">{t.hospitalName}</span>
                    <span className={`shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${reason === 'Expired' ? 'bg-rose-50 text-rose-700' : reason === 'Trial ending' ? 'bg-amber-50 text-amber-700' : 'bg-[#EBF3FE] text-[#3683F8]'}`}>
                      {reason} · {d < 0 ? `${-d}d ago` : d === 0 ? 'today' : `in ${d}d`}
                    </span>
                  </div>
                  <div className="text-slate-500 font-semibold">{planOf(t)?.name || t.planId} · expires {t.subscriptionExpiryDate}</div>
                  <div className="flex flex-wrap gap-3 text-slate-600 font-semibold">
                    <a href={`mailto:${t.adminEmail}`} className="inline-flex items-center gap-1 hover:text-[#3683F8]"><Mail size={12} /> {t.adminEmail}</a>
                    {t.adminPhone && <a href={`tel:${t.adminPhone}`} className="inline-flex items-center gap-1 hover:text-[#3683F8]"><Phone size={12} /> {t.adminPhone}</a>}
                  </div>
                </div>
              );
            })}
            {followUps.length === 0 && <p className="p-8 text-center text-sm font-semibold text-slate-400">Nothing needs attention right now.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
        <div className="p-5 border-b border-[#D8D8D8] flex items-center justify-between">
          <h2 className="text-base font-extrabold flex items-center gap-2"><Activity size={17} className="text-[#3683F8]" /> Recent activity</h2>
          <Link to="/super-admin/hospitals" className="text-xs font-bold text-[#3683F8]">All hospitals →</Link>
        </div>
        <div className="divide-y divide-[#D8D8D8]/60">
          {activities.slice(0, 8).map(a => (
            <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-700">{a.description}</span>
              <span className="text-slate-400 shrink-0">{new Date(a.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
          {activities.length === 0 && <p className="p-8 text-center text-sm font-semibold text-slate-400">No activity yet.</p>}
        </div>
      </div>

      <Modal isOpen={licenseOpen} onClose={() => setLicenseOpen(false)} title="Generate license key" className="max-w-sm">
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Plan</span>
            <select aria-label="Plan" value={planId} onChange={e => setPlanId(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm font-semibold bg-white">
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} · ₹{p.price.toLocaleString('en-IN')}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Validity</span>
            <select aria-label="Validity" value={validity} onChange={e => setValidity(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-[#D8D8D8] text-sm font-semibold bg-white">
              {[1, 3, 6, 12, 24, 36].map(n => <option key={n} value={n}>{n} month{n === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          {!code ? (
            <button type="button" onClick={generate} disabled={!planId} className="w-full h-11 rounded-xl bg-[#3683F8] text-white font-bold text-sm disabled:opacity-50">Generate key</button>
          ) : (
            <div className="rounded-xl border border-[#D8D8D8] bg-slate-50 p-4 text-center space-y-3">
              <div className="font-mono text-lg font-bold select-all break-all">{code}</div>
              <button type="button" onClick={copy} className="h-10 px-4 rounded-xl border border-[#D8D8D8] bg-white text-xs font-bold inline-flex items-center gap-1.5">{copied ? <><Check size={14} className="text-emerald-500" /> Copied</> : <><Copy size={14} /> Copy key</>}</button>
              <p className="text-[11px] text-slate-500">Send this key to the hospital after payment. They enter it under Plan &amp; Billing (or at registration).</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
