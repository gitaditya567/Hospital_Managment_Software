import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdminStore, type LicenseCode } from '../../store/useSuperAdminStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Key, AlertTriangle, Trash2, ShieldX, Clipboard, FileSpreadsheet, Plus, X } from 'lucide-react';

export function SuperAdminLicenses() {
  const navigate = useNavigate();
  const {
    licenses,
    plans,
    tenants,
    searchQuery,
    generateLicense,
    revokeLicense,
    deleteLicense,
    deletePlan
  } = useSuperAdminStore();

  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || '');
  const [validityMonths, setValidityMonths] = useState(12);
  const [isCustomValidity, setIsCustomValidity] = useState(false);
  const [customMonthsInput, setCustomMonthsInput] = useState(18);
  const [newCodeGenerated, setNewCodeGenerated] = useState('');

  // Auto sync selectedPlanId when plans populate from MongoDB
  useEffect(() => {
    if (!selectedPlanId && plans.length > 0) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const handlePlanSelectChange = (val: string) => {
    if (val === 'ADD_NEW_PLAN') {
      navigate('/super-admin/plans');
      return;
    }
    setSelectedPlanId(val);
  };

  const handleValiditySelectChange = (val: string) => {
    if (val === 'CUSTOM') {
      setIsCustomValidity(true);
    } else {
      setIsCustomValidity(false);
      setValidityMonths(Number(val));
    }
  };

  const handleDeleteSelectedPlan = () => {
    if (!selectedPlanId) return;
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    if (confirm(`Are you sure you want to delete the plan tier "${plan.name}"?`)) {
      deletePlan(selectedPlanId);
      const remaining = plans.filter(p => p.id !== selectedPlanId);
      if (remaining.length > 0) {
        setSelectedPlanId(remaining[0].id);
      } else {
        setSelectedPlanId('');
      }
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPlan = selectedPlanId || plans[0]?.id || 'plan-pro';
    const finalMonths = isCustomValidity ? Number(customMonthsInput) : Number(validityMonths);
    const code = await generateLicense(targetPlan, finalMonths);
    setNewCodeGenerated(code);
  };

  const handleClose = () => {
    setModalOpen(false);
    setNewCodeGenerated('');
    setIsCustomValidity(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Copied: ${code}`);
  };

  // License Audit Report CSV Data Export
  const exportLicenseReport = () => {
    if (licenses.length === 0) {
      alert('No license telemetry records available to export.');
      return;
    }

    const headers = ['License Code', 'Plan Name', 'Validity (Months)', 'Status', 'Is Used', 'Assigned Hospital / Clinic', 'Created Date'];
    const rows = licenses.map(lic => {
      const plan = plans.find(p => p.id === lic.planId);
      const tenant = lic.activatedByHospitalId ? tenants.find(t => t.id === lic.activatedByHospitalId) : null;
      return [
        `"${lic.code}"`,
        `"${plan?.name || lic.planId}"`,
        lic.validityMonths,
        `"${lic.status}"`,
        lic.isUsed ? 'Yes' : 'No',
        `"${tenant?.hospitalName || 'Unassigned'}"`,
        `"${lic.createdAt || ''}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smarthospital_licenses_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Filter licenses based on Global Search in Topbar
  const filteredLicenses = licenses.filter(lic => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const planName = plans.find(p => p.id === lic.planId)?.name.toLowerCase() || '';
    const hospitalName = lic.activatedByHospitalId
      ? tenants.find(t => t.id === lic.activatedByHospitalId)?.hospitalName.toLowerCase() || ''
      : '';

    return lic.code.toLowerCase().includes(query) ||
      planName.includes(query) ||
      hospitalName.includes(query);
  });

  const columns = [
    {
      key: 'code',
      header: 'License Code',
      render: (item: LicenseCode) => (
        <div className="flex items-center gap-2 font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg w-fit text-xs">
          <span>{item.code}</span>
          <button
            onClick={() => copyCode(item.code)}
            className="text-slate-400 hover:text-teal-600 transition-colors"
            title="Copy Code"
          >
            <Clipboard size={13} />
          </button>
        </div>
      )
    },
    {
      key: 'planId',
      header: 'Plan Type',
      render: (item: LicenseCode) => {
        const plan = plans.find(p => p.id === item.planId);
        return (
          <div>
            <span className="font-semibold text-slate-700 text-xs">{plan?.name || 'Unknown Plan'}</span>
            <span className="block text-[10px] text-slate-400">{item.validityMonths} Months Validity</span>
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'License Status',
      render: (item: LicenseCode) => {
        const styles = {
          Unused: 'bg-amber-50 text-amber-700 border-amber-200',
          Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          Expired: 'bg-rose-50 text-rose-700 border-rose-200'
        };
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[item.status]}`}>
            {item.status}
          </span>
        );
      }
    },
    {
      key: 'activatedByHospitalId',
      header: 'Assigned Hospital / Clinic',
      render: (item: LicenseCode) => {
        if (!item.isUsed || !item.activatedByHospitalId) {
          return <span className="text-slate-400 italic text-xs">Unassigned (Unused)</span>;
        }
        const tenant = tenants.find(t => t.id === item.activatedByHospitalId);
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-medium text-slate-700">{tenant?.hospitalName || 'Unknown Hospital'}</span>
            <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded">
              ID: {item.activatedByHospitalId}
            </span>
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Administration Actions',
      render: (item: LicenseCode) => (
        <div className="flex items-center gap-1">
          {item.status === 'Active' && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm(`CRITICAL: Revoking license ${item.code} will immediately suspend the associated hospital and cut off login access for all their doctors, receptionist and clinical staff. Proceed?`)) {
                  revokeLicense(item.code);
                }
              }}
              className="h-8 py-0 px-2 text-[11px] font-semibold border-rose-200 hover:border-rose-500 text-rose-600 hover:bg-rose-50 flex items-center gap-1"
            >
              <ShieldX size={13} /> Revoke / Suspend
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Permanently delete this license record from the MongoDB store?')) {
                deleteLicense(item.code);
              }
            }}
            className="h-8 w-8 p-0 border-slate-200 hover:border-slate-400 text-slate-400 hover:text-slate-600 flex items-center justify-center"
            title="Delete Record"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#060606] flex items-center gap-2">
            <Key className="text-[#3683F8]" /> License Management & Telemetry
          </h1>
          <p className="text-slate-500">Generate sequential HMS series license keys (HMS/2026/001) & export telemetry reports</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={exportLicenseReport}
            className="h-11 px-4 text-xs font-bold gap-1.5 border-[#D8D8D8] hover:border-slate-300 text-[#060606] bg-white shadow-xs flex items-center rounded-xl"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" /> Export License Report
          </Button>
          <Button onClick={() => setModalOpen(true)} className="h-11 px-5 text-sm font-extrabold gap-2 shadow-md flex items-center bg-[#3683F8] hover:bg-blue-600 text-white rounded-xl">
            <Plus size={18} /> Generate New License
          </Button>
        </div>
      </div>

      {searchQuery && (
        <div className="bg-[#EBF3FE] border border-[#D8D8D8] p-3.5 rounded-xl text-xs text-[#3683F8] flex items-center justify-between">
          <span>Filtering codes by global topbar query: <strong>"{searchQuery}"</strong></span>
          <span className="font-semibold">{filteredLicenses.length} matches found</span>
        </div>
      )}

      {/* Licenses Table */}
      <div className="bg-white rounded-2xl border border-[#D8D8D8] shadow-xs overflow-hidden">
        <DataTable columns={columns} data={filteredLicenses} className="border-0 shadow-none rounded-none" />
      </div>

      {/* Security note */}
      <div className="p-4 bg-[#EBF3FE]/50 rounded-xl border border-[#D8D8D8] flex gap-3 text-xs text-slate-500 items-start">
        <AlertTriangle size={18} className="text-[#3683F8] shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-[#060606] mb-0.5">Offline Sequential Series Logic (HMS/2026/001)</h4>
          <p className="leading-relaxed">
            Generated license strings act as sequential cryptographic passes (HMS/2026/001, HMS/2026/002...). When a hospital admin signs up, they submit their assigned code. The signup handler verifies the code is Unused in the LicenseCodes database, pairs it with the Tenant Hospital ID, marks it Used, and computes the Subscription Expiry date automatically based on validity.
          </p>
        </div>
      </div>

      {/* Modal - License Generator */}
      <Modal isOpen={isModalOpen} onClose={handleClose} title="Generate Sales License Key (HMS Series)">
        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Subscription Tier Selection with Cross Delete & Add Tier Option */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Subscription Tier</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedPlanId}
                onChange={(e) => handlePlanSelectChange(e.target.value)}
                className="flex-1 h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-white text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none font-medium"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — (₹{p.price.toLocaleString('en-IN')})
                  </option>
                ))}
                <option value="ADD_NEW_PLAN" className="text-[#3683F8] font-bold bg-[#EBF3FE]">
                  + Add New Subscription Tier...
                </option>
              </select>
              {selectedPlanId && selectedPlanId !== 'ADD_NEW_PLAN' && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedPlan}
                  className="h-10 w-10 flex items-center justify-center border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors shrink-0"
                  title="Remove / Delete Selected Plan Tier (❌)"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Validity Duration Selection with Custom Month Input Option */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Validity Duration (Months)</label>
            <select
              value={isCustomValidity ? 'CUSTOM' : validityMonths}
              onChange={(e) => handleValiditySelectChange(e.target.value)}
              className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-white text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none font-medium"
            >
              <option value={1}>1 Month (Trial)</option>
              <option value={3}>3 Months (Quarterly)</option>
              <option value={6}>6 Months (Semi-annual)</option>
              <option value={12}>12 Months (1 Year Standard)</option>
              <option value={24}>24 Months (2 Year Bundle)</option>
              <option value={36}>36 Months (3 Year Corporate)</option>
              <option value="CUSTOM" className="text-[#3683F8] font-bold bg-[#EBF3FE]">
                + Add Custom Duration (Enter Months)...
              </option>
            </select>
          </div>

          {/* Inline Custom Months Entry Input if selected */}
          {isCustomValidity && (
            <div className="p-3 bg-[#EBF3FE]/60 border border-[#D8D8D8] rounded-xl space-y-1.5 animate-in fade-in">
              <label className="text-xs font-bold text-[#3683F8] uppercase tracking-wider">Enter Custom Validity Duration (Months)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={customMonthsInput}
                  onChange={(e) => setCustomMonthsInput(Math.max(1, Number(e.target.value)))}
                  className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-white text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none font-bold"
                  placeholder="e.g. 18"
                />
                <span className="text-xs font-bold text-[#3683F8] shrink-0">Months</span>
              </div>
            </div>
          )}

          {!newCodeGenerated ? (
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="border-[#D8D8D8]">
                Cancel
              </Button>
              <Button type="submit" className="bg-[#3683F8] hover:bg-blue-600 text-white rounded-xl">
                Generate HMS License (Sequential)
              </Button>
            </div>
          ) : (
            <div className="mt-4 p-5 bg-[#EBF3FE]/60 border border-[#D8D8D8] rounded-xl text-center space-y-3.5 animate-in zoom-in-95">
              <div>
                <p className="text-xs text-[#3683F8] font-bold uppercase tracking-wider mb-1">Generated License Sequential Code</p>
                <div className="text-xl font-mono font-black tracking-widest text-[#060606] bg-white p-3 border border-[#D8D8D8] rounded-xl select-all shadow-xs">
                  {newCodeGenerated}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyCode(newCodeGenerated)}
                  className="flex-1 text-xs border-[#D8D8D8] text-[#3683F8] hover:bg-white"
                >
                  Copy String
                </Button>
                <Button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 text-xs bg-[#3683F8] hover:bg-blue-600 text-white"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
