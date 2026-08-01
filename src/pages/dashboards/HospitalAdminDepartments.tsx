import React, { useState } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import { Settings, Plus, Trash2, Edit, BedDouble, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function HospitalAdminDepartments() {
  const {
    departments,
    staff,
    addDepartment,
    deleteDepartment,
    updateDepartment,
  } = useHospitalStore();

  // Modal / form states - Department creation
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptHead, setNewDeptHead] = useState('Pending Assignment');
  const [newDeptBeds, setNewDeptBeds] = useState('');
  const [newDeptStaff, setNewDeptStaff] = useState('');

  // Modal / form states - Department editing
  const [isEditDeptModalOpen, setIsEditDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptHead, setEditDeptHead] = useState('');
  const [editDeptRooms, setEditDeptRooms] = useState('');
  const [editDeptStatus, setEditDeptStatus] = useState<'Active' | 'Setup Required'>('Active');
  const [editDeptBeds, setEditDeptBeds] = useState('');
  const [editDeptStaff, setEditDeptStaff] = useState('');

  // Extract doctors
  const doctorsList = staff.filter(s => s.role === 'Doctor');

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    addDepartment(newDeptName.trim(), newDeptHead, {
      beds: newDeptBeds.trim(),
      staffAssigned: newDeptStaff.trim(),
    });
    setNewDeptName('');
    setNewDeptHead('Pending Assignment');
    setNewDeptBeds('');
    setNewDeptStaff('');
    setIsDeptModalOpen(false);
  };

  const handleOpenEditDeptModal = (dept: any) => {
    setEditingDeptId(dept.id);
    setEditDeptName(dept.name);
    setEditDeptHead(dept.head);
    setEditDeptRooms(dept.rooms || '');
    setEditDeptStatus(dept.status);
    setEditDeptBeds(dept.beds || '');
    setEditDeptStaff(dept.staffAssigned || String(dept.staffCount || ''));
    setIsEditDeptModalOpen(true);
  };

  const handleEditDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDeptName.trim() || !editingDeptId) return;
    updateDepartment(editingDeptId, {
      name: editDeptName.trim(),
      head: editDeptHead,
      rooms: editDeptRooms.trim(),
      status: editDeptStatus,
      beds: editDeptBeds.trim(),
      staffAssigned: editDeptStaff.trim(),
    });
    setIsEditDeptModalOpen(false);
    setEditingDeptId(null);
  };

  return (
    <div className="space-y-8 pb-20 font-sans">

      {/* SECTION 1: Departments */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#D8D8D8] shadow-xs">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#060606] flex items-center gap-2">
              <Settings className="text-[#3683F8]" size={22} /> Hospital Wing &amp; Departments
            </h1>
            <p className="text-xs text-slate-500 font-medium">Configure medical wings, assign clinical directors, and allocate diagnostic rooms.</p>
          </div>
          <Button
            onClick={() => setIsDeptModalOpen(true)}
            className="h-11 px-6 text-sm font-extrabold gap-2 shadow-md bg-[#3683F8] hover:bg-blue-600 text-white flex items-center rounded-xl"
          >
            <Plus size={16} /> Add Department
          </Button>
        </div>

        {/* Department Data Table */}
        <div className="bg-white rounded-2xl shadow-xs border border-[#D8D8D8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EBF3FE]/50 border-b border-[#D8D8D8] text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Department Name</th>
                  <th className="px-6 py-4">Wing Director</th>
                  <th className="px-6 py-4">Beds</th>
                  <th className="px-6 py-4">Staff Assigned</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8D8D8]/60 text-sm">
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-14 text-slate-400 font-semibold text-xs">
                      <div className="flex flex-col items-center gap-2">
                        <Settings size={28} className="text-slate-300" />
                        No departments configured yet. Click <span className="text-[#3683F8] font-bold mx-1">+ Add Department</span> to get started.
                      </div>
                    </td>
                  </tr>
                )}
                {departments.map((dept: any, idx: number) => {
                  const isSetupRequired = dept.status === 'Setup Required';
                  return (
                    <tr key={dept.id} className="hover:bg-[#EBF3FE]/20 transition-colors group">
                      <td className="px-6 py-4 text-slate-400 font-bold text-xs">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-[#060606] group-hover:text-[#3683F8] transition-colors">
                          {dept.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-[#EBF3FE] border border-blue-200 text-[#3683F8] flex items-center justify-center font-bold text-[10px] shrink-0">
                            {dept.head.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[#060606] font-semibold text-xs truncate max-w-[140px]">
                            {dept.head}
                          </span>
                        </div>
                      </td>

                      {/* Beds column */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EBF3FE] border border-blue-200 text-[#3683F8] text-xs font-bold">
                          <BedDouble size={11} />
                          {dept.beds || '—'}
                        </span>
                      </td>

                      {/* Staff Assigned column */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
                          <Users size={11} />
                          {dept.staffAssigned || dept.staffCount || '—'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          isSetupRequired
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSetupRequired ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                          {dept.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEditDeptModal(dept)}
                            title="Edit Department"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EBF3FE] text-[#3683F8] border border-blue-200 hover:bg-blue-100 text-[10px] font-bold transition-all"
                          >
                            <Edit size={11} /> Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove the ${dept.name} department?`)) {
                                deleteDepartment(dept.id);
                              }
                            }}
                            title="Delete Department"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[10px] font-bold transition-all"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          {departments.length > 0 && (
            <div className="px-6 py-3 border-t border-[#D8D8D8] bg-[#EBF3FE]/30 flex items-center justify-between">
              <p className="text-[11px] text-slate-400 font-semibold">
                Showing <span className="text-[#060606] font-bold">{departments.length}</span> department{departments.length !== 1 ? 's' : ''} configured
              </p>
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                Live Sync Active
              </span>
            </div>
          )}
        </div>
      </div>



      {/* DEPARTMENT ADD MODAL */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsDeptModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl border border-[#D8D8D8] w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-[#060606] mb-5">Establish New Medical Wing</h2>
            <form onSubmit={handleAddDept} className="space-y-4">

              {/* Department Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department Wing Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pediatrics, Neurology"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                />
              </div>

              {/* Wing Director */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Designated Director (Head)</label>
                <select
                  value={newDeptHead}
                  onChange={(e) => setNewDeptHead(e.target.value)}
                  className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                >
                  <option value="Pending Assignment">-- Click to Assign Later --</option>
                  {doctorsList.map((doc) => (
                    <option key={doc.id} value={doc.name}>{doc.name}</option>
                  ))}
                </select>
              </div>

              {/* Beds & Staff side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <BedDouble size={11} className="text-[#3683F8]" /> Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 20"
                    value={newDeptBeds}
                    onChange={(e) => setNewDeptBeds(e.target.value)}
                    className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Users size={11} className="text-purple-500" /> Staff Assigned
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 10"
                    value={newDeptStaff}
                    onChange={(e) => setNewDeptStaff(e.target.value)}
                    className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="h-10 text-xs font-bold border-[#D8D8D8]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10 bg-[#3683F8] hover:bg-blue-600 text-white font-bold text-xs px-4 rounded-xl"
                >
                  Establish Wing
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEPARTMENT EDIT MODAL */}
      {isEditDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsEditDeptModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl border border-[#D8D8D8] w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-[#060606] mb-5">Edit Medical Wing Details</h2>
            <form onSubmit={handleEditDeptSubmit} className="space-y-4">

              {/* Department Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department Wing Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pediatrics, Neurology"
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                />
              </div>

              {/* Wing Director */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Designated Director (Head)</label>
                <select
                  value={editDeptHead}
                  onChange={(e) => setEditDeptHead(e.target.value)}
                  className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                >
                  <option value="Pending Assignment">-- Click to Assign Later --</option>
                  {doctorsList.map((doc) => (
                    <option key={doc.id} value={doc.name}>{doc.name}</option>
                  ))}
                </select>
              </div>

              {/* Beds & Staff side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <BedDouble size={11} className="text-[#3683F8]" /> Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 20"
                    value={editDeptBeds}
                    onChange={(e) => setEditDeptBeds(e.target.value)}
                    className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Users size={11} className="text-purple-500" /> Staff Assigned
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 10"
                    value={editDeptStaff}
                    onChange={(e) => setEditDeptStaff(e.target.value)}
                    className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] font-mono"
                  />
                </div>
              </div>

              {/* Wing Status */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Wing Operational Status</label>
                <select
                  value={editDeptStatus}
                  onChange={(e) => setEditDeptStatus(e.target.value as any)}
                  className="w-full h-10 border border-[#D8D8D8] bg-white text-[#060606] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8]"
                >
                  <option value="Active">Active &amp; Operational</option>
                  <option value="Setup Required">Setup / Onboarding Stage</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDeptModalOpen(false)}
                  className="h-10 text-xs font-bold border-[#D8D8D8]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10 bg-[#3683F8] hover:bg-blue-600 text-white font-bold text-xs px-4 rounded-xl"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
