import { useState } from 'react';
import { useSuperAdminStore, type LicenseCode } from '../../store/useSuperAdminStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Key, AlertTriangle, Trash2, ShieldX, Clipboard } from 'lucide-react';

export function SuperAdminLicenses() {
  const {
    licenses,
    plans,
    tenants,
    searchQuery,
    generateLicense,
    revokeLicense,
    deleteLicense
  } = useSuperAdminStore();

  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || '');
  const [validityMonths, setValidityMonths] = useState(12);
  const [newCodeGenerated, setNewCodeGenerated] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = await generateLicense(selectedPlanId, validityMonths);
    setNewCodeGenerated(code);
  };

  const handleClose = () => {
    setModalOpen(false);
    setNewCodeGenerated('');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Copied: ${code}`);
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
            className="text-slate-400 hover:text-blue-600 transition-colors"
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
      header: 'Assigned Hospital / Tenant',
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Key className="text-amber-500" /> License Management
          </h1>
          <p className="text-slate-500">Generate secure offline cryptographic license keys for manual hospital registrations</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="h-11 px-6 text-sm font-extrabold gap-2 shadow-lg shadow-blue-500/15 flex items-center">
          <span className="text-base leading-none">+</span> Generate New License
        </Button>
      </div>

      {searchQuery && (
        <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl text-xs text-blue-700 flex items-center justify-between">
          <span>Filtering codes by global topbar query: <strong>"{searchQuery}"</strong></span>
          <span className="font-semibold">{filteredLicenses.length} matches found</span>
        </div>
      )}

      {/* Licenses Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable columns={columns} data={filteredLicenses} className="border-0 shadow-none rounded-none" />
      </div>

      {/* Security note */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex gap-3 text-xs text-slate-500 items-start">
        <AlertTriangle size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-slate-700 mb-0.5">Offline Activation Security Logic</h4>
          <p className="leading-relaxed">
            Generated license strings act as offline cryptographic passes. When a hospital admin signs up, they submit their assigned code. The signup handler verifies the code is Unused in the LicenseCodes database, pairs it with the Tenant Hospital ID, marks it Used, and computes the Subscription Expiry date automatically based on validity.
          </p>
        </div>
      </div>

      {/* Modal - License Generator */}
      <Modal isOpen={isModalOpen} onClose={handleClose} title="Generate Sales License Key">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Subscription Tier</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (₹{p.price.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Validity Duration (Months)</label>
            <select
              value={validityMonths}
              onChange={(e) => setValidityMonths(Number(e.target.value))}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value={1}>1 Month (Trial)</option>
              <option value={6}>6 Months (Semi-annual)</option>
              <option value={12}>12 Months (1 Year Standard)</option>
              <option value={24}>24 Months (2 Year Bundle)</option>
              <option value={36}>36 Months (3 Year Corporate)</option>
            </select>
          </div>

          {!newCodeGenerated ? (
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit">
                Generate Hash Code
              </Button>
            </div>
          ) : (
            <div className="mt-4 p-5 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3.5 animate-in zoom-in-95">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Generated License Hash</p>
                <div className="text-lg font-mono font-bold tracking-wider text-slate-800 bg-white p-2.5 border border-slate-200 rounded-lg select-all">
                  {newCodeGenerated}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyCode(newCodeGenerated)}
                  className="flex-1 text-xs"
                >
                  Copy String
                </Button>
                <Button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700"
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
