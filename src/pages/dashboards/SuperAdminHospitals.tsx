import { useState } from 'react';
import { useSuperAdminStore, type Tenant } from '../../store/useSuperAdminStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PasswordStrengthMeter } from '../../components/ui/PasswordStrengthMeter';
import { Building2, Eye, Mail, MapPin, HardDrive, Users, Edit, Trash2, Calendar, Award, Plus, Key, X } from 'lucide-react';

export function SuperAdminHospitals() {
  const {
    tenants,
    licenses,
    plans,
    searchQuery,
    onboardHospital,
    updateTenant,
    deleteTenant,
    toggleTenantStatus,
    generateLicense
  } = useSuperAdminStore();

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [onboardSuccessData, setOnboardSuccessData] = useState<any>(null);

  // Form State for manual onboarding
  const [hospitalName, setHospitalName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPersonalEmail, setAdminPersonalEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [address, setAddress] = useState('');
  const [licenseCodeUsed, setLicenseCodeUsed] = useState('');
  const [onboardStep, setOnboardStep] = useState(1);

  // Inline license creation state (inside onboard modal)
  const [showInlineLicenseCreate, setShowInlineLicenseCreate] = useState(false);
  const [inlinePlanId, setInlinePlanId] = useState('');
  const [inlineValidityMonths, setInlineValidityMonths] = useState(12);
  const [inlineIsCustomValidity, setInlineIsCustomValidity] = useState(false);
  const [inlineCustomMonths, setInlineCustomMonths] = useState(18);
  const [inlineGenerating, setInlineGenerating] = useState(false);
  const [inlineGeneratedCode, setInlineGeneratedCode] = useState('');

  // Form State for editing
  const [editHospitalName, setEditHospitalName] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSubscriptionExpiryDate, setEditSubscriptionExpiryDate] = useState('');
  const [editPlanId, setEditPlanId] = useState('');
  const [editIsTrial, setEditIsTrial] = useState(false);
  const [editError, setEditError] = useState('');

  // 1. Filter tenants by search query
  const filteredTenants = tenants.filter(t => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return t.hospitalName.toLowerCase().includes(query) ||
      t.adminEmail.toLowerCase().includes(query) ||
      t.licenseCodeUsed.toLowerCase().includes(query);
  });

  // Filter unused licenses for onboarding form dropdown
  const unusedLicenses = licenses.filter(l => !l.isUsed && l.status === 'Unused');

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseCodeUsed) {
      alert('Please select or generate a valid License Code first!');
      return;
    }

    if (!adminPassword) {
      alert('Please set the administrator password in Step 2!');
      return;
    }

    const selectedLic = licenses.find(l => l.code === licenseCodeUsed);
    if (!selectedLic) return;

    const validityMonths = selectedLic.validityMonths;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + validityMonths);

    const result = await onboardHospital({
      hospitalName,
      adminEmail,
      adminPersonalEmail: adminPersonalEmail || adminEmail,
      adminPhone,
      adminPassword,
      address,
      licenseCodeUsed,
      subscriptionExpiryDate: expiryDate.toISOString().split('T')[0],
      planId: selectedLic.planId,
    });

    if (result.success) {
      setOnboardSuccessData({
        hospitalName,
        adminEmail: result.adminEmail || adminEmail,
        adminPhone: result.adminPhone || adminPhone,
        generatedPassword: result.generatedPassword || adminPassword,
        accessCode: result.licenseCodeUsed || licenseCodeUsed
      });
      setHospitalName('');
      setAdminEmail('');
      setAdminPersonalEmail('');
      setAdminPhone('');
      setAdminPassword('');
      setAddress('');
      setLicenseCodeUsed('');
      setOnboardStep(1);
      setIsOnboardModalOpen(false);
    } else {
      alert(`Onboarding failed: ${result.error}`);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setEditError('');
    try {
      await updateTenant(selectedTenant.id, {
        hospitalName: editHospitalName,
        adminEmail: editAdminEmail,
        address: editAddress,
        subscriptionExpiryDate: editSubscriptionExpiryDate,
        planId: editPlanId,
        isTrial: editIsTrial
      });
      setIsEditModalOpen(false);
      setSelectedTenant(null);
    } catch (err: any) {
      setEditError(err?.message || 'Could not save the changes.');
    }
  };

  const handleToggleStatus = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    const actionText = tenant.status === 'Active' ? 'SUSPEND' : 'REACTIVATE';
    if (confirm(`SECURITY ALERT: Are you sure you want to ${actionText} "${tenant.hospitalName}"? \n\nSuspension instantly revokes SaaS access for all doctors, nurses, receptionists, and hospital administrators under this tenant database.`)) {
      toggleTenantStatus(tenantId);
      if (selectedTenant && selectedTenant.id === tenantId) {
        setSelectedTenant({
          ...selectedTenant,
          status: tenant.status === 'Active' ? 'Suspended' : 'Active'
        });
      }
    }
  };

  const openEditModal = (tenant: Tenant) => {
    setEditHospitalName(tenant.hospitalName);
    setEditAdminEmail(tenant.adminEmail);
    setEditAddress(tenant.address);
    setEditSubscriptionExpiryDate(tenant.subscriptionExpiryDate);
    setEditPlanId(tenant.planId);
    setEditIsTrial(!!tenant.isTrial);
    setEditError('');
    setSelectedTenant(tenant);
    setIsEditModalOpen(true);
  };

  const handleDeleteTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    if (confirm(`CRITICAL SYSTEM RESET: Are you sure you want to PERMANENTLY REMOVE "${tenant.hospitalName}" from the Smart Hospital Management Software platform? \n\nThis will completely delete their directory registration and free up their license key "${tenant.licenseCodeUsed}". This action is irreversible.`)) {
      deleteTenant(tenantId);
      setSelectedTenant(null);
    }
  };

  const columns = [
    {
      key: 'hospitalName',
      header: 'Hospital Name',
      render: (item: Tenant) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs block">{item.hospitalName}</span>
          <span className="text-[10px] text-slate-400 font-mono block">{item.id}</span>
          {(item.isTrial || item.signupSource === 'self-signup') && (
            <span className="mt-1 inline-flex gap-1">
              {item.isTrial && <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">Free trial</span>}
              {item.signupSource === 'self-signup' && <span className="text-[9px] font-bold uppercase tracking-wider bg-[#EBF3FE] text-[#3683F8] border border-blue-200 px-1.5 py-0.5 rounded">Website sign-up</span>}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'adminEmail',
      header: 'Admin Email',
      render: (item: Tenant) => (
        <span className="text-slate-600 text-xs font-medium">{item.adminEmail}</span>
      )
    },
    {
      key: 'planId',
      header: 'Subscribed Plan',
      render: (item: Tenant) => {
        const plan = plans.find(p => p.id === item.planId);
        return (
          <span className="font-semibold text-slate-700 text-xs">{plan?.name || 'Basic Tier'}</span>
        );
      }
    },
    {
      key: 'subscriptionExpiryDate',
      header: 'Plan Expiration',
      render: (item: Tenant) => {
        const isExpired = new Date(item.subscriptionExpiryDate).getTime() < new Date().getTime();
        return (
          <span className={`text-xs font-medium ${isExpired ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
            {item.subscriptionExpiryDate} {isExpired && '(Expired)'}
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'SaaS Status',
      render: (item: Tenant) => {
        const styles = {
          Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          Suspended: 'bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse',
          'Past Due': 'bg-amber-50 text-amber-700 border-amber-200'
        };
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[item.status]}`}>
            {item.status}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Administration Controls',
      render: (item: Tenant) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            onClick={() => setSelectedTenant(item)}
            className="h-8 py-0 px-2 text-[11px] text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200 flex items-center gap-1"
            title="Telemetry Detail"
          >
            <Eye size={13} /> View
          </Button>
          <Button
            variant="outline"
            onClick={() => openEditModal(item)}
            className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 border-slate-200 hover:border-blue-200 flex items-center justify-center"
            title="Edit Profile"
          >
            <Edit size={13} />
          </Button>
          <Button
            variant="outline"
            onClick={() => handleToggleStatus(item.id)}
            className={`h-8 py-0 px-2 text-[11px] font-semibold flex items-center gap-1 ${
              item.status === 'Active' 
                ? 'border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-300' 
                : 'border-emerald-150 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300'
            }`}
          >
            {item.status === 'Active' ? 'Suspend' : 'Active'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDeleteTenant(item.id)}
            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 border-slate-200 hover:border-rose-200 flex items-center justify-center"
            title="Delete Hospital Organization"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#060606] flex items-center gap-2">
            <Building2 className="text-[#3683F8]" /> Hospitals & Clinics
          </h1>
          <p className="text-slate-500">Inspect registered hospital & clinic database status, telemetry capacity and access switches</p>
        </div>
        <Button onClick={() => setIsOnboardModalOpen(true)} className="h-11 px-6 text-sm font-extrabold gap-2 shadow-md bg-[#3683F8] hover:bg-blue-600 text-white flex items-center rounded-xl">
          <span className="text-base leading-none">+</span> Onboard New Hospital
        </Button>
      </div>

      {searchQuery && (
        <div className="bg-[#EBF3FE] border border-[#D8D8D8] p-3.5 rounded-xl text-xs text-[#3683F8] flex items-center justify-between">
          <span>Filtering directory by query: <strong>"{searchQuery}"</strong></span>
          <span className="font-semibold">{filteredTenants.length} clinics matching</span>
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-[#D8D8D8] shadow-xs overflow-hidden">
        <DataTable columns={columns} data={filteredTenants} className="border-0 shadow-none rounded-none" />
      </div>

      {/* Detailed Modal */}
      <Modal
        isOpen={selectedTenant !== null && !isEditModalOpen}
        onClose={() => setSelectedTenant(null)}
        title="Hospital Organization Telemetry"
        className="max-w-lg"
      >
        {selectedTenant && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex justify-between items-start bg-[#EBF3FE]/50 p-4 rounded-xl border border-[#D8D8D8]">
              <div>
                <h3 className="text-lg font-bold text-[#060606]">{selectedTenant.hospitalName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Central MongoDB ID: {selectedTenant.id}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                selectedTenant.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                selectedTenant.status === 'Suspended' ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {selectedTenant.status}
              </span>
            </div>

            {/* General Info */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">General Information</h4>

              <div className="flex items-center gap-3 text-xs text-slate-600">
                <Mail size={16} className="text-[#3683F8] shrink-0" />
                <div>
                  <p className="font-semibold text-[#060606]">{selectedTenant.adminEmail}</p>
                  <p className="text-[10px] text-slate-400">Hospital Admin Email</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs text-slate-600">
                <MapPin size={16} className="text-[#3683F8] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#060606] leading-relaxed">{selectedTenant.address}</p>
                  <p className="text-[10px] text-slate-400">Physical Location Address</p>
                </div>
              </div>
            </div>

            {/* Subscription Metrics */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">SaaS Usage telemetry Metrics</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-[#EBF3FE]/30 border border-[#D8D8D8] rounded-xl">
                  <Users className="text-[#3683F8] shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-bold text-[#060606]">{selectedTenant.staffCreated} Accounts</p>
                    <p className="text-[10px] text-slate-400 font-medium">Doctors & staff slots used</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#EBF3FE]/30 border border-[#D8D8D8] rounded-xl">
                  <HardDrive className="text-emerald-500 shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-bold text-[#060606]">
                      {(() => {
                        const plan = plans.find(p => p.id === selectedTenant.planId);
                        const limitGB = plan ? plan.maxStorage : 10;
                        const mb = selectedTenant.storageUsed;
                        let usedStr = '';
                        if (mb < 0.0009765625) { // less than 1 KB
                          usedStr = `${(mb * 1024 * 1024).toFixed(0)} Bytes`;
                        } else if (mb < 1) { // less than 1 MB
                          usedStr = `${(mb * 1024).toFixed(2)} KB`;
                        } else if (mb < 1024) { // less than 1 GB
                          usedStr = `${mb.toFixed(2)} MB`;
                        } else {
                          usedStr = `${(mb / 1024).toFixed(2)} GB`;
                        }
                        return `${usedStr} / ${limitGB} GB`;
                      })()}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">MongoDB physical space size</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan metrics */}
            <div className="space-y-3 p-4 rounded-xl bg-[#EBF3FE]/40 border border-[#D8D8D8]">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">License string used</span>
                <span className="font-mono font-bold text-[#060606]">{selectedTenant.licenseCodeUsed}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Subscription expires on</span>
                <span className="font-bold text-[#060606]">{selectedTenant.subscriptionExpiryDate}</span>
              </div>
            </div>

            {/* Controls panel in view modal */}
            <div className="pt-4 border-t border-[#D8D8D8] flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => openEditModal(selectedTenant)}
                className="h-11 flex-1 flex items-center justify-center gap-2 font-bold text-sm border-[#D8D8D8] text-slate-700 hover:bg-[#EBF3FE]"
              >
                <Edit size={15} /> Edit Hospital
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDeleteTenant(selectedTenant.id)}
                className="h-11 w-11 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 flex items-center justify-center p-0 shrink-0"
                title="Remove Permanently"
              >
                <Trash2 size={16} />
              </Button>
              <Button
                onClick={() => handleToggleStatus(selectedTenant.id)}
                className={`h-11 flex-[2] flex items-center justify-center gap-2 font-extrabold text-sm shadow-md rounded-xl ${
                  selectedTenant.status === 'Active' 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {selectedTenant.status === 'Active' ? '⚠ Suspend (Kill Switch)' : '✓ Restore Access'}
              </Button>
            </div>

            {selectedTenant.status === 'Active' && (
              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                ⚠️ [KILL SWITCH]: Suspending is instant. It locks the tenant's clinical database and immediately denies dashboard access to all doctors, receptionists, pharmacists, and staff. Excludes viewing clinical records.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Modal - Onboard New Hospital */}
      <Modal isOpen={isOnboardModalOpen} onClose={() => { setIsOnboardModalOpen(false); setOnboardStep(1); setShowInlineLicenseCreate(false); setInlineGeneratedCode(''); }} title="Onboard New Hospital / Clinic">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between mb-6 border-b border-[#D8D8D8] pb-4">
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${onboardStep === 1 ? 'bg-[#3683F8] text-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-500'}`}>1</span>
            <span className={`text-xs font-semibold ${onboardStep === 1 ? 'text-[#3683F8]' : 'text-slate-500'}`}>Hospital Info</span>
          </div>
          <div className="flex-1 h-[2px] bg-[#D8D8D8] mx-4 rounded-full overflow-hidden relative">
            <div className={`absolute top-0 left-0 h-full bg-[#3683F8] transition-all duration-500 ${onboardStep === 2 ? 'w-full' : 'w-0'}`}></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${onboardStep === 2 ? 'bg-[#3683F8] text-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-500'}`}>2</span>
            <span className={`text-xs font-semibold ${onboardStep === 2 ? 'text-[#3683F8]' : 'text-slate-500'}`}>Credentials & License</span>
          </div>
        </div>

        <form onSubmit={handleOnboardSubmit} className="space-y-4">
          {onboardStep === 1 ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Care Multi-Specialty Clinic"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-[#EBF3FE]/30 text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Admin Login Email
                    <span className="ml-1 text-rose-500">* (must contain @)</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@hospital.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className={`w-full h-10 px-3 border rounded-xl text-sm bg-[#EBF3FE]/30 text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none transition-all ${
                      adminEmail && !adminEmail.includes('@')
                        ? 'border-rose-400 bg-rose-50/40'
                        : 'border-[#D8D8D8]'
                    }`}
                  />
                  {adminEmail && !adminEmail.includes('@') && (
                    <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                      ⚠ Email must contain @ symbol (e.g. admin@hospital.com)
                    </p>
                  )}
                  {adminEmail && adminEmail.includes('@') && (
                    <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      ✓ Valid email format
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin Personal Email (Security)</label>
                  <input
                    type="email"
                    placeholder="administrator.personal@gmail.com"
                    value={adminPersonalEmail}
                    onChange={(e) => setAdminPersonalEmail(e.target.value)}
                    className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-[#EBF3FE]/30 text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin Contact Phone</label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-[#EBF3FE]/30 text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none transition-all"
                />
                <p className="text-[10px] text-slate-400">Security alert emails will be delivered to this personal inbox whenever hospital staff reset credentials.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Physical Address</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Street, City, State, ZIP..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8D8D8] rounded-xl text-sm bg-[#EBF3FE]/30 text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOnboardModalOpen(false)}
                  className="h-11 px-5 font-bold text-sm border-[#D8D8D8]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!hospitalName || !adminEmail || !adminPhone || !address) {
                      alert('Please complete all hospital details in Step 1 first!');
                      return;
                    }
                    if (!adminEmail.includes('@')) {
                      alert('Admin Login Email must be a valid email address containing @ (e.g. admin@hospital.com). Plain usernames are not allowed here.');
                      return;
                    }
                    setOnboardStep(2);
                  }}
                  className="h-11 px-6 font-extrabold text-sm gap-2 flex items-center bg-[#3683F8] hover:bg-blue-600 text-white rounded-xl shadow-md"
                >
                  Next Step: Credentials <span className="text-base leading-none">→</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin Login Email / Username</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-[#EBF3FE]/50 text-slate-600 cursor-not-allowed focus:outline-none font-mono"
                  disabled
                />
                <p className="text-[10px] text-slate-400">Prefilled from Step 1 email. Serves as login username.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Set Admin Login Password</label>
                <input
                  type="text"
                  required
                  placeholder="Enter manual secure password (e.g. MySecretPass123)"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-white text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none transition-all"
                />
                <PasswordStrengthMeter password={adminPassword} onPasswordChange={setAdminPassword} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex justify-between items-center">
                  <span>Allocate Unused License Code</span>
                  <span className="text-[10px] text-[#3683F8] font-bold lowercase">
                    ({unusedLicenses.length} available)
                  </span>
                </label>

                {unusedLicenses.length === 0 && !showInlineLicenseCreate ? (
                  // No licenses available - show prompt
                  <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Key size={16} />
                      <span className="text-xs font-bold">No unused licenses available</span>
                    </div>
                    <p className="text-[11px] text-amber-600 text-center">
                      You need to create a license first before onboarding a hospital.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineLicenseCreate(true);
                        setInlinePlanId(plans[0]?.id || '');
                        setInlineGeneratedCode('');
                        setInlineIsCustomValidity(false);
                        setInlineValidityMonths(12);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#3683F8] text-white text-xs font-extrabold rounded-xl shadow hover:bg-blue-600 transition-colors"
                    >
                      <Plus size={14} /> Create License Now
                    </button>
                  </div>
                ) : unusedLicenses.length > 0 ? (
                  // Licenses exist - show dropdown + optional create link
                  <div className="space-y-2">
                    <select
                      required
                      value={licenseCodeUsed}
                      onChange={(e) => setLicenseCodeUsed(e.target.value)}
                      className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm bg-white text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none transition-all"
                    >
                      <option value="">-- Choose License Code --</option>
                      {unusedLicenses.map(lic => {
                        const plan = plans.find(p => p.id === lic.planId);
                        return (
                          <option key={lic.code} value={lic.code}>
                            {lic.code} - {plan?.name || 'Plan'} ({lic.validityMonths}m Validity)
                          </option>
                        );
                      })}
                    </select>
                    {!showInlineLicenseCreate && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowInlineLicenseCreate(true);
                          setInlinePlanId(plans[0]?.id || '');
                          setInlineGeneratedCode('');
                          setInlineIsCustomValidity(false);
                          setInlineValidityMonths(12);
                        }}
                        className="flex items-center gap-1 text-[11px] text-[#3683F8] font-bold hover:underline mt-0.5"
                      >
                        <Plus size={12} /> Create a new license instead
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Inline License Creator Panel */}
                {showInlineLicenseCreate && (
                  <div className="border border-[#3683F8]/30 bg-[#EBF3FE]/40 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#3683F8] flex items-center gap-1.5">
                        <Key size={13} /> Create New License
                      </span>
                      <button
                        type="button"
                        onClick={() => { setShowInlineLicenseCreate(false); setInlineGeneratedCode(''); }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {!inlineGeneratedCode ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Subscription Tier</label>
                          <select
                            value={inlinePlanId}
                            onChange={(e) => setInlinePlanId(e.target.value)}
                            className="w-full h-9 px-3 border border-[#D8D8D8] rounded-xl text-xs bg-white text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none"
                          >
                            {plans.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Validity Duration</label>
                          <select
                            value={inlineIsCustomValidity ? 'CUSTOM' : inlineValidityMonths}
                            onChange={(e) => {
                              if (e.target.value === 'CUSTOM') {
                                setInlineIsCustomValidity(true);
                              } else {
                                setInlineIsCustomValidity(false);
                                setInlineValidityMonths(Number(e.target.value));
                              }
                            }}
                            className="w-full h-9 px-3 border border-[#D8D8D8] rounded-xl text-xs bg-white text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none"
                          >
                            <option value={1}>1 Month (Trial)</option>
                            <option value={3}>3 Months (Quarterly)</option>
                            <option value={6}>6 Months (Semi-annual)</option>
                            <option value={12}>12 Months (1 Year Standard)</option>
                            <option value={24}>24 Months (2 Year Bundle)</option>
                            <option value={36}>36 Months (3 Year Corporate)</option>
                            <option value="CUSTOM" className="text-[#3683F8] font-bold bg-[#EBF3FE]">+ Custom Duration...</option>
                          </select>
                        </div>

                        {inlineIsCustomValidity && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="120"
                              value={inlineCustomMonths}
                              onChange={(e) => setInlineCustomMonths(Math.max(1, Number(e.target.value)))}
                              className="flex-1 h-9 px-3 border border-[#D8D8D8] rounded-xl text-xs bg-white text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none"
                              placeholder="e.g. 18"
                            />
                            <span className="text-xs font-bold text-[#3683F8] shrink-0">Months</span>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={inlineGenerating || !inlinePlanId}
                          onClick={async () => {
                            setInlineGenerating(true);
                            try {
                              const months = inlineIsCustomValidity ? inlineCustomMonths : inlineValidityMonths;
                              const code = await generateLicense(inlinePlanId, months);
                              setInlineGeneratedCode(code);
                              setLicenseCodeUsed(code);
                            } finally {
                              setInlineGenerating(false);
                            }
                          }}
                          className="w-full h-9 bg-[#3683F8] hover:bg-blue-600 text-white text-xs font-extrabold rounded-xl shadow flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                        >
                          {inlineGenerating ? 'Generating...' : <><Plus size={13} /> Generate License</>}
                        </button>
                      </>
                    ) : (
                      // Success state - show generated code
                      <div className="space-y-2">
                        <p className="text-[10px] text-[#3683F8] font-bold uppercase tracking-wider text-center">License Generated & Auto-Selected ✓</p>
                        <div className="text-sm font-mono font-black tracking-widest text-[#060606] bg-white p-2.5 border border-emerald-300 rounded-xl text-center select-all">
                          {inlineGeneratedCode}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(inlineGeneratedCode)}
                            className="flex-1 h-8 text-[11px] font-bold border border-[#D8D8D8] rounded-xl hover:bg-white transition-colors text-slate-600"
                          >
                            Copy Code
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowInlineLicenseCreate(false); }}
                            className="flex-1 h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                          >
                            Use This License ✓
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOnboardStep(1)}
                  className="h-11 px-5 font-bold text-sm gap-1.5 flex items-center border-[#D8D8D8]"
                >
                  <span className="text-base leading-none">←</span> Back
                </Button>
                <Button
                  type="submit"
                  disabled={!licenseCodeUsed || !adminPassword}
                  className="h-11 px-6 font-extrabold text-sm gap-2 flex items-center bg-[#3683F8] hover:bg-blue-600 text-white rounded-xl shadow-md"
                >
                  <span className="text-base leading-none">✓</span> Activate SaaS & Complete
                </Button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal - Edit Hospital Details */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Tenant Profile">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Apollo Super Speciality"
              value={editHospitalName}
              onChange={(e) => setEditHospitalName(e.target.value)}
              className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin Contact Email</label>
            <input
              type="email"
              required
              placeholder="admin@hospital.com"
              value={editAdminEmail}
              onChange={(e) => setEditAdminEmail(e.target.value)}
              className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Physical Address</label>
            <textarea
              rows={2}
              required
              placeholder="Address..."
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="w-full px-3 py-2 border border-[#D8D8D8] rounded-xl text-sm text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Calendar size={13} /> Expiry Date
              </label>
              <input
                type="date"
                required
                value={editSubscriptionExpiryDate}
                onChange={(e) => setEditSubscriptionExpiryDate(e.target.value)}
                className="w-full h-10 px-3 border border-[#D8D8D8] rounded-xl text-sm text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Award size={13} /> Assign Plan Tier
              </label>
              <select
                value={editPlanId}
                onChange={(e) => setEditPlanId(e.target.value)}
                className="w-full h-10 px-3 border border-[#D8D8D8] bg-white rounded-xl text-sm text-[#060606] focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] focus:outline-none"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={editIsTrial} onChange={(e) => setEditIsTrial(e.target.checked)} className="rounded border-[#D8D8D8] text-[#3683F8]" />
            Still on free trial (untick after the hospital pays)
          </label>
          {editError && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{editError}</div>}

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="h-11 px-5 font-bold text-sm border-[#D8D8D8]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 px-6 font-extrabold text-sm gap-2 flex items-center bg-[#3683F8] hover:bg-blue-600 text-white rounded-xl shadow-md"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Onboard Success Credentials Modal */}
      <Modal
        isOpen={onboardSuccessData !== null}
        onClose={() => setOnboardSuccessData(null)}
        title="🎉 Hospital Onboarded Successfully!"
        className="max-w-md"
      >
        {onboardSuccessData && (
          <div className="space-y-5 text-[#060606] animate-in fade-in zoom-in-95">
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm leading-relaxed text-center font-medium">
              Hospital Node registration is active inside the central database! Custom administrator profile has been saved successfully.
            </div>

            <div className="space-y-3 bg-[#EBF3FE]/40 border border-[#D8D8D8] p-5 rounded-2xl">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Hospital Name</label>
                <span className="text-sm font-semibold text-[#060606] block mt-0.5">{onboardSuccessData.hospitalName}</span>
              </div>

              <hr className="border-[#D8D8D8]/50" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Admin Phone</label>
                  <span className="text-xs font-semibold text-slate-700 block mt-0.5">{onboardSuccessData.adminPhone || 'N/A'}</span>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Admin Username (Email)</label>
                  <span className="text-xs font-semibold font-mono text-slate-700 block mt-0.5">{onboardSuccessData.adminEmail}</span>
                </div>
              </div>

              <hr className="border-[#D8D8D8]/50" />

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Manual Admin Password</label>
                <span className="text-sm font-bold font-mono text-[#3683F8] block mt-0.5">{onboardSuccessData.generatedPassword}</span>
              </div>

              <hr className="border-[#D8D8D8]/50" />

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Allotted Access Code (License)</label>
                <span className="text-sm font-extrabold font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded block w-fit mt-0.5">{onboardSuccessData.accessCode}</span>
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-relaxed text-center p-1">
              ⚠️ Copy these credentials and Access Code. Provide them to the hospital administrator to log in to their dashboard.
            </div>

            <div className="pt-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Hospital Name: ${onboardSuccessData.hospitalName}\nAdmin Contact Phone: ${onboardSuccessData.adminPhone || ''}\nAdmin Username/Email: ${onboardSuccessData.adminEmail}\nAdmin Password: ${onboardSuccessData.generatedPassword}\nHospital Access Code: ${onboardSuccessData.accessCode}`
                  );
                  alert('Credentials copied to clipboard! ✓');
                }}
                className="w-full h-11 bg-[#3683F8] hover:bg-blue-600 text-white font-bold flex items-center justify-center gap-2 rounded-xl shadow-md"
              >
                Copy All Credentials & Code
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
