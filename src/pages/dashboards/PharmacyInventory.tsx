import React, { useState, useMemo } from 'react';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import type { Medicine } from '../../store/usePharmacyStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { 
  Pill, 
  Plus, 
  Download, 
  Search, 
  HardDrive, 
  Edit, 
  Trash2, 
  Package, 
  AlertTriangle, 
  AlertOctagon,
  TrendingUp
} from 'lucide-react';
import { Input } from '../../components/ui/Input';

export function PharmacyInventory() {
  const { 
    inventory, 
    addMedicine, 
    receiveStockBatch,
    updateMedicine,
    deleteMedicine
  } = usePharmacyStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Analgesic');
  const [batchNo, setBatchNo] = useState('');
  const [location, setLocation] = useState('');
  const [stock, setStock] = useState('100');
  const [minThreshold, setMinThreshold] = useState('20');
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [price, setPrice] = useState('15.00');

  // Receive Batch Form fields
  const [rxMedName, setRxMedName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [batchNoRx, setBatchNoRx] = useState('');
  const [expiryRx, setExpiryRx] = useState('');
  const [qtyRx, setQtyRx] = useState('100');

  // Calculate Report Summary stats
  const reports = useMemo(() => {
    const totalUnique = inventory.length;
    const totalUnits = inventory.reduce((sum, item) => sum + item.stock, 0);
    const lowStockCount = inventory.filter(item => item.stock < item.minThreshold && item.stock > 0).length;
    const outOfStockCount = inventory.filter(item => item.stock === 0).length;
    
    return {
      totalUnique,
      totalUnits,
      lowStockCount,
      outOfStockCount
    };
  }, [inventory]);

  // Open Edit Modal & Populate Form
  const handleOpenEditModal = (med: Medicine) => {
    setEditingMedId(med.id);
    setName(med.name);
    setCategory(med.category);
    setBatchNo(med.batchNo);
    setLocation(med.location);
    setStock(med.stock.toString());
    setMinThreshold(med.minThreshold.toString());
    setExpiryDate(med.expiryDate);
    setPrice(med.price.toString());
    setIsEditModalOpen(true);
  };

  // Open Add Modal & Reset Form
  const handleOpenAddModal = () => {
    setName('');
    setCategory('Analgesic');
    setBatchNo('');
    setLocation('');
    setStock('100');
    setMinThreshold('20');
    setExpiryDate('2027-12-31');
    setPrice('15.00');
    setIsAddModalOpen(true);
  };

  // Columns Configuration
  const columns = [
    { key: 'id', header: 'Item ID' },
    { key: 'name', header: 'Medicine Name' },
    { key: 'batchNo', header: 'Batch No' },
    { key: 'location', header: 'Rack Location' },
    { 
      key: 'stock', 
      header: 'Current Stock',
      render: (item: Medicine) => (
        <span className="font-bold font-mono text-slate-800">{item.stock} Units</span>
      )
    },
    { 
      key: 'expiryDate', 
      header: 'Expiry Date',
      render: (item: Medicine) => {
        const expiry = new Date(item.expiryDate);
        const daysLeft = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysLeft > 0 && daysLeft <= 30;
        const isExpired = daysLeft <= 0;

        return (
          <span className={`font-mono text-xs font-semibold ${
            isExpired ? 'text-rose-600 font-bold' : isExpiringSoon ? 'text-amber-600 font-bold' : 'text-slate-600'
          }`}>
            {item.expiryDate} {isExpired ? '(Expired)' : isExpiringSoon ? '(Expiring Soon)' : ''}
          </span>
        );
      }
    },
    { 
      key: 'price', 
      header: 'Price/Unit',
      render: (item: Medicine) => <span className="font-bold text-blue-600 font-mono">₹{item.price.toFixed(2)}</span>
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (item: Medicine) => {
        if (item.stock === 0) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 border border-rose-200 text-rose-700">
              🔴 Critical
            </span>
          );
        } else if (item.stock < item.minThreshold) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 border border-amber-250 text-amber-700">
              🟡 Low Stock
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 border border-emerald-200 text-emerald-700">
              🟢 Healthy
            </span>
          );
        }
      }
    },
    {
      key: 'action',
      header: 'Actions',
      render: (item: Medicine) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => handleOpenEditModal(item)}
            title="Edit Medicine Details"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 text-[10px] font-bold transition-all"
          >
            <Edit size={11} /> Edit
          </button>
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete ${item.name} from pharmacy master catalog?`)) {
                deleteMedicine(item.id);
              }
            }}
            title="Delete Medicine Details"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[10px] font-bold transition-all"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )
    }
  ];

  // Submit Add Medicine Form
  const handleAddMedicineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !batchNo || !location || !stock || !price) return;

    addMedicine({
      code: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      category,
      batchNo,
      location,
      stock: Number(stock),
      minThreshold: Number(minThreshold),
      expiryDate,
      price: Number(price)
    });

    // Reset Form
    setName('');
    setBatchNo('');
    setLocation('');
    setStock('100');
    setMinThreshold('20');
    setExpiryDate('2027-12-31');
    setPrice('15.00');
    setIsAddModalOpen(false);
  };

  // Submit Edit Medicine Form
  const handleEditMedicineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMedId || !name || !batchNo || !location || !stock || !price) return;

    updateMedicine(editingMedId, {
      name,
      category,
      batchNo,
      location,
      stock: Number(stock),
      minThreshold: Number(minThreshold),
      expiryDate,
      price: Number(price)
    });

    // Reset Form & Close Modal
    setName('');
    setBatchNo('');
    setLocation('');
    setStock('100');
    setMinThreshold('20');
    setExpiryDate('2027-12-31');
    setPrice('15.00');
    setIsEditModalOpen(false);
    setEditingMedId(null);
  };

  // Submit Receive Batch Form
  const handleReceiveBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rxMedName || !supplier || !batchNoRx || !expiryRx || !qtyRx) return;

    receiveStockBatch({
      medicineName: rxMedName,
      supplier,
      batchNo: batchNoRx,
      expiryDate: expiryRx,
      qty: Number(qtyRx)
    });

    // Reset Form
    setRxMedName('');
    setSupplier('');
    setBatchNoRx('');
    setExpiryRx('');
    setQtyRx('100');
    setIsReceiveModalOpen(false);
  };

  // Filter inventory items based on search query
  const filteredData = inventory.filter(med => 
    med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    med.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    med.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Pill className="text-blue-600 animate-pulse" /> Inventory Master
          </h1>
          <p className="text-slate-500">Physical back room catalog & batch tracking dashboard</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsReceiveModalOpen(true)} variant="outline" className="flex gap-1.5 font-bold shadow-sm rounded-xl">
            <Download size={16} /> Receive Stock Batch
          </Button>
          <Button onClick={handleOpenAddModal} className="flex gap-1.5 font-bold shadow-lg shadow-blue-500/10 rounded-xl">
            <Plus size={16} /> Add New Medicine
          </Button>
        </div>
      </div>

      {/* COMPULSORY FEATURE: Live Inventory Diagnostic Reports Summary Card Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1: Total Unique Formulations */}
        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Unique Medicines</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {reports.totalUnique} <span className="text-xs font-bold text-slate-400">Types</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold">Different drug formulas</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-200/50 flex items-center justify-center">
            <Pill size={18} />
          </div>
        </div>

        {/* Metric 2: Total Units Shelved */}
        <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Shelf Stock</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {reports.totalUnits.toLocaleString('en-IN')} <span className="text-xs font-bold text-slate-400">Units</span>
            </h3>
            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <TrendingUp size={10} /> Active replenishment
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200/50 flex items-center justify-center">
            <Package size={18} />
          </div>
        </div>

        {/* Metric 3: Low Stock Batches */}
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Low Stock Alerts</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {reports.lowStockCount} <span className="text-xs font-bold text-slate-400">Batches</span>
            </h3>
            <p className="text-[10px] text-amber-600 font-bold">Below safety thresholds</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200/50 flex items-center justify-center">
            <AlertTriangle size={18} />
          </div>
        </div>

        {/* Metric 4: Empty Shelves */}
        <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Out of Stock</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {reports.outOfStockCount} <span className="text-xs font-bold text-slate-400">Items</span>
            </h3>
            <p className="text-[10px] text-rose-600 font-bold">Critically empty shelf slots</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-200/50 flex items-center justify-center">
            <AlertOctagon size={18} />
          </div>
        </div>

      </div>

      {/* Main Catalog Directory */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Search catalog by name, code or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <DataTable columns={columns} data={filteredData} className="border-0 shadow-none text-xs font-semibold text-slate-700" />
      </div>

      {/* Modal A: Add New Medicine */}
      {isAddModalOpen && (
        <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Medicine Catalog Entry">
          <form onSubmit={handleAddMedicineSubmit} className="space-y-4 p-4">
            <Input 
              label="Medicine Name" 
              placeholder="e.g. Paracetamol 650mg" 
              required
              value={name}
              onChange={e => setName(e.target.value)}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-355 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option>Analgesic</option>
                  <option>Antibiotic</option>
                  <option>Antihypertensive</option>
                  <option>Antidiabetic</option>
                  <option>Antihistamine</option>
                  <option>General Wings</option>
                </select>
              </div>

              <Input 
                label="Rack Location" 
                placeholder="e.g. Rack A-3" 
                required
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input 
                label="Batch Number" 
                placeholder="B-998A" 
                required
                value={batchNo}
                onChange={e => setBatchNo(e.target.value)}
              />
              <Input 
                label="Initial Stock" 
                type="number"
                required
                value={stock}
                onChange={e => setStock(e.target.value)}
              />
              <Input 
                label="Min Safety Stock" 
                type="number"
                required
                value={minThreshold}
                onChange={e => setMinThreshold(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Expiry Date" 
                type="date"
                required
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
              <Input 
                label="Price Per Unit (₹)" 
                type="number"
                step="0.01"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button type="submit">Catalog Medicine</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal B: Receive Stock Batch */}
      {isReceiveModalOpen && (
        <Modal isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} title="Receive Supplier Stock Batch">
          <form onSubmit={handleReceiveBatchSubmit} className="space-y-4 p-4">
            
            <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-[11px] font-semibold leading-relaxed flex gap-2">
              <HardDrive size={18} className="text-blue-500 shrink-0 mt-0.5 animate-bounce" />
              <p>Receiving stock automatically updates the catalog items. If the medicine name is recognized, quantities increment in-place under the new batch details.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select or Enter Medicine Name</label>
              <input 
                type="text" 
                placeholder="Type medicine name exactly (e.g. Paracetamol 500mg)..." 
                required
                value={rxMedName}
                onChange={e => setRxMedName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-355 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-semibold"
                list="med-auto-list"
              />
              <datalist id="med-auto-list">
                {inventory.map(m => <option key={m.id} value={m.name} />)}
              </datalist>
            </div>

            <Input 
              label="Supplier Company" 
              placeholder="e.g. PharmaCorp Supplies India" 
              required
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
            />

            <div className="grid grid-cols-3 gap-4">
              <Input 
                label="Batch Number" 
                placeholder="e.g. B-RECV-77" 
                required
                value={batchNoRx}
                onChange={e => setBatchNoRx(e.target.value)}
              />
              <Input 
                label="Expiry Date" 
                type="date"
                required
                value={expiryRx}
                onChange={e => setExpiryRx(e.target.value)}
              />
              <Input 
                label="Quantity Received" 
                type="number"
                required
                value={qtyRx}
                onChange={e => setQtyRx(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsReceiveModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                ⬇️ Receive & Restock
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal C: Edit Medicine Entry */}
      {isEditModalOpen && (
        <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingMedId(null); }} title="Edit Medicine Catalog Entry">
          <form onSubmit={handleEditMedicineSubmit} className="space-y-4 p-4">
            <Input 
              label="Medicine Name" 
              placeholder="e.g. Paracetamol 650mg" 
              required
              value={name}
              onChange={e => setName(e.target.value)}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-350 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option>Analgesic</option>
                  <option>Antibiotic</option>
                  <option>Antihypertensive</option>
                  <option>Antidiabetic</option>
                  <option>Antihistamine</option>
                  <option>General Wings</option>
                </select>
              </div>

              <Input 
                label="Rack Location" 
                placeholder="e.g. Rack A-3" 
                required
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input 
                label="Batch Number" 
                placeholder="B-998A" 
                required
                value={batchNo}
                onChange={e => setBatchNo(e.target.value)}
              />
              <Input 
                label="Current Stock" 
                type="number"
                required
                value={stock}
                onChange={e => setStock(e.target.value)}
              />
              <Input 
                label="Min Safety Stock" 
                type="number"
                required
                value={minThreshold}
                onChange={e => setMinThreshold(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Expiry Date" 
                type="date"
                required
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
              <Input 
                label="Price Per Unit (₹)" 
                type="number"
                step="0.01"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); setEditingMedId(null); }}>Cancel</Button>
              <Button type="submit">Update Medicine</Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
