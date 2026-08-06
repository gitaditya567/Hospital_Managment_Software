import { useState, useEffect } from 'react';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Building2, Key, IndianRupee, ShieldAlert, Activity, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SuperAdminDashboard() {
  const { tenants, licenses, plans, activities, invoices, generateLicense, fetchSuperAdminData } = useSuperAdminStore();
  const navigate = useNavigate();
  const [isLicenseModalOpen, setLicenseModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || '');
  const [validityPeriod, setValidityPeriod] = useState(12); // months
  const [generatedCode, setGeneratedCode] = useState('');

  // Real-time live polling sync for SaaS Activities, Invoices and Telemetry
  useEffect(() => {
    fetchSuperAdminData();

    // Fetch live updates every 5 seconds
    const interval = setInterval(() => {
      fetchSuperAdminData();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchSuperAdminData]);

  // 1. Calculate Live KPIs
  const activeHospitalsCount = tenants.filter(t => t.status === 'Active').length;
  const pendingLicensesCount = licenses.filter(l => !l.isUsed).length;

  const expiringSoonCount = tenants.filter(t => {
    const diffTime = new Date(t.subscriptionExpiryDate).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 30;
  }).length;

  // MRR calculation based on active tenants and plan pricing
  const liveMRR = tenants.reduce((acc, tenant) => {
    if (tenant.status !== 'Active') return acc;
    const plan = plans.find(p => p.id === tenant.planId);
    if (!plan) return acc;
    const monthlyPrice = plan.price / plan.durationMonths;
    return acc + monthlyPrice;
  }, 0);

  // Recent activity formatted for table
  const recentActivities = activities.slice(0, 5);

  const handleGenerate = async () => {
    const code = await generateLicense(selectedPlanId, validityPeriod);
    setGeneratedCode(code);
  };

  const handleCloseModal = () => {
    setLicenseModalOpen(false);
    setGeneratedCode('');
  };

  // 2. Dynamic Real Telemetry computation for 12 months chart
  const now = new Date();
  const months: string[] = [];
  const monthKeys: Array<{ year: number; month: number }> = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const yearShort = d.getFullYear().toString().slice(-2);
    months.push(`${monthName} ${yearShort}`);
    monthKeys.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  // Calculate real active clinics count per month
  const realClinicPoints = monthKeys.map(mk => {
    return tenants.filter(t => {
      if (!t.createdAt) return t.status === 'Active';
      const created = new Date(t.createdAt);
      return created.getFullYear() < mk.year || (created.getFullYear() === mk.year && created.getMonth() <= mk.month);
    }).length;
  });

  // Aggregate paid invoices revenue per month
  const monthlyInvoicesRevenue = new Array(12).fill(0);
  (invoices || []).forEach(inv => {
    if (inv.status === 'Paid' && inv.date) {
      const d = new Date(inv.date);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = d.getMonth();
        const idx = monthKeys.findIndex(mk => mk.year === y && mk.month === m);
        if (idx !== -1) {
          monthlyInvoicesRevenue[idx] += inv.amount;
        }
      }
    }
  });

  // Calculate MRR per month (in ₹ Thousands)
  let cumulativeInvoiceRev = 0;
  const realMRRPoints = months.map((_, idx) => {
    cumulativeInvoiceRev += monthlyInvoicesRevenue[idx];
    const hospitalCountForMonth = realClinicPoints[idx];
    const currentActiveMRR = (liveMRR / 1000) * (hospitalCountForMonth > 0 ? (hospitalCountForMonth / Math.max(activeHospitalsCount, 1)) : 0);
    return Math.max(currentActiveMRR, (cumulativeInvoiceRev / 1000));
  });

  // Dynamic scaling math:
  const maxMRR = Math.max(...realMRRPoints, 10);
  const maxClinics = Math.max(...realClinicPoints, 5);

  // Generate SVG coordinates for lines
  const pointsMRR = realMRRPoints.map((val, idx) => {
    const x = 10 + idx * 62;
    const y = 220 - ((val / maxMRR) * 170);
    return { x, y };
  });

  const pointsClinics = realClinicPoints.map((val, idx) => {
    const x = 10 + idx * 62;
    const y = 220 - ((val / maxClinics) * 170);
    return { x, y };
  });

  // SVG Area Path for MRR Fill:
  const mrrAreaPath = `M 10 220 L ${pointsMRR.map(p => `${p.x} ${p.y}`).join(' L ')} L 690 220 Z`;
  // SVG Line Path for MRR:
  const mrrLinePath = `M ${pointsMRR.map(p => `${p.x} ${p.y}`).join(' L ')}`;
  // SVG Line Path for Clinics:
  const clinicsLinePath = `M ${pointsClinics.map(p => `${p.x} ${p.y}`).join(' L ')}`;

  // Last points coordinates
  const lastMRRPoint = pointsMRR[pointsMRR.length - 1];
  const lastClinicPoint = pointsClinics[pointsClinics.length - 1];

  return (
    <div className="space-y-6 font-sans">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#3683F8] p-6 rounded-2xl border border-blue-400/30 text-white shadow-lg shadow-[#3683F8]/10 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-white/10 rounded-full blur-3xl -z-0 pointer-events-none"></div>
        <div className="z-10">
          <h1 className="text-2xl font-black tracking-tight text-white">SaaS Central Command</h1>
          <p className="text-blue-100 text-xs mt-1">Multi-tenant hospital directory, secure manual licenses & platform telemetry</p>
        </div>
        <div className="flex gap-2.5 shrink-0 z-10">
          <Button
            onClick={() => setLicenseModalOpen(true)}
            className="bg-white hover:bg-blue-50 text-[#3683F8] border-0 shadow-md text-sm font-extrabold h-11 px-5 rounded-full"
          >
            + Generate License
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/super-admin/hospitals')}
            className="bg-transparent border-white/40 text-white hover:bg-white/10 text-sm font-extrabold h-11 px-5 rounded-full"
          >
            Manage Hospitals & Clinics
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Monthly Recurring Revenue (MRR)"
          value={`₹${Math.round(liveMRR).toLocaleString('en-IN')}`}
          icon={<IndianRupee size={22} className="text-[#3683F8]" />}
          trend="Live database telemetry"
          trendUp={true}
          className="border-[#D8D8D8] hover:shadow-md hover:border-[#3683F8] transition-all duration-200 bg-white"
        />
        <StatCard
          title="Total Active Hospitals"
          value={activeHospitalsCount}
          icon={<Building2 size={22} className="text-[#3683F8]" />}
          trend={`${tenants.length} registered total`}
          trendUp={true}
          className="border-[#D8D8D8] hover:shadow-md hover:border-[#3683F8] transition-all duration-200 bg-white"
        />
        <StatCard
          title="Licenses Pending Activation"
          value={pendingLicensesCount}
          icon={<Key size={22} className="text-[#3683F8]" />}
          trend="Generated but unused"
          trendUp={false}
          className="border-[#D8D8D8] hover:shadow-md hover:border-[#3683F8] transition-all duration-200 bg-white"
        />
        <StatCard
          title="Expiring Soon (30 Days)"
          value={expiringSoonCount}
          icon={<ShieldAlert size={22} className={expiringSoonCount > 0 ? "text-rose-500" : "text-[#3683F8]"} />}
          trend={expiringSoonCount > 0 ? "Requires billing alert" : "All plans active"}
          trendUp={false}
          className={expiringSoonCount > 0 ? "border-rose-200 bg-rose-50/40 hover:shadow-md transition-all duration-200" : "border-[#D8D8D8] hover:shadow-md hover:border-[#3683F8] transition-all duration-200 bg-white"}
        />
      </div>

      {/* Middle Section: Chart */}
      <div className="grid grid-cols-1 gap-6">
        {/* SVG Chart Card */}
        <div className="glass-card rounded-2xl border border-[#D8D8D8] p-6 shadow-xs bg-white">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-bold text-[#060606]">SaaS Growth Telemetry</h2>
              <p className="text-xs text-slate-500">Month-over-month MRR growth & new clinic onboarding log</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-[#3683F8]">
                <span className="w-2.5 h-2.5 bg-[#3683F8] rounded-full inline-block"></span>
                MRR (₹ Thousands)
              </div>
              <div className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 bg-blue-400 rounded-full inline-block"></span>
                Hospitals Added
              </div>
            </div>
          </div>

          {/* SVG Line Graph */}
          <div className="h-64 w-full relative">
            <svg viewBox="0 0 700 240" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="chartGradientBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3683F8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3683F8" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="40" x2="700" y2="40" stroke="#EBF3FE" strokeWidth="1" strokeDasharray="3" />
              <line x1="0" y1="100" x2="700" y2="100" stroke="#EBF3FE" strokeWidth="1" strokeDasharray="3" />
              <line x1="0" y1="160" x2="700" y2="160" stroke="#EBF3FE" strokeWidth="1" strokeDasharray="3" />
              <line x1="0" y1="220" x2="700" y2="220" stroke="#D8D8D8" strokeWidth="1" />

              {/* MRR Area Fill */}
              <path
                d={mrrAreaPath}
                fill="url(#chartGradientBlue)"
              />

              {/* MRR Line */}
              <path
                d={mrrLinePath}
                fill="none"
                stroke="#3683F8"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Onboarding Line */}
              <path
                d={clinicsLinePath}
                fill="none"
                stroke="#60A5FA"
                strokeWidth="2"
                strokeDasharray="4"
                strokeLinecap="round"
              />

              {/* Data points */}
              <circle cx={lastMRRPoint.x} cy={lastMRRPoint.y} r="5" fill="#3683F8" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx={lastClinicPoint.x} cy={lastClinicPoint.y} r="4" fill="#60A5FA" stroke="#FFFFFF" strokeWidth="1.5" />

              {/* X Axis Labels */}
              {months.map((m, idx) => {
                const xVal = 10 + idx * 62;
                return (
                  <text
                    key={m}
                    x={xVal}
                    y="238"
                    fill="#64748B"
                    fontSize="9.5"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {m}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Activity Table */}
      <div className="glass-card rounded-2xl border border-[#D8D8D8] shadow-xs overflow-hidden bg-white">
        <div className="p-6 border-b border-[#D8D8D8] bg-[#EBF3FE]/40 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#060606]">SaaS Activity Log</h2>
            <p className="text-xs text-slate-500">Latest platform security, licensing updates and registration notifications</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/super-admin/financials')}
            className="flex items-center gap-1.5 border-[#D8D8D8] text-[#3683F8] hover:bg-[#EBF3FE] text-xs font-semibold"
          >
            Audit Logs <ChevronRight size={14} />
          </Button>
        </div>

        <div className="divide-y divide-[#D8D8D8]/50">
          {recentActivities.map((act) => (
            <div key={act.id} className="p-4 hover:bg-[#EBF3FE]/30 transition-colors flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                  act.type === 'license' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                  act.type === 'payment' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                  act.type === 'hospital' ? 'bg-blue-50 text-[#3683F8] border border-blue-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {act.type === 'license' ? <Key size={16} /> :
                    act.type === 'payment' ? <IndianRupee size={16} /> :
                      act.type === 'hospital' ? <Building2 size={16} /> : <Activity size={16} />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#060606]">{act.description}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{new Date(act.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                act.type === 'license' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                act.type === 'payment' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                act.type === 'hospital' ? 'bg-blue-50 text-[#3683F8] border border-blue-200' : 'bg-slate-100 text-slate-700'
              }`}>
                {act.type}
              </span>
            </div>
          ))}
          {recentActivities.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              No recent SaaS operational activities logs.
            </div>
          )}
        </div>
      </div>

      {/* Modal - License Code Generator */}
      <Modal isOpen={isLicenseModalOpen} onClose={handleCloseModal} title="Generate License Key">
        <div className="space-y-4">
          <div className="space-y-1 w-full">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign Subscription Plan</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[#D8D8D8] bg-white px-3 py-2 text-sm text-[#060606] focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] transition-all"
            >
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} (₹{p.price.toLocaleString('en-IN')}/tier)</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 w-full">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Validity Duration (Months)</label>
            <select
              value={validityPeriod}
              onChange={(e) => setValidityPeriod(Number(e.target.value))}
              className="flex h-10 w-full rounded-lg border border-[#D8D8D8] bg-white px-3 py-2 text-sm text-[#060606] focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] transition-all"
            >
              <option value={1}>1 Month</option>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months (1 Year)</option>
              <option value={24}>24 Months (2 Years)</option>
              <option value={36}>36 Months (3 Years)</option>
            </select>
          </div>

          {!generatedCode ? (
            <Button onClick={handleGenerate} className="w-full mt-4 bg-[#3683F8] hover:bg-blue-600 text-white shadow-md">
              Compile & Generate Code
            </Button>
          ) : (
            <div className="mt-4 p-5 bg-[#EBF3FE]/40 border border-[#D8D8D8] rounded-xl text-center animate-in zoom-in-95">
              <p className="text-xs text-slate-500 mb-1">Generated License String</p>
              <div className="text-xl font-mono font-bold tracking-wider text-[#060606] mb-3 select-all bg-white p-2 rounded border border-[#D8D8D8]">
                {generatedCode}
              </div>
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2 border-[#D8D8D8] text-xs text-[#060606] hover:bg-white"
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode);
                  alert('Copied to clipboard successfully!');
                }}
              >
                Copy to Clipboard
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
