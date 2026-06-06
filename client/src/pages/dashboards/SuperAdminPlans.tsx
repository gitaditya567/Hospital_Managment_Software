import { useState } from 'react';
import { useSuperAdminStore, type Plan } from '../../store/useSuperAdminStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { CreditCard, HardDrive, Users, Check, AlertTriangle, Trash2, Edit, Pill } from 'lucide-react';

export function SuperAdminPlans() {
  const { plans, addPlan, updatePlan, deletePlan } = useSuperAdminStore();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState(9999);
  const [maxDoctors, setMaxDoctors] = useState(5);
  const [isUnlimitedDoctors, setIsUnlimitedDoctors] = useState(false);
  const [maxReceptionists, setMaxReceptionists] = useState(2);
  const [isUnlimitedReceptionists, setIsUnlimitedReceptionists] = useState(false);
  const [maxPharmacists, setMaxPharmacists] = useState(2);
  const [isUnlimitedPharmacists, setIsUnlimitedPharmacists] = useState(false);
  const [maxStorage, setMaxStorage] = useState(50);
  const [durationMonths, setDurationMonths] = useState(12);

  const openAddModal = () => {
    setEditingPlan(null);
    setName('');
    setPrice(9999);
    setMaxDoctors(5);
    setIsUnlimitedDoctors(false);
    setMaxReceptionists(2);
    setIsUnlimitedReceptionists(false);
    setMaxPharmacists(2);
    setIsUnlimitedPharmacists(false);
    setMaxStorage(50);
    setDurationMonths(12);
    setModalOpen(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setPrice(plan.price);
    setMaxDoctors(plan.maxDoctors === -1 ? 5 : plan.maxDoctors);
    setIsUnlimitedDoctors(plan.maxDoctors === -1);
    setMaxReceptionists(plan.maxReceptionists === -1 ? 2 : plan.maxReceptionists);
    setIsUnlimitedReceptionists(plan.maxReceptionists === -1);
    setMaxPharmacists(plan.maxPharmacists === -1 ? 2 : plan.maxPharmacists);
    setIsUnlimitedPharmacists(plan.maxPharmacists === -1);
    setMaxStorage(plan.maxStorage);
    setDurationMonths(plan.durationMonths);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMaxDoctors = isUnlimitedDoctors ? -1 : maxDoctors;
    const finalMaxReceptionists = isUnlimitedReceptionists ? -1 : maxReceptionists;
    const finalMaxPharmacists = isUnlimitedPharmacists ? -1 : maxPharmacists;

    const planData = {
      name,
      price: Number(price),
      maxDoctors: Number(finalMaxDoctors),
      maxReceptionists: Number(finalMaxReceptionists),
      maxPharmacists: Number(finalMaxPharmacists),
      maxStorage: Number(maxStorage),
      durationMonths: Number(durationMonths),
    };

    if (editingPlan) {
      updatePlan(editingPlan.id, planData);
    } else {
      addPlan(planData);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this subscription plan tier? This will not affect already activated tenants immediately, but new licenses cannot be generated with this plan.')) {
      deletePlan(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="text-blue-600" /> Subscription Plans
          </h1>
          <p className="text-slate-500">Configure SaaS pricing tiers, limits, and feature flags</p>
        </div>
        <Button onClick={openAddModal} className="h-11 px-6 text-sm font-extrabold gap-2 shadow-lg shadow-blue-500/15 flex items-center">
          <span className="text-base leading-none">+</span> Create New Tier
        </Button>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group"
          >
            {/* Header */}
            <div className="p-6 pb-0">
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full uppercase tracking-wider">
                  {plan.durationMonths === 12 ? 'Annual' : plan.durationMonths === 1 ? 'Monthly' : `${plan.durationMonths} Months`}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(plan)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-full transition-colors"
                    title="Edit Plan"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-full transition-colors"
                    title="Delete Plan"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-800 mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-slate-900">₹{plan.price.toLocaleString('en-IN')}</span>
                <span className="text-slate-400 text-sm">/ tier</span>
              </div>
            </div>

            {/* Limits & Feature Flags */}
            <div className="p-6 border-t border-slate-50 bg-slate-50/50 mt-4 space-y-4 flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Hard Database Limits</p>

              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">
                    {plan.maxDoctors === -1 ? 'Unlimited Doctors' : `Max ${plan.maxDoctors} Doctors`}
                  </p>
                  <p className="text-[10px] text-slate-400">Clinical staff slots</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">
                    {plan.maxReceptionists === -1 ? 'Unlimited Receptionists' : `Max ${plan.maxReceptionists} Receptionists`}
                  </p>
                  <p className="text-[10px] text-slate-400">Administrative accounts</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="h-8 w-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                  <Pill size={16} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">
                    {plan.maxPharmacists === -1 ? 'Unlimited Pharmacists' : `Max ${plan.maxPharmacists} Pharmacists`}
                  </p>
                  <p className="text-[10px] text-slate-400">Pharmacy & inventory slots</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <HardDrive size={16} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">{plan.maxStorage} GB Storage</p>
                  <p className="text-[10px] text-slate-400">Database and report uploads size</p>
                </div>
              </div>
            </div>

            {/* Footer Activation Note */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
              <Check size={14} className="text-emerald-500" /> Fully Onboardable via License Codes
            </div>
          </div>
        ))}
      </div>

      {/* Plan Builder Explanation */}
      <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 flex items-start gap-4">
        <AlertTriangle className="text-blue-600 mt-1 shrink-0" size={20} />
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Dynamic Feature-Flag Verification Info</h4>
          <p className="text-xs text-slate-600 leading-relaxed mt-1">
            These database limits are verified automatically at the API layer. When a hospital administrator attempts to add an administrative receptionist or doctor account, the application queries their active Tenant Plan and blocks creation if limits are exceeded. This configuration-driven monetization requires no code updates when adjustment parameters are modified here.
          </p>
        </div>
      </div>

      {/* Modal - Plan Builder Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlan ? 'Configure Subscription Tier' : 'Create Subscription Tier'}
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Plan Tier Name</label>
            <input
              type="text"
              placeholder="e.g. Basic Plan, Pro Plan, Enterprise Plus"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Base Price (INR / Year)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full h-10 pl-7 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Plan Duration</label>
              <select
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full h-10 px-3 border border-slate-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 Month (Monthly)</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (Annual)</option>
                <option value={36}>36 Months (3-Year Special)</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Configure Hard Limits (Feature Flags)</h4>

            <div className="grid grid-cols-3 gap-3">
              {/* Doctors limit */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-tight">Doctor Limit</label>
                <div className="flex flex-col gap-1.5">
                  <input
                    type="number"
                    min="1"
                    disabled={isUnlimitedDoctors}
                    value={maxDoctors}
                    onChange={(e) => setMaxDoctors(Number(e.target.value))}
                    className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs disabled:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isUnlimitedDoctors}
                      onChange={(e) => setIsUnlimitedDoctors(e.target.checked)}
                      className="rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    Unlimited
                  </label>
                </div>
              </div>

              {/* Receptionist limit */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-tight">Receptionist Limit</label>
                <div className="flex flex-col gap-1.5">
                  <input
                    type="number"
                    min="1"
                    disabled={isUnlimitedReceptionists}
                    value={maxReceptionists}
                    onChange={(e) => setMaxReceptionists(Number(e.target.value))}
                    className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs disabled:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isUnlimitedReceptionists}
                      onChange={(e) => setIsUnlimitedReceptionists(e.target.checked)}
                      className="rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    Unlimited
                  </label>
                </div>
              </div>

              {/* Pharmacist limit */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-tight">Pharmacist Limit</label>
                <div className="flex flex-col gap-1.5">
                  <input
                    type="number"
                    min="1"
                    disabled={isUnlimitedPharmacists}
                    value={maxPharmacists}
                    onChange={(e) => setMaxPharmacists(Number(e.target.value))}
                    className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs disabled:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isUnlimitedPharmacists}
                      onChange={(e) => setIsUnlimitedPharmacists(e.target.checked)}
                      className="rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    Unlimited
                  </label>
                </div>
              </div>
            </div>

            {/* Storage Limit */}
            <div className="space-y-1 mt-2">
              <label className="text-xs font-medium text-slate-600">Max Cloud Storage (GB)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  required
                  value={maxStorage}
                  onChange={(e) => setMaxStorage(Number(e.target.value))}
                  className="w-full h-9 pr-12 pl-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-xs font-semibold">GB</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingPlan ? 'Save Settings' : 'Create Pricing Plan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
