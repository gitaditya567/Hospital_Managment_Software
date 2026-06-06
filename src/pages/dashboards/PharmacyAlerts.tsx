import React from 'react';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import type { Medicine } from '../../store/usePharmacyStore';
import { DataTable } from '../../components/ui/DataTable';
import { AlertTriangle, Calendar } from 'lucide-react';

export function PharmacyAlerts() {
  const { inventory } = usePharmacyStore();

  // Expiry View: Sort medicines by expiryDate in ascending order
  const expiryData = React.useMemo(() => {
    return [...inventory].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [inventory]);

  const columns = [
    { key: 'code', header: 'Item Code' },
    { key: 'name', header: 'Medicine Name' },
    {
      key: 'stock',
      header: 'Current Stock',
      render: (item: Medicine) => (
        <span className={`font-bold font-mono ${item.stock < item.minThreshold ? 'text-rose-600' : 'text-slate-700'}`}>
          {item.stock} Units
        </span>
      )
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (item: Medicine) => {
        const expiry = new Date(item.expiryDate);
        const daysLeft = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = daysLeft <= 0;
        const isExpiringSoon = daysLeft > 0 && daysLeft <= 30;

        return (
          <span className={`font-mono text-xs font-semibold ${
            isExpired ? 'text-rose-600 font-bold' : isExpiringSoon ? 'text-amber-600 font-bold' : 'text-slate-600'
          }`}>
            {item.expiryDate} {isExpired ? '(EXPIRED)' : isExpiringSoon ? `(Expires in ${daysLeft} days)` : ''}
          </span>
        );
      }
    },
    {
      key: 'location',
      header: 'Rack Location'
    },
    {
      key: 'action',
      header: 'Action Plan',
      render: (item: Medicine) => {
        const expiry = new Date(item.expiryDate);
        const daysLeft = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = daysLeft <= 0;
        const isExpiringSoon = daysLeft > 0 && daysLeft <= 30;

        if (isExpired) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
              ⚠️ Return to Supplier
            </span>
          );
        } else if (isExpiringSoon) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
              ⚡ Clear Stock Fast
            </span>
          );
        } else if (item.stock < item.minThreshold) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 border border-blue-200">
              ⬇️ Reorder Batch
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
              ✓ Good Health
            </span>
          );
        }
      }
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="text-rose-600 animate-bounce" /> Expiry & Stock Alert Panel
        </h1>
        <p className="text-slate-500">Monitor batch lifetimes to minimize stock wastage and financial write-offs.</p>
      </div>

      {/* Main Full-Width Expiry Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-extrabold text-slate-850 text-sm flex items-center gap-1.5">
            <Calendar size={16} className="text-blue-500" /> Batch Expiry Roster
          </h2>
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full">
            Sorted by Expiry
          </span>
        </div>

        <DataTable columns={columns} data={expiryData} className="border-0 shadow-none text-xs font-semibold text-slate-700" />
      </div>

    </div>
  );
}
