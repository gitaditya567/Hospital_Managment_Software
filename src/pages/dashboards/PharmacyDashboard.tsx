import React, { useState, useEffect, useRef } from 'react';
import { usePharmacyStore } from '../../store/usePharmacyStore';
import { Button } from '../../components/ui/Button';
import { Search, Printer, Pill, X, AlertTriangle, AlertOctagon, Terminal, ShoppingCart } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { getPrintSettings, PRINT_SETTINGS_EVENT } from '../../utils/printSettings';
import type { PrintSettings } from '../../utils/printSettings';
import { printIsolatedHtml } from '../../utils/printHelper';

export function PharmacyDashboard() {
  const {
    inventory,
    prescriptions,
    dispensePrescription,
    transactionLogs
  } = usePharmacyStore();

  const [searchCode, setSearchCode] = useState('');
  const [activePrescription, setActivePrescription] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [dispensedBill, setDispensedBill] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

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

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Reusable function to perform search and load prescription
  const performLookup = (val: string): boolean => {
    let query = val.trim().toUpperCase();
    if (!query) return false;

    // COMPULSORY FIX: Smart RX Prefix & Hyphen Normalization
    // 1. If searching purely by short numbers (e.g. 9042), auto-prepend "RX-"
    if (/^\d+$/.test(query) && query.length < 6) {
      query = `RX-${query}`;
    }
    // 2. If searching with RX prefix but missing hyphen (e.g. RX9042), auto-insert hyphen
    if (query.startsWith('RX') && !query.startsWith('RX-')) {
      query = `RX-${query.slice(2)}`;
    }

    // Search by RX-Code
    let foundRx = prescriptions.find(p => p.id === query);

    // If not found, try searching by Phone Number
    if (!foundRx) {
      foundRx = prescriptions.find(p => p.patientPhone === query || p.patientPhone.replace(/\D/g, '') === query);
    }

    // If not found, try searching by patientNo (Unique Patient Number)
    if (!foundRx) {
      foundRx = prescriptions.find(p => p.patientNo && p.patientNo.toUpperCase() === query);
    }

    if (foundRx) {
      if (foundRx.status === 'DISPENSED') {
        setErrorMsg(`Prescription ${foundRx.id} has already been DISPENSED.`);
        setActivePrescription(null);
        return true;
      }

      setErrorMsg('');
      // Map prescription items to active items with matching medicine in inventory
      const mappedItems = foundRx.items.map(item => {
        const matchingMed = inventory.find(m => m.name.toLowerCase() === item.name.toLowerCase());
        return {
          medicineId: matchingMed ? matchingMed.id : `MED-TEMP-${Date.now()}`,
          name: item.name,
          dosage: '1-0-1 (Twice daily)', // Doctor's dosage from EMR
          qtyRequired: item.qty,
          stockAvailable: matchingMed ? matchingMed.stock : 0,
          price: matchingMed ? matchingMed.price : item.price || 15.00
        };
      });

      setActivePrescription({
        id: foundRx.id,
        patientNo: foundRx.patientNo,
        patientName: foundRx.patientName,
        patientPhone: foundRx.patientPhone,
        doctorName: foundRx.doctorName,
        date: foundRx.date,
        items: mappedItems
      });
      return true;
    }
    return false;
  };

  // Handle Prescription Search (RX-Code or Phone)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const query = searchCode.trim();
    if (!query) return;

    const found = performLookup(query);
    if (found) {
      setSearchCode('');
    } else {
      setErrorMsg('No active prescription found. Try searching RX-9042, RX-8022, or 9876543210.');
      setActivePrescription(null);
    }
  };

  // Update Item Quantity required
  const handleQtyChange = (medicineId: string, newQty: number) => {
    if (!activePrescription) return;
    const val = Math.max(0, newQty);
    const updated = activePrescription.items.map((item: any) => {
      if (item.medicineId === medicineId) {
        return { ...item, qtyRequired: val };
      }
      return item;
    });
    setActivePrescription({ ...activePrescription, items: updated });
  };

  // Remove Item from Prescription Bill
  const handleRemoveItem = (medicineId: string) => {
    if (!activePrescription) return;
    const updated = activePrescription.items.filter((item: any) => item.medicineId !== medicineId);
    setActivePrescription({ ...activePrescription, items: updated });
  };

  // Calculate Grand Total
  const grandTotal = React.useMemo(() => {
    if (!activePrescription) return 0;
    return activePrescription.items.reduce((sum: number, item: any) => sum + (item.qtyRequired * item.price), 0);
  }, [activePrescription]);

  // Handle Checkout (dispense & commit transaction)
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePrescription || activePrescription.items.length === 0) return;
    setErrorMsg('');

    // Map items to transaction format
    const billItems = activePrescription.items.map((item: any) => ({
      medicineId: item.medicineId,
      name: item.name,
      qty: item.qtyRequired,
      price: item.price
    }));

    const result = await dispensePrescription({
      rxCode: activePrescription.id,
      patientNo: activePrescription.patientNo,
      patientName: activePrescription.patientName,
      patientPhone: activePrescription.patientPhone,
      doctorName: activePrescription.doctorName,
      items: billItems,
      total: grandTotal,
      paymentMode: paymentMode
    });

    if (result.success && result.bill) {
      setDispensedBill(result.bill);
      setIsPrintModalOpen(true);
      setActivePrescription(null);
      setSearchCode('');
    } else {
      setErrorMsg(result.error || 'Transaction failed. Rollback triggered.');
    }
  };

  // Handle thermal printer slip action
  const triggerPrintReceipt = () => {
    if (!dispensedBill) return;

    const headerTitle = printSettings.showHeader
      ? `<div class="text-center pb-2 dashed-divider">
           ${printSettings.logoUrl ? `< div style = "text-align: center; margin-bottom: 6px;" > <img src="${printSettings.logoUrl}" style="max-height: 40px; max-width: 100%; object-fit: contain;" /></div> ` : ''}
           <h3 class="font-extrabold uppercase brand-accent-text" style="margin: 0; font-size: 1.15em;">🏥 ${printSettings.customHeaderText || 'MediSaaS Pharmacy Wing'}</h3>
           <p style="margin: 2px 0 0 0; font-size: 0.8em; color: #64748b;">Live Pharmacy Checkout Invoice</p>
           <p style="margin: 2px 0 0 0; font-size: 0.7em; color: #94a3b8;">Date: ${dispensedBill.date}</p>
         </div>`
      : '';

  const footerContent = printSettings.showFooter
    ? `<div class="text-center pt-3 dashed-divider">
           <div class="barcode-container brand-accent-bg">||||| ${dispensedBill.id} |||||</div>
           <p style="margin: 4px 0 0 0; font-size: 0.78em; color: #64748b; text-transform: uppercase;">
             ${printSettings.customFooterText || 'Thank you for visiting! Keep medicines out of reach.'}
           </p>
         </div>`
    : '';

  const itemsHtml = dispensedBill.items.map((item: any) => `
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
          <div>BILL ID: <strong>${dispensedBill.id}</strong></div>
          <div>RX CODE: <strong>${dispensedBill.rxCode}</strong></div>
          ${dispensedBill.patientNo ? `< div > PATIENT NO: <strong style = "font-family: monospace;">${ dispensedBill.patientNo }</strong></div > ` : ''}
          <div>PATIENT: <strong>${dispensedBill.patientName}</strong></div>
          <div>PHONE: <strong>${dispensedBill.patientPhone}</strong></div>
          <div>DOCTOR: <strong>Dr. ${dispensedBill.doctorName}</strong></div>
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
            <span class="brand-accent-text">₹${dispensedBill.total.toFixed(2)}</span>
          </div>
          <div class="flex justify-between" style="font-size: 0.85em; color: #475569; margin-top: 4px;">
            <span>PAYMENT MODE:</span>
            <span>${dispensedBill.paymentMode}</span>
          </div>
        </div>

        ${footerContent}
      </div>
    `;

  printIsolatedHtml("Pharmacy Bill Receipt", slipHtml);
  setIsPrintModalOpen(false);
};

return (
  <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200 font-sans">

    {/* Header */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-500 p-6 rounded-2xl border border-teal-500/20 text-white shadow-lg shadow-teal-500/5 relative overflow-hidden">
      <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="z-10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-100 animate-ping"></span>
          <span className="text-[10px] font-extrabold text-teal-100 uppercase tracking-widest">Pharmacy POS Terminal</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-glow-teal flex items-center gap-2 text-white mt-1">
          <ShoppingCart className="text-teal-100 animate-pulse" /> Point of Sale (POS)
        </h1>
        <p className="text-teal-50 text-xs mt-1">Process digital prescriptions instantly and maintain ACID database compliance</p>
      </div>
    </div>

    {/* Hero Search Bar */}
    <div className="glass-card rounded-2xl border border-teal-100/50 p-6 shadow-[0_8px_30px_rgba(13,148,136,0.02)] max-w-3xl mx-auto bg-white/40">
      <form onSubmit={handleSearch} className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-6 w-6 text-teal-500 animate-pulse" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          className="block w-full pl-12 pr-28 py-3.5 text-lg font-bold font-mono uppercase bg-white border border-teal-100/60 rounded-xl focus:ring-4 focus:ring-teal-500/15 focus:border-teal-500 focus:bg-white transition-all shadow-sm placeholder-slate-400 text-slate-800"
          placeholder="ENTER RX-CODE, PHONE OR UNIQUE PATIENT NO (e.g. PAT-82910)..."
          value={searchCode}
          onChange={(e) => {
            const val = e.target.value;
            setSearchCode(val);
            if (val.trim()) {
              const found = performLookup(val);
              if (found) {
                setSearchCode('');
              }
            }
          }}
        />
        <button
          type="submit"
          className="absolute inset-y-2 right-2 px-6 bg-teal-650 hover:bg-teal-700 text-white rounded-full font-bold text-sm shadow-md transition-colors"
        >
          Load RX
        </button>
      </form>

      {errorMsg && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
          <AlertOctagon size={16} className="text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>

    {/* Loaded Dispensing View */}
    {activePrescription ? (
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 min-h-[400px] pb-24 animate-in slide-in-from-bottom-6 duration-300">

        {/* Left Column: Patient Context & ACID Telemetry Logs */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Patient Context Card */}
          <div className="glass-card rounded-2xl border border-teal-100/50 shadow-sm overflow-hidden bg-white/40">
            <div className="p-4 bg-teal-50/10 border-b border-teal-50">
              <h3 className="font-extrabold text-slate-800 text-sm text-glow-teal">Patient Context</h3>
            </div>
            <div className="p-5 space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="text-[9px] uppercase text-slate-400 font-extrabold tracking-wider">RX Code Reference</label>
                <p className="text-teal-600 font-mono font-extrabold text-lg mt-0.5">{activePrescription.id}</p>
              </div>
              {activePrescription.patientNo && (
                <div>
                  <label className="text-[9px] uppercase text-slate-400 font-extrabold tracking-wider">Patient No (UID)</label>
                  <p className="text-teal-600 font-mono font-bold mt-0.5">{activePrescription.patientNo}</p>
                </div>
              )}
              <div>
                <label className="text-[9px] uppercase text-slate-400 font-extrabold tracking-wider">Patient Name</label>
                <p className="text-slate-800 text-base font-extrabold mt-0.5">{activePrescription.patientName}</p>
              </div>
              <div>
                <label className="text-[9px] uppercase text-slate-400 font-extrabold tracking-wider">Contact Phone</label>
                <p className="text-slate-600 font-mono mt-0.5">{activePrescription.patientPhone}</p>
              </div>
              <div>
                <label className="text-[9px] uppercase text-slate-400 font-extrabold tracking-wider">Prescribing Physician</label>
                <p className="text-slate-800 mt-0.5">Dr. {activePrescription.doctorName}</p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-[10px] font-bold text-slate-500">
                <span>Prescription Date</span>
                <span>{activePrescription.date}</span>
              </div>
            </div>
          </div>

          {/* MERN ACID Transaction Log Monitor */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 shadow-md p-4 flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3 shrink-0">
              <h3 className="text-xs font-extrabold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Terminal size={14} className="text-teal-400" /> ACID Mongoose Transaction
              </h3>
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1.5 max-h-60 lg:max-h-none">
              {transactionLogs.slice(0, 10).map((log, idx) => (
                <div key={idx} className={
                  log.includes('Failed') || log.includes('aborted')
                    ? 'text-rose-450'
                    : log.includes('commitTransaction') || log.includes('ACID State Saved')
                      ? 'text-emerald-450 font-bold'
                      : 'text-slate-300'
                }>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Smart Prescription Table */}
        <div className="lg:col-span-7 glass-card rounded-2xl border border-teal-100/50 shadow-sm flex flex-col overflow-hidden bg-white/40">
          <div className="p-4 bg-teal-50/10 border-b border-teal-50 flex justify-between items-center shrink-0">
            <h3 className="font-extrabold text-slate-800 text-sm text-glow-teal">Smart Prescription Details</h3>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-100/60">
              {activePrescription.items.length} Items Loaded
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/40 border-b border-teal-50 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="px-5 py-3">Medicine Name</th>
                  <th className="px-5 py-3">EMR Dosage</th>
                  <th className="px-5 py-3 text-center">Qty Required</th>
                  <th className="px-5 py-3 text-center">Stock Status</th>
                  <th className="px-5 py-3 text-right">Price/Unit</th>
                  <th className="px-5 py-3 text-right">Subtotal</th>
                  <th className="px-5 py-3 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50/20 text-xs font-semibold text-slate-700">
                {activePrescription.items.map((item: any) => {
                  const isOutOfStock = item.stockAvailable < item.qtyRequired;

                  return (
                    <tr key={item.medicineId} className={`transition-colors ${
                        isOutOfStock ? 'bg-rose-50/70 hover:bg-rose-50' : 'hover:bg-teal-50/10'
                      }`}>
                      <td className="px-5 py-3.5">
                        <div className="font-extrabold text-slate-850 flex items-center gap-1.5">
                          <Pill size={14} className="text-teal-500" />
                          {item.name}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">
                        {item.dosage}
                      </td>
                      <td className="px-5 py-3.5 text-center w-24">
                        <input
                          type="number"
                          value={item.qtyRequired}
                          onChange={(e) => handleQtyChange(item.medicineId, Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-white border border-teal-100/60 rounded-lg text-center font-bold font-mono text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none shadow-sm"
                        />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-extrabold border border-rose-200">
                            <AlertTriangle size={10} /> Stock Short ({item.stockAvailable} Left)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold border border-emerald-200">
                            🟢 Healthy ({item.stockAvailable})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-800 font-mono font-bold">
                        ₹{item.price.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-teal-600 font-mono font-extrabold">
                        ₹{(item.qtyRequired * item.price).toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.medicineId)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-full transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {activePrescription.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400 font-bold">
                      All prescription items removed. Please search another RX.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Fixed Checkout Bar */}
        <div className="fixed bottom-0 left-0 right-0 md:left-64 h-20 bg-white border-t border-teal-100/50 shadow-2xl flex items-center justify-between px-6 z-40 transition-all">
          <div className="flex items-center gap-8 font-sans">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Grand Total</span>
              <span className="text-2xl font-extrabold text-teal-600 font-mono">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold">Payment:</span>
              <select
                className="h-9 rounded-xl border border-teal-100/60 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                value={paymentMode}
                onChange={(e: any) => setPaymentMode(e.target.value)}
              >
                <option value="Cash">💵 Cash</option>
                <option value="Card">💳 Debit/Credit Card</option>
                <option value="UPI">📱 UPI / QR Code</option>
              </select>
            </div>
          </div>

          <Button
            onClick={handleCheckout}
            disabled={grandTotal === 0 || activePrescription.items.some((item: any) => item.stockAvailable < item.qtyRequired)}
            className="h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold flex items-center gap-2.5 shadow-lg shadow-emerald-600/10 hover:-translate-y-[1px] transition-all disabled:opacity-50 disabled:-translate-y-0 disabled:shadow-none"
          >
            <Printer size={18} /> Dispense & Print Receipt (Enter)
          </Button>
        </div>

      </div>
    ) : (
      <div className="h-80 flex flex-col justify-center items-center text-center p-8 glass-card border border-teal-100/50 border-dashed rounded-2xl shadow-sm bg-white/30">
        <div className="h-14 w-14 rounded-full bg-teal-50 border border-teal-100/60 flex items-center justify-center text-teal-600 text-xl font-extrabold mb-3 shadow-inner animate-heartbeat">
          💊
        </div>
        <h3 className="font-extrabold text-slate-800 text-base text-glow-teal">POS Ready to Scan</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-sm leading-relaxed">
          Enter doctor prescription codes to review medication stocks and dispense items instantly. (Try entering <span className="font-mono font-bold text-teal-600">RX-9042</span> or <span className="font-mono font-bold text-teal-600">9876543210</span>)
        </p>
      </div>
    )}

    {/* Print Thermal Receipt Slip Modal */}
    {isPrintModalOpen && dispensedBill && (
      <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="Thermal Bill Print Preview">
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
                <p className="text-[7px] text-slate-400">Date: {dispensedBill.date}</p>
              </div>
            )}

            <div className="space-y-1 mb-2 text-[8px] text-slate-600 border-b border-dashed border-slate-350 pb-1.5 mt-2">
              <div>BILL ID: <span className="text-slate-800 font-bold">{dispensedBill.id}</span></div>
              <div>RX CODE: <span className="text-slate-800 font-bold">{dispensedBill.rxCode}</span></div>
              {dispensedBill.patientNo && <div>PATIENT NO: <span className="text-slate-800 font-bold font-mono">{dispensedBill.patientNo}</span></div>}
              <div>PATIENT: <span className="text-slate-800 font-bold">{dispensedBill.patientName}</span></div>
              <div>PHONE: <span className="text-slate-800">{dispensedBill.patientPhone}</span></div>
              <div>DOCTOR: <span className="text-slate-800">{dispensedBill.doctorName}</span></div>
            </div>

            {/* Items Table */}
            <div className="space-y-1 mb-2 text-[8px]">
              <div className="flex justify-between border-b border-slate-300 pb-1 font-bold text-slate-700">
                <span className="w-1/2">Medicine</span>
                <span className="w-1/12 text-center">Qty</span>
                <span className="w-4/12 text-right">Subtotal</span>
              </div>
              {dispensedBill.items.map((item: any, idx: number) => (
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
                <span style={{ color: printSettings.accentColor }}>₹{dispensedBill.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[8px] text-slate-500 font-semibold uppercase">
                <span>PAYMENT MODE:</span>
                <span>{dispensedBill.paymentMode}</span>
              </div>
              <div className="flex justify-between text-[8px] text-slate-450 font-normal">
                <span>STATUS:</span>
                <span className="text-emerald-600 font-bold">DISPENSED ✓</span>
              </div>
            </div>

            {printSettings.showFooter && (
              <div className="text-center pt-3 border-t border-dashed border-slate-300 mt-2 space-y-1.5">
                <div className="h-5 w-full flex items-center justify-center text-[7px] text-white tracking-[6px] font-bold rounded" style={{ backgroundColor: printSettings.accentColor }}>
                  ||||| {dispensedBill.id} |||||
                </div>
                <p className="text-[7px] text-slate-400 leading-normal uppercase">
                  {printSettings.customFooterText || 'Thank you for visiting! Keep medicines out of reach of children.'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 w-full border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>Close Slip</Button>
            <Button className="flex gap-2" onClick={triggerPrintReceipt}>
              <Printer size={16} /> Execute Print
            </Button>
          </div>

        </div>
      </Modal>
    )}

  </div>
);
}
