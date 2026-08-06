import { useState, useEffect } from 'react';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import type { PharmacyBill } from '../../store/usePharmacyStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FileText, Printer, ClipboardList } from 'lucide-react';
import { getPrintSettings, PRINT_SETTINGS_EVENT } from '../../utils/printSettings';
import type { PrintSettings } from '../../utils/printSettings';
import { printIsolatedHtml } from '../../utils/printHelper';
import { buildPharmacyBillSlipHtml } from '../../utils/thermalSlipTemplates';

export function PharmacyOrders() {
  const { bills } = usePharmacyStore();
  const [selectedBill, setSelectedBill] = useState<PharmacyBill | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // Bills Columns
  const billColumns = [
    { key: 'id', header: 'Bill ID' },
    { key: 'rxCode', header: 'RX Code' },
    { key: 'patientName', header: 'Patient Name' },
    { key: 'patientPhone', header: 'Patient Phone' },
    {
      key: 'total',
      header: 'Total Bill',
      render: (item: PharmacyBill) => <span className="font-extrabold text-blue-600 font-mono">₹{item.total.toFixed(2)}</span>
    },
    {
      key: 'paymentMode',
      header: 'Payment Mode',
      render: (item: PharmacyBill) => (
        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded text-[9px] uppercase font-mono">
          {item.paymentMode}
        </span>
      )
    },
    { key: 'date', header: 'Date Processed' },
    {
      key: 'action',
      header: 'Receipt',
      render: (item: PharmacyBill) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelectedBill(item);
            setIsModalOpen(true);
          }}
          className="h-7 text-[10px] rounded-full flex items-center gap-1 font-bold"
        >
          <FileText size={12} /> Reprint Slip
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="text-blue-600" /> Bills & Pharmacy Returns
          </h1>
          <p className="text-slate-500">Track and manage all processed physical customer invoices dispensed at checkout POS terminals.</p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div>
          <DataTable columns={billColumns} data={bills} className="border-0 shadow-none text-xs font-semibold text-slate-700" />
          {bills.length === 0 && (
            <div className="text-center py-16 text-slate-400 font-bold">
              No processed bills logged yet. Dispense items at the POS!
            </div>
          )}
        </div>
      </div>

      {/* Reprint Receipt Modal */}
      {isModalOpen && selectedBill && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Thermal Bill Receipt Reprint">
          <div className="p-4 flex flex-col items-center">

            {/* 3-inch Print Slip Mock */}
            <div
              id="pharmacy-thermal-slip"
              className="bg-white border shadow-sm text-slate-800 transition-all duration-250 max-h-[380px] overflow-y-auto"
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
                <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-1">
                  <h3 className="font-extrabold text-xs uppercase tracking-wide" style={{ color: printSettings.accentColor }}>
                    🏥 {printSettings.customHeaderText || 'Smart Hospital Pharmacy'}
                  </h3>
                  <p className="text-[8px] text-slate-500">Live Pharmacy Checkout Invoice</p>
                  <p className="text-[7px] text-slate-400">DUPLICATE RECEIPT</p>
                </div>
              )}

              <div className="space-y-1 mb-2 text-[8px] text-slate-600 border-b border-dashed border-slate-350 pb-1.5 mt-2">
                <div>BILL ID: <span className="text-slate-800 font-bold">{selectedBill.id}</span></div>
                <div>RX CODE: <span className="text-slate-800 font-bold">{selectedBill.rxCode}</span></div>
                <div>PATIENT: <span className="text-slate-800 font-bold">{selectedBill.patientName}</span></div>
                <div>PHONE: <span className="text-slate-800">{selectedBill.patientPhone}</span></div>
                <div>DOCTOR: <span className="text-slate-800">{selectedBill.doctorName}</span></div>
                <div>DATE/TIME: <span className="text-slate-800">{selectedBill.date}</span></div>
              </div>

              {/* Items Table */}
              <div className="space-y-1 mb-2 text-[8px]">
                <div className="flex justify-between border-b border-slate-300 pb-1 font-bold text-slate-700">
                  <span className="w-1/2">Medicine</span>
                  <span className="w-1/12 text-center">Qty</span>
                  <span className="w-4/12 text-right">Subtotal</span>
                </div>
                {selectedBill.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between py-0.5 text-slate-600">
                    <span className="w-1/2 truncate">{item.name}</span>
                    <span className="w-1/12 text-center">{item.qty}</span>
                    <span className="w-4/12 text-right">₹{(item.qty * item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="border-t border-dashed border-slate-400 pt-2 space-y-1 text-[8px] text-slate-700 font-bold">
                <div className="flex justify-between text-slate-900 text-[10px]">
                  <span>GRAND TOTAL:</span>
                  <span style={{ color: printSettings.accentColor }}>₹{selectedBill.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[8px] text-slate-500 font-semibold uppercase">
                  <span>PAYMENT MODE:</span>
                  <span>{selectedBill.paymentMode}</span>
                </div>
                <div className="flex justify-between text-[8px] text-slate-450 font-normal">
                  <span>STATUS:</span>
                  <span className="text-emerald-600 font-bold">DISPENSED ✓</span>
                </div>
              </div>

              {printSettings.showFooter && (
                <div className="text-center pt-2.5 border-t border-dashed border-slate-300 mt-2 space-y-1">
                  <p className="text-[7.5px] text-slate-400 uppercase tracking-wider leading-normal">E &amp; O.E</p>
                  <p className="text-[7.5px] text-slate-600 font-semibold leading-normal">
                    {printSettings.customFooterText || 'Keep medicines out of reach of children.'}
                  </p>
                  <p className="text-[9px] font-extrabold text-slate-800 tracking-tight pt-0.5">Thank You</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 w-full border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close Slip</Button>
              <Button
                className="flex gap-2"
                onClick={() => {
                  const slipHtml = buildPharmacyBillSlipHtml({
                    billId:       selectedBill.id,
                    rxCode:       selectedBill.rxCode,
                    patientName:  selectedBill.patientName,
                    patientPhone: selectedBill.patientPhone,
                    doctorName:   selectedBill.doctorName,
                    date:         selectedBill.date,
                    items:        selectedBill.items.map((item: any) => ({
                                    name:  item.name,
                                    qty:   item.qty,
                                    price: item.price,
                                  })),
                    total:        selectedBill.total,
                    paymentMode:  selectedBill.paymentMode,
                  });

          printIsolatedHtml("Pharmacy Bill Receipt", slipHtml);
          setIsModalOpen(false);
                }}

              >
          <Printer size={16} /> Execute Print
        </Button>
            </div>

          </div >
        </Modal >
      )
}

    </div >
  );
}
