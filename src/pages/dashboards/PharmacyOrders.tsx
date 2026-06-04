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
          className="h-7 text-[10px] rounded-lg flex items-center gap-1 font-bold"
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
                    🏥 {printSettings.customHeaderText || 'MediSaaS Pharmacy Wing'}
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
                <div className="text-center pt-3 border-t border-dashed border-slate-300 mt-2 space-y-1.5">
                  <div className="h-5 w-full flex items-center justify-center text-[7px] text-white tracking-[6px] font-bold rounded" style={{ backgroundColor: printSettings.accentColor }}>
                    ||||| {selectedBill.id} |||||
                  </div>
                  <p className="text-[7px] text-slate-400 leading-normal uppercase">
                    {printSettings.customFooterText || 'Reprinted duplicate slip. Powered by MediSaaS.'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 w-full border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close Slip</Button>
              <Button 
                className="flex gap-2" 
                onClick={() => {
                  const headerTitle = printSettings.showHeader 
                    ? `<div class="text-center pb-2 dashed-divider">
                         ${printSettings.logoUrl ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${printSettings.logoUrl}" style="max-height: 40px; max-width: 100%; object-fit: contain;" /></div>` : ''}
                         <h3 class="font-extrabold uppercase brand-accent-text" style="margin: 0; font-size: 1.15em;">🏥 ${printSettings.customHeaderText || 'MediSaaS Pharmacy Wing'}</h3>
                         <p style="margin: 2px 0 0 0; font-size: 0.8em; color: #64748b;">Live Pharmacy Checkout Invoice</p>
                         <p style="margin: 2px 0 0 0; font-size: 0.7em; color: #94a3b8;">DUPLICATE RECEIPT</p>
                       </div>`
                    : '';

                  const footerContent = printSettings.showFooter
                    ? `<div class="text-center pt-3 dashed-divider">
                         <div class="barcode-container brand-accent-bg">||||| ${selectedBill.id} |||||</div>
                         <p style="margin: 4px 0 0 0; font-size: 0.78em; color: #64748b; text-transform: uppercase;">
                           ${printSettings.customFooterText || 'Reprinted duplicate slip. Powered by MediSaaS.'}
                         </p>
                       </div>`
                    : '';

                  const itemsHtml = selectedBill.items.map((item: any) => `
                    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.9em;">
                      <td style="padding: 4px 0; text-align: left; font-weight: bold;">${item.name}</td>
                      <td style="padding: 4px 0; text-align: center;">${item.qty}</td>
                      <td style="padding: 4px 0; text-align: right; font-weight: bold;">₹${(item.qty * item.price).toFixed(2)}</td>
                    </tr>
                  `).join('');

                  const slipHtml = `
                    <div style="font-family: monospace; font-size: ${printSettings.fontSize}px; line-height: 1.4;">
                      ${headerTitle}

                      <div style="font-size: 0.85em; margin-bottom: 6px;">
                        <div>BILL ID: <strong>${selectedBill.id}</strong></div>
                        <div>RX CODE: <strong>${selectedBill.rxCode}</strong></div>
                        <div>PATIENT: <strong>${selectedBill.patientName}</strong></div>
                        <div>PHONE: <strong>${selectedBill.patientPhone}</strong></div>
                        <div>DOCTOR: <strong>Dr. ${selectedBill.doctorName}</strong></div>
                        <div>DATE/TIME: <strong>${selectedBill.date}</strong></div>
                      </div>

                      <div class="dashed-divider"></div>

                      <table>
                        <thead>
                          <tr>
                            <th style="text-align: left;">Item</th>
                            <th style="text-align: center; width: 40px;">Qty</th>
                            <th style="text-align: right; width: 80px;">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${itemsHtml}
                        </tbody>
                      </table>

                      <div class="dashed-divider"></div>

                      <div style="font-size: 0.9em; font-weight: bold;">
                        <div class="flex justify-between" style="font-size: 1.1em; font-weight: 900; margin-top: 4px;">
                          <span>GRAND TOTAL:</span>
                          <span class="brand-accent-text">₹${selectedBill.total.toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between" style="font-size: 0.85em; color: #475569; margin-top: 4px;">
                          <span>PAYMENT MODE:</span>
                          <span>${selectedBill.paymentMode}</span>
                        </div>
                      </div>

                      ${footerContent}
                    </div>
                  `;

                  printIsolatedHtml("Pharmacy Bill Receipt", slipHtml);
                  setIsModalOpen(false);
                }}
              >
                <Printer size={16} /> Execute Print
              </Button>
            </div>

          </div>
        </Modal>
      )}

    </div>
  );
}
