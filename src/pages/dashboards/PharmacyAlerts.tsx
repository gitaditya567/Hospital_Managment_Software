import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarX, PackageX, TrendingDown, Download, PackagePlus, CheckCircle2 } from 'lucide-react';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import type { Medicine } from '../../store/usePharmacyStore';

type Tab = 'expired' | 'expiring' | 'out' | 'low';

// Whole days from today to the expiry date (0 = expires today, negative = already expired)
const daysUntil = (ymd: string) => {
  const [y, m, d] = (ymd || '').split('-').map(Number);
  if (!y || !m || !d) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
};

export function PharmacyAlerts() {
  const { inventory } = usePharmacyStore();

  const groups = useMemo(() => {
    const withStock = inventory.filter(m => m.stock > 0);
    return {
      expired: withStock.filter(m => daysUntil(m.expiryDate) < 0).sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)),
      expiring: withStock.filter(m => { const d = daysUntil(m.expiryDate); return d >= 0 && d <= 30; }).sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)),
      out: inventory.filter(m => m.stock <= 0),
      low: inventory.filter(m => m.stock > 0 && m.stock <= m.minThreshold).sort((a, b) => a.stock / Math.max(1, a.minThreshold) - b.stock / Math.max(1, b.minThreshold))
    } as Record<Tab, Medicine[]>;
  }, [inventory]);

  const firstNonEmpty = (['expired', 'expiring', 'out', 'low'] as Tab[]).find(t => groups[t].length) || 'expired';
  const [tab, setTab] = useState<Tab | null>(null);
  const active = tab || firstNonEmpty;

  const tabs: Array<{ key: Tab; label: string; icon: typeof AlertTriangle; tone: string; action: string }> = [
    { key: 'expired', label: 'Expired', icon: CalendarX, tone: 'rose', action: 'Remove from the shelf and return to the supplier. The counter will not sell it.' },
    { key: 'expiring', label: 'Expiring in 30 days', icon: AlertTriangle, tone: 'amber', action: 'Sell these first and avoid re-ordering large quantities.' },
    { key: 'out', label: 'Out of stock', icon: PackageX, tone: 'rose', action: 'Order now — prescriptions for these cannot be billed.' },
    { key: 'low', label: 'Low stock', icon: TrendingDown, tone: 'blue', action: 'At or below the minimum level. Add to the next purchase order.' }
  ];

  // Purchase list for suppliers: everything out of stock or at/below minimum
  const downloadReorderList = () => {
    const rows = [...groups.out, ...groups.low].map(m => {
      const suggested = Math.max(m.minThreshold * 2 - m.stock, m.minThreshold);
      return [m.code, m.name, m.category, m.stock, m.minThreshold, suggested, m.price];
    });
    const csv = [['Code', 'Medicine', 'Category', 'In stock', 'Minimum', 'Suggested order qty', 'Selling price'], ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reorder-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const list = groups[active];
  const meta = tabs.find(t => t.key === active)!;
  const totalIssues = groups.expired.length + groups.expiring.length + groups.out.length + groups.low.length;

  return (
    <div className="space-y-5 font-sans pb-16">
      <div className="bg-[#3683F8] rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><AlertTriangle size={22} /> Stock alerts</h1>
          <p className="text-blue-50 text-xs font-semibold mt-1">Expired, expiring and low-stock medicines that need action.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={downloadReorderList} disabled={!groups.out.length && !groups.low.length} className="h-11 px-4 rounded-xl bg-white text-[#3683F8] font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60">
            <Download size={16} /> Reorder list (CSV)
          </button>
          <Link to="/pharmacy/inventory" className="h-11 px-4 rounded-xl border border-white/40 text-white font-bold text-sm inline-flex items-center gap-2 hover:bg-white/10">
            <PackagePlus size={16} /> Receive stock
          </Link>
        </div>
      </div>

      {totalIssues === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D8D8D8] p-10 text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
          <p className="text-sm font-bold text-slate-500 mt-3">All medicines are in stock and within date.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`text-left p-4 rounded-2xl border transition-all ${active === t.key ? 'bg-[#060606] border-[#060606] text-white' : 'bg-white border-[#D8D8D8] hover:border-slate-400'}`}
              >
                <t.icon size={18} className={active === t.key ? 'text-white' : t.tone === 'rose' ? 'text-rose-600' : t.tone === 'amber' ? 'text-amber-600' : 'text-[#3683F8]'} />
                <div className="text-2xl font-black mt-1">{groups[t.key].length}</div>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${active === t.key ? 'text-slate-300' : 'text-slate-500'}`}>{t.label}</div>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-[#D8D8D8] overflow-hidden">
            <div className="p-4 border-b border-[#D8D8D8]">
              <h2 className="text-base font-extrabold">{meta.label} ({list.length})</h2>
              <p className="text-xs text-slate-500 font-semibold">{meta.action}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EBF3FE]/60 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                  <tr><th className="px-4 py-3">Medicine</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Minimum</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Batch · Rack</th></tr>
                </thead>
                <tbody className="divide-y divide-[#D8D8D8]/60">
                  {list.map(m => {
                    const d = daysUntil(m.expiryDate);
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3"><div className="font-extrabold text-sm">{m.name}</div><div className="text-[11px] text-slate-500">{m.code} · {m.category}</div></td>
                        <td className={`px-4 py-3 font-mono font-bold ${m.stock <= m.minThreshold ? 'text-rose-600' : ''}`}>{m.stock}</td>
                        <td className="px-4 py-3 font-mono">{m.minThreshold}</td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${d < 0 ? 'text-rose-600' : d <= 30 ? 'text-amber-700' : 'text-slate-600'}`}>
                          {m.expiryDate} {d < 0 ? `(expired ${-d} day${d === -1 ? '' : 's'} ago)` : d === 0 ? '(expires today)' : d <= 30 ? `(in ${d} day${d === 1 ? '' : 's'})` : ''}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{m.batchNo} · {m.location}</td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm font-bold text-slate-400">Nothing here.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
