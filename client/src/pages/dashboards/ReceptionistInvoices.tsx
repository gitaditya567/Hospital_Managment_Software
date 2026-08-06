import { useState, useEffect } from 'react';
import { useHospitalStore } from '../../store/useHospitalStore';
import type { PatientInvoice } from '../../store/useHospitalStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  Receipt, Printer, Search, CreditCard, CheckCircle2,
  IndianRupee, Clock, TrendingUp
} from 'lucide-react';
import { getPrintSettings, PRINT_SETTINGS_EVENT } from '../../utils/printSettings';
import type { PrintSettings } from '../../utils/printSettings';
import { printIsolatedHtml } from '../../utils/printHelper';
import { buildOpdBillingSlipHtml } from '../../utils/thermalSlipTemplates';

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
    <div className="space-y-6 flex flex-col h-full font-sans pb-16">
      {/* Header and Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#3683F8] p-6 rounded-2xl shadow-lg border border-blue-400/30 text-white relative overflow-hidden">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Receipt size={22} className="text-blue-100" /> OPD Billing &amp; Receipts Ledger
          </h1>
          <p className="text-blue-50 text-xs">Manage patient payments, collect dues, and print thermal receipts</p>
        </div>
        <div className="text-xs bg-white/15 px-4 py-2.5 rounded-xl border border-white/20 text-white font-semibold backdrop-blur-xs">
          Clearance Rate: <span className="font-extrabold text-emerald-300">{clearanceRate}%</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white p-5 rounded-2xl border border-[#D8D8D8] shadow-xs flex items-center justify-between hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-[#3683F8] uppercase tracking-wider">Total Invoiced</p>
            <h3 className="text-2xl font-extrabold text-[#060606] tracking-tight">₹{totalInvoiced.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-slate-400 font-semibold">Total revenue generated</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-[#EBF3FE] border border-blue-200 text-[#3683F8] flex items-center justify-center">
            <IndianRupee size={22} />
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-5 rounded-2xl border border-[#D8D8D8] shadow-xs flex items-center justify-between hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Total Collected</p>
            <h3 className="text-2xl font-extrabold text-[#060606] tracking-tight">₹{totalCollected.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-emerald-600 font-semibold">Cleared in-cash receipts</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="bg-white p-5 rounded-2xl border border-[#D8D8D8] shadow-xs flex items-center justify-between hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Outstanding Dues</p>
            <h3 className="text-2xl font-extrabold text-[#060606] tracking-tight">₹{totalPending.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-rose-600 font-semibold">Awaiting checkout desks</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        {/* Clearance Rate */}
        <div className="bg-white p-5 rounded-2xl border border-[#D8D8D8] shadow-xs flex items-center justify-between hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-[#3683F8] uppercase tracking-wider">Clearance Rate</p>
            <h3 className="text-2xl font-extrabold text-[#060606] tracking-tight">{clearanceRate}%</h3>
            <p className="text-[10px] text-blue-600 font-semibold">Paid vs outstanding ratio</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-[#EBF3FE] border border-blue-200 text-[#3683F8] flex items-center justify-center">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* Main Data Section */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#D8D8D8] flex flex-col flex-1 overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-[#D8D8D8] flex flex-col sm:flex-row gap-3 justify-between items-center bg-[#EBF3FE]/30">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice, patient, doctor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#D8D8D8] rounded-xl focus:ring-2 focus:ring-[#3683F8]/20 focus:border-[#3683F8] outline-none text-xs font-semibold text-[#060606] bg-white"
            />
          </div>

          <div className="flex gap-1.5 p-1 bg-white rounded-xl border border-[#D8D8D8] w-full sm:w-auto">
            {(['All', 'Paid', 'Pending'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === status 
                    ? 'bg-[#3683F8] text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-[#EBF3FE]/50'
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
              <tr className="bg-[#EBF3FE]/50 border-b border-[#D8D8D8] text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3.5">Invoice ID</th>
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Assigned Doctor &amp; Fee Type</th>
                <th className="px-5 py-3.5">Billing Date</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8D8D8]/60 text-slate-700 text-xs font-semibold">
              {filteredInvoices.map((invoice) => {
                const isPaid = invoice.status === 'Paid';
                return (
                  <tr key={invoice.id} className="hover:bg-[#EBF3FE]/20 transition-colors">
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 bg-[#EBF3FE] border border-blue-200 text-[#3683F8] rounded-lg font-bold font-mono text-[10px]">
                        {invoice.id}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-[#060606]">{invoice.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">{invoice.patientPhone}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-[#060606]">{invoice.doctorName}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">{invoice.feeType}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-medium">
                      {invoice.date}
                    </td>
                    <td className="px-5 py-4 text-[#060606] font-extrabold text-sm">
                      ₹{invoice.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isPaid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
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
                            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] h-8 font-bold flex gap-1 items-center shadow-xs"
                          >
                            <CreditCard size={12} /> Collect
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrint(invoice)}
                          className="rounded-xl text-[10px] h-8 font-bold text-[#3683F8] border-[#D8D8D8] hover:bg-[#EBF3FE] flex gap-1 items-center"
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
          <div className="space-y-5 font-sans">
            <div className="bg-[#EBF3FE]/40 p-4 rounded-2xl border border-[#D8D8D8] flex justify-center">
              <div
                id="thermal-slip-template"
                className="bg-white border border-[#D8D8D8] shadow-xs text-[#060606] transition-all duration-250 font-mono text-[10px] rounded-xl w-full max-w-[220px]"
                style={{
                  padding: `${printSettings.padding}px`,
                  fontSize: `${printSettings.fontSize}px`,
                  fontFamily: 'monospace',
                  borderTop: `4px solid ${printSettings.accentColor}`
                }}
              >
                {printSettings.showHeader && (
                  <div className="text-center pb-2 border-b border-dashed border-[#D8D8D8] space-y-1">
                    {printSettings.logoUrl && (
                      <div className="flex justify-center mb-1">
                        <img src={printSettings.logoUrl} alt="Logo" className="max-h-8 object-contain" />
                      </div>
                    )}
                    <h3 className="font-extrabold text-xs uppercase tracking-wider" style={{ color: printSettings.accentColor }}>
                      {printSettings.customHeaderText || hospitalName}
                    </h3>
                    <div className="flex justify-between text-[7px] text-slate-500 pt-1 border-t border-dashed border-slate-200">
                      <span>Bill No: <strong>{printInvoiceData.id}</strong></span>
                      <span>Date: <strong>{printInvoiceData.date}</strong></span>
                    </div>
                  </div>
                )}

                <div className="text-center py-2 border rounded-xl my-2 bg-[#EBF3FE]/50 space-y-0.5" style={{ borderColor: `${printSettings.accentColor}30` }}>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Transaction Status</p>
                  <h2 className={`text-sm font-black leading-none ${printInvoiceData.status === 'Paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {printInvoiceData.status === 'Paid' ? 'PAID & CLEARED' : 'PENDING DUE'}
                  </h2>
                  <p className="text-[8px] font-extrabold text-slate-500">{printInvoiceData.doctorName}</p>
                </div>

                <div className="space-y-1 border-b border-dashed border-[#D8D8D8] pb-2 text-[0.9em]">
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
                    <span>TOTAL AMOUNT:</span>
                    <span style={{ color: printSettings.accentColor }}>₹{printInvoiceData.amount}</span>
                  </div>
                </div>

                {printSettings.showFooter && (
                  <div className="text-center pt-2.5 border-t border-dashed border-[#D8D8D8] mt-2 space-y-1">
                    <p className="text-[7.5px] text-slate-400 uppercase tracking-wider leading-normal">E &amp; O.E</p>
                    <p className="text-[7.5px] text-slate-600 font-semibold leading-normal">
                      {printSettings.customFooterText || (printInvoiceData.status === 'Paid' ? 'Thank you for your cooperation' : 'Please settle outstanding payment')}
                    </p>
                    <p className="text-[9px] font-extrabold text-slate-800 tracking-tight pt-0.5">Thank You</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const slipHtml = buildOpdBillingSlipHtml({
                    patientName:  printInvoiceData.patientName,
                    patientPhone: printInvoiceData.patientPhone,
                    invoiceId:    printInvoiceData.id,
                    doctorName:   printInvoiceData.doctorName,
                    feeType:      printInvoiceData.feeType,
                    amount:       printInvoiceData.amount,
                    date:         printInvoiceData.date,
                    status:       printInvoiceData.status as 'Paid' | 'Pending',
                  });
                  printIsolatedHtml("OPD Billing Receipt", slipHtml);
                  setIsPrintModalOpen(false);
                }}

                className="flex-1 font-bold rounded-xl bg-[#3683F8] hover:bg-blue-600 text-white"
              >
                <Printer size={16} className="mr-1.5" /> Execute Print
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsPrintModalOpen(false)}
                className="flex-1 font-bold rounded-xl border-[#D8D8D8]"
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
