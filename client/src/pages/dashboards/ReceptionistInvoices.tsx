import { useState, useEffect } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { PatientInvoice } from '../../store/useHospitalStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { 
  Receipt, Printer, Search, CreditCard, CheckCircle2, 
  DollarSign, Clock, TrendingUp
} from 'lucide-react';
import { getPrintSettings, PRINT_SETTINGS_EVENT } from '../../utils/printSettings';
import type { PrintSettings } from '../../utils/printSettings';
import { printIsolatedHtml } from '../../utils/printHelper';

export function ReceptionistInvoices() {
  const { invoices, collectPatientFee, hospitalName } = useHospitalStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Paid' | 'Pending'>('All');
  
  const [printInvoiceData, setPrintInvoiceData] = useState<PatientInvoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [printSettings, setPrintSettings] = useState<PrintSettings>(getPrintSettings());

  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail) {
        setPrintSettings(e.detail);
      }
    };
    window.addEventListener(PRINT_SETTINGS_EVENT, handleSettingsChange);
    return () => {
      window.removeEventListener(PRINT_SETTINGS_EVENT, handleSettingsChange);
    };
  }, []);

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.patientName.toLowerCase().includes(search.toLowerCase()) ||
      inv.patientPhone.includes(search) ||
      inv.id.toLowerCase().includes(search.toLowerCase()) ||
      inv.doctorName.toLowerCase().includes(search.toLowerCase());
    
    if (filterStatus === 'All') return matchesSearch;
    return matchesSearch && inv.status === filterStatus;
  });

  // Calculate KPIs
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalCollected = invoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0);
  const totalPending = invoices.filter(inv => inv.status === 'Pending').reduce((sum, inv) => sum + inv.amount, 0);
  const clearanceRate = invoices.length > 0 ? Math.round((invoices.filter(inv => inv.status === 'Paid').length / invoices.length) * 100) : 100;

  const handlePrint = (invoice: PatientInvoice) => {
    setPrintInvoiceData(invoice);
    setIsPrintModalOpen(true);
  };

  const handleCollect = (invoiceId: string) => {
    collectPatientFee(invoiceId);
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header and Summary */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="text-blue-600" /> OPD Billing & Receipts
          </h1>
          <p className="text-slate-500">Manage patient payments, collect dues, and print thermal receipts</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Invoiced</p>
            <h3 className="text-xl font-extrabold text-slate-800 mt-1">₹{totalInvoiced.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Total revenue generated</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Collected</p>
            <h3 className="text-xl font-extrabold text-emerald-700 mt-1">₹{totalCollected.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">Cleared in-cash receipts</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Outstanding Dues</p>
            <h3 className="text-xl font-extrabold text-rose-700 mt-1">₹{totalPending.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-rose-600 font-semibold mt-1">Awaiting checkout desks</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <Clock size={20} />
          </div>
        </div>

        {/* Clearance Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Clearance Rate</p>
            <h3 className="text-xl font-extrabold text-indigo-700 mt-1">{clearanceRate}%</h3>
            <p className="text-[10px] text-indigo-600 font-semibold mt-1">Paid vs outstanding ratio</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Main Data Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 flex flex-col flex-1 overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search invoice, patient, doctor..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs font-semibold text-slate-700" 
            />
          </div>

          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60 w-full sm:w-auto">
            {(['All', 'Paid', 'Pending'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === status 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status} Invoices
              </button>
            ))}
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3.5">Invoice ID</th>
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Assigned Doctor & Fee Type</th>
                <th className="px-5 py-3.5">Billing Date</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold">
              {filteredInvoices.map((invoice) => {
                const isPaid = invoice.status === 'Paid';
                return (
                  <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="px-2 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold font-mono">
                        {invoice.id}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-slate-800">{invoice.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">{invoice.patientPhone}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-700">{invoice.doctorName}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">{invoice.feeType}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-medium">
                      {invoice.date}
                    </td>
                    <td className="px-5 py-4 text-slate-800 font-extrabold text-sm">
                      ₹{invoice.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isPaid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                          : 'bg-rose-50 text-rose-700 border-rose-200/50 animate-pulse'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {!isPaid && (
                          <Button 
                            size="sm" 
                            onClick={() => handleCollect(invoice.id)}
                            className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] h-8 font-bold flex gap-1 items-center"
                          >
                            <CreditCard size={12} /> Collect
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handlePrint(invoice)}
                          className="rounded-lg text-[10px] h-8 font-bold text-slate-600 hover:text-slate-800 flex gap-1 items-center"
                        >
                          <Printer size={12} /> Slip
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-bold">
                    No matching invoices found in SaaS records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-Inch Thermal Slip Modal */}
      <Modal 
        isOpen={isPrintModalOpen} 
        onClose={() => setIsPrintModalOpen(false)} 
        title="Thermal Slip Print Preview"
        className="max-w-xs sm:max-w-sm"
      >
        {printInvoiceData && (
          <div className="space-y-5">
            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 flex justify-center">
              <div 
                id="thermal-slip-template" 
                className="bg-white border shadow-sm text-slate-900 transition-all duration-250 max-h-[380px] overflow-y-auto"
                style={{
                  width: printSettings.paperSize === 'A4' ? '260px' : '190px',
                  padding: `${printSettings.padding}px`,
                  margin: `${printSettings.margin}px`,
                  fontSize: `${printSettings.fontSize}px`,
                  fontFamily: printSettings.paperSize === 'A4' ? 'sans-serif' : 'monospace',
                  borderTop: `4px solid ${printSettings.accentColor}`
                }}
              >
                {printSettings.showHeader && (
                  <div className="text-center pb-2 border-b border-dashed border-slate-350 space-y-1">
                    <h3 className="font-extrabold text-xs uppercase tracking-wider" style={{ color: printSettings.accentColor }}>
                      🏥 {printSettings.customHeaderText || hospitalName}
                    </h3>
                    <p className="text-[8px] text-slate-500">Live Clinical Registry Slip</p>
                    <p className="text-[7px] text-slate-400">Date: {printInvoiceData.date}</p>
                  </div>
                )}

                <div className="text-center py-2 border rounded my-2 bg-slate-50/50 space-y-0.5" style={{ borderColor: `${printSettings.accentColor}30` }}>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Transaction Status</p>
                  <h2 className={`text-sm font-black leading-none ${printInvoiceData.status === 'Paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {printInvoiceData.status === 'Paid' ? 'PAID & CLEARED' : 'PENDING DUE'}
                  </h2>
                  <p className="text-[8px] font-extrabold text-slate-500">{printInvoiceData.doctorName}</p>
                </div>

                <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[0.9em]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Patient:</span>
                    <span className="font-bold">{printInvoiceData.patientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Ref:</span>
                    <span className="font-bold">{printInvoiceData.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-bold">{printInvoiceData.patientPhone}</span>
                  </div>
                </div>

                <div className="space-y-1 pb-1 text-[0.9em]">
                  <div className="flex justify-between font-bold">
                    <span>{printInvoiceData.feeType}:</span>
                    <span>₹{printInvoiceData.amount}</span>
                  </div>
                  <div className="flex justify-between font-black border-t pt-1.5 mt-1" style={{ borderTopColor: printSettings.accentColor }}>
                    <span>Total Amount:</span>
                    <span style={{ color: printSettings.accentColor }}>₹{printInvoiceData.amount}</span>
                  </div>
                </div>

                {printSettings.showFooter && (
                  <div className="text-center pt-3 border-t border-dashed border-slate-300 space-y-1.5">
                    <div className="h-5 w-full flex items-center justify-center text-[7px] text-white tracking-[6px] font-bold rounded" style={{ backgroundColor: printSettings.accentColor }}>
                      |||||||||||||||||||||||
                    </div>
                    <p className="text-[7.5px] text-slate-400 uppercase tracking-wider leading-normal">
                      {printSettings.customFooterText || (printInvoiceData.status === 'Paid' ? 'Thank you for cooperation' : 'Please settle outstanding payment')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  const headerTitle = printSettings.showHeader 
                    ? `<div class="text-center pb-2 dashed-divider">
                         ${printSettings.logoUrl ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${printSettings.logoUrl}" style="max-height: 40px; max-width: 100%; object-fit: contain;" /></div>` : ''}
                         <h3 class="font-extrabold uppercase brand-accent-text" style="margin: 0; font-size: 1.15em;">🏥 ${printSettings.customHeaderText || hospitalName}</h3>
                         <p style="margin: 2px 0 0 0; font-size: 0.8em; color: #64748b;">Live Clinical Registry Slip</p>
                         <p style="margin: 2px 0 0 0; font-size: 0.7em; color: #94a3b8;">Date: ${printInvoiceData.date}</p>
                       </div>`
                    : '';

                  const footerContent = printSettings.showFooter
                    ? `<div class="text-center pt-3 dashed-divider">
                         <div class="barcode-container brand-accent-bg">|||||||||||||||||||||||</div>
                         <p style="margin: 4px 0 0 0; font-size: 0.78em; color: #64748b; text-transform: uppercase; leading-height: 1.3;">
                           ${printSettings.customFooterText || (printInvoiceData.status === 'Paid' ? 'Thank you for cooperation' : 'Please settle outstanding payment')}
                         </p>
                       </div>`
                    : '';

                  const slipHtml = `
                    <div style="font-family: monospace; font-size: ${printSettings.fontSize}px; line-height: 1.4;">
                      ${headerTitle}

                      <div class="text-center py-3 my-2" style="border: 1px solid ${printSettings.accentColor}30; border-radius: 8px; background-color: #f8fafc;">
                        <p style="margin: 0; font-size: 0.75em; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Transaction Status</p>
                        <h2 style="margin: 4px 0; font-size: 1.4em; font-weight: 900; line-height: 1; color: ${printInvoiceData.status === 'Paid' ? '#10b981' : '#f43f5e'};">
                          ${printInvoiceData.status === 'Paid' ? 'PAID & CLEARED' : 'PENDING DUE'}
                        </h2>
                        <p style="margin: 0; font-size: 0.8em; font-weight: bold; color: #334155;">${printInvoiceData.doctorName}</p>
                      </div>

                      <div class="dashed-divider"></div>

                      <div style="font-size: 0.9em; space-y: 4px;">
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span style="color: #64748b;">Patient:</span>
                          <span class="font-bold">${printInvoiceData.patientName}</span>
                        </div>
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span style="color: #64748b;">Invoice Ref:</span>
                          <span class="font-bold">${printInvoiceData.id}</span>
                        </div>
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span style="color: #64748b;">Contact:</span>
                          <span class="font-bold">${printInvoiceData.patientPhone}</span>
                        </div>
                      </div>

                      <div class="dashed-divider"></div>

                      <div style="font-size: 0.9em;">
                        <div class="flex justify-between" style="margin-bottom: 4px;">
                          <span>${printInvoiceData.feeType}:</span>
                          <span class="font-bold">₹${printInvoiceData.amount}</span>
                        </div>
                        <div class="flex justify-between font-black solid-divider pt-2" style="font-size: 1.1em;">
                          <span>Total Amount:</span>
                          <span class="brand-accent-text">₹${printInvoiceData.amount}</span>
                        </div>
                      </div>

                      ${footerContent}
                    </div>
                  `;

                  printIsolatedHtml("OPD Billing Receipt", slipHtml);
                  setIsPrintModalOpen(false);
                }} 
                className="flex-1 font-bold rounded-xl"
              >
                <Printer size={16} className="mr-1.5" /> Execute Print
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsPrintModalOpen(false)}
                className="flex-1 font-bold rounded-xl"
              >
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
