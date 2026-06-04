import React, { useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { useSuperAdminStore } from '../../store/useSuperAdminStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { Users, UserPlus, X, Stethoscope, ShieldCheck, Trash2, ShieldAlert, Edit } from 'lucide-react';

export function HospitalAdminStaff() {
  const { staff, addStaff, toggleStaffStatus, deleteStaff, updateStaff } = useHospitalStore();
  const { tenants, plans } = useSuperAdminStore();
  const { user } = useAuthStore();

  // Find active tenant and plan to display current limits to the user
  const currentHospitalId = user?.hospitalId || 'tenant-1';
  const currentHospital = tenants.find(t => t.id === currentHospitalId);
  const plan = currentHospital ? plans.find(p => p.id === currentHospital.planId) : null;

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState('');
  const [drawerSuccess, setDrawerSuccess] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'Doctor' | 'Receptionist' | 'Pharmacy' | 'Lab Technician'>('Doctor');
  const [specialization, setSpecialization] = useState('General Medicine');

  // Count active staff roles
  const doctorCount = staff.filter(s => s.role === 'Doctor').length;
  const receptionistCount = staff.filter(s => s.role === 'Receptionist').length;
  const pharmacyCount = staff.filter(s => s.role === 'Pharmacy').length;

  const handleOpenDrawer = () => {
    // Reset states
    setEditingStaffId(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setRole('Doctor');
    setSpecialization('General Medicine');
    setDrawerError('');
    setDrawerSuccess('');
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (member: any) => {
    setEditingStaffId(member.id);
    setFullName(member.name);
    setEmail(member.email);
    setPassword(''); // leave blank if not changing
    setPhone(member.contact);
    setRole(member.role);
    setSpecialization(member.department || 'General Medicine');
    setDrawerError('');
    setDrawerSuccess('');
    setIsDrawerOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError('');
    setDrawerSuccess('');

    if (!fullName.trim() || !email.trim() || (!editingStaffId && !password.trim()) || !phone.trim()) {
      setDrawerError('Please complete all required fields.');
      return;
    }

    const payload = {
      name: fullName.trim(),
      email: email.trim(),
      role,
      department: role === 'Doctor' ? specialization : (role === 'Pharmacy' ? 'Pharmacy' : (role === 'Receptionist' ? 'Front Desk' : (role === 'Lab Technician' ? 'Lab Support' : 'Staff'))),
      contact: phone.trim(),
      password: password.trim()
    };

    if (editingStaffId) {
      // Call updateStaff
      const result = await updateStaff(editingStaffId, payload);
      if (!result.success) {
        setDrawerError(result.error || 'Failed to update staff member.');
        return;
      }
      setDrawerSuccess(`Access credentials updated for ${fullName}!`);
    } else {
      // Call addStaff
      const result = await addStaff(payload);
      if (!result.success) {
        setDrawerError(result.error || 'Failed to create staff member.');
        return;
      }
      setDrawerSuccess(`Access credentials generated for ${fullName}! Invitation sent.`);
    }

    setTimeout(() => {
      setIsDrawerOpen(false);
    }, 2000);
  };

  return (
    <div className="space-y-6 relative min-h-screen pb-20">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-blue-500" size={24} /> Staff & Team Directory
          </h1>
          <p className="text-sm text-slate-500">
            Provision user accounts and control clinical/administrative node permissions.
          </p>
        </div>
        <Button 
          onClick={handleOpenDrawer}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10 px-5 py-2.5 font-semibold text-sm transition-all"
        >
          <UserPlus size={16} /> Add New Staff
        </Button>
      </div>

      {/* Plan Slots telemetries */}
      {plan && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-600">
          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200/40">
            <span>Doctor Slots Used:</span>
            <span className={`px-2 py-0.5 rounded font-mono font-bold ${doctorCount >= plan.maxDoctors && plan.maxDoctors !== -1 ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
              {doctorCount} / {plan.maxDoctors === -1 ? 'Unlimited' : plan.maxDoctors}
            </span>
          </div>
          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200/40">
            <span>Receptionist Slots Used:</span>
            <span className={`px-2 py-0.5 rounded font-mono font-bold ${receptionistCount >= plan.maxReceptionists && plan.maxReceptionists !== -1 ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
              {receptionistCount} / {plan.maxReceptionists === -1 ? 'Unlimited' : plan.maxReceptionists}
            </span>
          </div>
          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200/40">
            <span>Pharmacy/Medical Slots Used:</span>
            <span className={`px-2 py-0.5 rounded font-mono font-bold ${pharmacyCount >= plan.maxPharmacists && plan.maxPharmacists !== -1 ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
              {pharmacyCount} / {plan.maxPharmacists === -1 ? 'Unlimited' : plan.maxPharmacists}
            </span>
          </div>
        </div>
      )}

      {/* Staff Directory Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Employee Details</th>
                <th className="px-6 py-4">Role Profile</th>
                <th className="px-6 py-4">Specialization / Department</th>
                <th className="px-6 py-4">Phone / Contact</th>
                <th className="px-6 py-4">Access Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs font-medium">
              {staff.map((member) => {
                const isActive = member.status === 'Active';
                const roleColors: Record<string, string> = {
                  Doctor: 'bg-purple-50 text-purple-700 border-purple-100',
                  Receptionist: 'bg-blue-50 text-blue-700 border-blue-100',
                  Pharmacy: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                  'Lab Technician': 'bg-amber-50 text-amber-700 border-amber-100'
                };
                return (
                  <tr key={member.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{member.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold mt-0.5 font-mono">{member.id} • {member.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${roleColors[member.role] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-semibold">{member.department || 'General Administration'}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono">{member.contact}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleStaffStatus(member.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200/50 group/status' 
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200/50'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500 group-hover/status:bg-rose-500' : 'bg-slate-300'}`}></span>
                        {isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-1">
                      <button
                        onClick={() => handleOpenEditDrawer(member)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Employee Credentials"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to permanently delete access for ${member.name}?`)) {
                            deleteStaff(member.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Revoke Credentials"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-Over Drawer panel (Tailwind CSS) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop slide-in */}
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out" 
              onClick={() => setIsDrawerOpen(false)}
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              {/* Drawer content sliding panel */}
              <div className="pointer-events-auto w-screen max-w-md transform transition-all duration-300 ease-in-out translate-x-0">
                <div className="flex h-full flex-col overflow-y-scroll bg-white py-6 shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-300">
                  
                  {/* Header */}
                  <div className="px-6 border-b border-slate-100 pb-5 flex justify-between items-center">
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2" id="slide-over-title">
                        <UserPlus className="text-blue-500" size={20} /> {editingStaffId ? 'Edit Staff Member Details' : 'Add Hospital Employee'}
                      </h2>
                      <p className="text-xs text-slate-400">{editingStaffId ? 'Modify active staff permissions and metadata.' : 'Generate fresh access credentials instantly.'}</p>
                    </div>
                    <button 
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Body Form */}
                  <div className="relative flex-1 py-6 px-6">
                    {drawerError && (
                      <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex gap-2.5 items-start">
                        <ShieldAlert className="shrink-0 mt-0.5 text-rose-600" size={18} />
                        <div>
                          <p className="font-bold">Action Refused</p>
                          <p className="mt-0.5 leading-relaxed">{drawerError}</p>
                        </div>
                      </div>
                    )}

                    {drawerSuccess && (
                      <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex gap-2.5 items-center">
                        <ShieldCheck className="shrink-0 text-emerald-500" size={18} />
                        <div>
                          <p className="font-bold">{editingStaffId ? 'Staff Updated!' : 'Staff Onboarded!'}</p>
                          <p className="mt-0.5">{drawerSuccess}</p>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSaveStaff} className="space-y-4">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Employee Name</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Dr. Alok Tripathi"
                          className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g. alok.tripathi@apollo.com"
                            className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contact Number</label>
                        <input
                          type="text"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          maxLength={10}
                          pattern="[0-9]{10}"
                          placeholder="10-digit mobile"
                          className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all font-mono"
                        />
                      </div>

                      {/* Password */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Default Password {editingStaffId && <span className="text-[10px] text-slate-400 font-normal lowercase">(leave blank to keep current)</span>}
                        </label>
                        <input
                          type="password"
                          required={!editingStaffId}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Role Dropdown */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Access Permission Role</label>
                        <select 
                          value={role}
                          onChange={(e) => setRole(e.target.value as any)}
                          className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                        >
                          <option value="Doctor">Doctor (Clinical Diagnostics)</option>
                          <option value="Receptionist">Receptionist (Front Desk Registries)</option>
                          <option value="Pharmacy">Pharmacist (Inventory & POS POS)</option>
                          <option value="Lab Technician">Lab Technician (Diagnostics Support)</option>
                        </select>
                      </div>

                      {/* Specialization Dropdown - Conditional */}
                      {role === 'Doctor' && (
                        <div className="space-y-1 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50 animate-in fade-in slide-in-from-top-2">
                          <label className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Stethoscope size={14} className="text-blue-600" /> Specialty Department
                          </label>
                          <select 
                            value={specialization}
                            onChange={(e) => setSpecialization(e.target.value)}
                            className="w-full h-10 border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all mt-1.5"
                          >
                            <option value="General Medicine">General Medicine</option>
                            <option value="Cardiology">Cardiology</option>
                            <option value="Pediatrics">Pediatrics</option>
                            <option value="Orthopedics">Orthopedics</option>
                            <option value="Neurology">Neurology</option>
                            <option value="Gynecology">Gynecology</option>
                          </select>
                          <p className="text-[10px] text-blue-700/70 font-semibold mt-1">This slot binds this doctor to associated OPD configurations.</p>
                        </div>
                      )}

                      <div className="pt-6">
                        <Button 
                          type="submit" 
                          className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 hover:translate-y-[-1px] transition-all"
                        >
                          {editingStaffId ? 'Update Credentials & Save' : 'Save & Send Credentials'}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
