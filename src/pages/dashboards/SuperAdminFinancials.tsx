import { useState } from 'react';
import { useSuperAdminStore, type Invoice } from '../../store/useSuperAdminStore';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable } from '../../components/ui/DataTable';
import { CircleDollarSign, TrendingUp, CreditCard } from 'lucide-react';

export function SuperAdminFinancials() {
  const { invoices, plans, tenants } = useSuperAdminStore();
  const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'pending' | 'failed'>('all');


  // 1. Calculate Live financial totals
  const liveMRR = tenants.reduce((acc, tenant) => {
    if (tenant.status !== 'Active') return acc;
    const plan = plans.find(p => p.id === tenant.planId);
    if (!plan) return acc;
    return acc + (plan.price / plan.durationMonths);
  }, 0);

  const liveARR = liveMRR * 12;

  const pendingAmount = invoices.reduce((acc, inv) => {
    if (inv.status === 'Pending') return acc + inv.amount;
    return acc;
  }, 0);

  // Filter invoices by tab
  const filteredInvoices = invoices.filter(inv => {
    if (activeTab === 'paid') return inv.status === 'Paid';
    if (activeTab === 'pending') return inv.status === 'Pending';
    if (activeTab === 'failed') return inv.status === 'Failed';
    return true;
  });



  const columns = [
    {
      key: 'id',
      header: 'Invoice ID',
      render: (item: Invoice) => (
        <span className="font-mono text-slate-500 font-bold text-xs">{item.id}</span>
      )
    },
    {
      key: 'hospitalName',
      header: 'Tenant Name',
      render: (item: Invoice) => (
        <span className="font-semibold text-slate-800 text-xs">{item.hospitalName}</span>
      )
    },
    {
      key: 'planName',
      header: 'Billing Plan',
      render: (item: Invoice) => (
        <span className="text-slate-600 text-xs font-semibold">{item.planName}</span>
      )
    },
    {
      key: 'amount',
      header: 'Amount Paid',
      render: (item: Invoice) => (
        <span className="font-bold text-slate-800 text-xs">₹{item.amount.toLocaleString('en-IN')}</span>
      )
    },
    {
      key: 'date',
      header: 'Txn Date',
      render: (item: Invoice) => (
        <span className="text-slate-550 text-xs font-bold">{item.date}</span>
      )
    },
    {
      key: 'method',
      header: 'Payment Source',
      render: (item: Invoice) => (
        <span className="px-2.5 py-0.5 bg-teal-50/50 text-teal-700 font-extrabold text-[9px] rounded-lg border border-teal-100/50 uppercase tracking-wider">
          {item.method}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Invoice) => {
        const styles = {
          Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
          Pending: 'bg-amber-50 text-amber-700 border-amber-200/60',
          Failed: 'bg-rose-50 text-rose-700 border-rose-200/60 font-semibold'
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${styles[item.status]}`}>
            {item.status}
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-500 p-6 rounded-2xl border border-teal-500/20 text-white shadow-lg shadow-teal-500/5 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="z-10">
          <h1 className="text-2xl font-black tracking-tight text-glow-teal flex items-center gap-2 text-white">
            <CircleDollarSign className="text-teal-100 animate-pulse" /> Financials & Payments
          </h1>
          <p className="text-teal-50 text-xs mt-1">Inspect platform billing logs, transaction tables and automated gateways integration</p>
        </div>
      </div>

      {/* Live Financial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Estimated ARR"
          value={`₹${Math.round(liveARR).toLocaleString('en-IN')}`}
          icon={<TrendingUp size={22} className="text-teal-600" />}
          trend="Calculated (MRR * 12)"
          trendUp={true}
          className="border-teal-100/50 hover:shadow-md hover:border-teal-200 transition-all duration-200"
        />
        <StatCard
          title="Monthly Recurring Revenue (MRR)"
          value={`₹${Math.round(liveMRR).toLocaleString('en-IN')}`}
          icon={<CircleDollarSign size={22} className="text-teal-600" />}
          trend="Dynamic tenant count scale"
          trendUp={true}
          className="border-teal-100/50 hover:shadow-md hover:border-teal-200 transition-all duration-200"
        />
        <StatCard
          title="Pending / Failed Invoices"
          value={`₹${pendingAmount.toLocaleString('en-IN')}`}
          icon={<CreditCard size={22} className="text-amber-600" />}
          trend="Awaiting invoice clearing"
          trendUp={false}
          className="border-amber-100 bg-amber-50/20 hover:shadow-md transition-all duration-200"
        />
      </div>

      {/* Invoices List view */}
      <div className="glass-card rounded-2xl border border-teal-100/50 shadow-[0_8px_30px_rgba(13,148,136,0.02)] overflow-hidden bg-white/40">
        {/* Table header with tabs */}
        <div className="px-6 py-4 border-b border-teal-50 bg-teal-50/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-800 text-glow-teal">SaaS Transaction History</h2>

          <div className="flex bg-slate-100/70 p-1 rounded-xl border border-slate-200/80 w-fit text-xs font-bold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md transition-all duration-200 ${activeTab === 'all' ? 'bg-white text-teal-700 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`px-3 py-1.5 rounded-md transition-all duration-200 ${activeTab === 'paid' ? 'bg-white text-emerald-700 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Paid
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-md transition-all duration-200 ${activeTab === 'pending' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Pending
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={`px-3 py-1.5 rounded-md transition-all duration-200 ${activeTab === 'failed' ? 'bg-white text-rose-700 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Failed
            </button>
          </div>
        </div>

        <DataTable columns={columns} data={filteredInvoices} className="border-0 shadow-none rounded-none bg-transparent text-xs font-semibold text-slate-700" />
      </div>
    </div>
  );
}
