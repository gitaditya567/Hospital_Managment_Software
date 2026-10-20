/**
 * ============================================================
 * THERMAL SLIP TEMPLATES - Standard 80mm / 3-inch Format
 * ============================================================
 * Centralized utility for ALL thermal print slips in the system.
 * Every slip (OPD Queue, OPD Billing, Pharmacy, etc.) uses these
 * builders so every receipt looks identical and professional.
 *
 * STANDARD FORMAT (matches image reference):
 *
 *      HOSPITAL NAME
 *   143 South Car Street,
 *   Madurai, Tamil Nadu.
 *   PHONE : 0452-XXXXXXX
 *   GSTIN : XXXXXXXXXXXXXXX
 * - - - - - - - - - - - - -
 * Bill No : SR5   Date:17/01
 * - - - - - - - - - - - - -
 * Item      Qty   Price   Amt
 * - - - - - - - - - - - - -
 * Medicine A  2   100   200
 * SubTotal           200.00
 * CGST @ 9%          18.00
 * SGST @ 9%          18.00
 * ━━━━━━━━━━━━━━━━━━━━━━━━
 * TOTAL         Rs. 236.00
 * ━━━━━━━━━━━━━━━━━━━━━━━━
 *              E & O.E
 *            Thank You
 * ============================================================
 */

import { getPrintSettings, getHospitalDisplayName } from './printSettings';
import { doctorTitle } from '../lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** A single line item on any slip */
export interface SlipLineItem {
  name: string;
  qty: number;
  price: number;
  amount?: number; // if provided, overrides qty * price
}

/** A tax / charge row shown below subtotal */
export interface SlipTaxRow {
  label: string;   // e.g. "CGST @ 9.00%"
  amount: number;
}

/** A patient / bill info row in the details section */
export interface SlipMetaRow {
  label: string;
  value: string;
  bold?: boolean;
}

/** Full options for buildThermalSlipHtml() */
export interface ThermalSlipOptions {
  /** Slip type label, e.g. "OPD Registration Slip" */
  slipTypeLabel: string;
  /** Bill / Invoice number */
  billNo?: string;
  /** Date string */
  date?: string;
  /** Address lines (shown below hospital name) */
  addressLines?: string[];
  /** Phone number */
  phone?: string;
  /** GSTIN */
  gstin?: string;
  /** Patient / bill info rows */
  metaRows?: SlipMetaRow[];
  /** Line items (medicines, services, fees) */
  lineItems?: SlipLineItem[];
  /** Show Item | Qty | Price | Amt table header row (default: true) */
  showItemTableHeader?: boolean;
  /** Tax rows below subtotal */
  taxRows?: SlipTaxRow[];
  /** Override subtotal (auto-computed if not given) */
  subtotalOverride?: number;
  /** Grand total */
  total: number;
  /** Currency prefix, default "Rs." */
  currencySymbol?: string;
  /** Large token number for OPD queue slips */
  tokenNumber?: string;
  /** Label above token number */
  tokenLabel?: string;
  /** Status badge text for billing slips */
  statusBadge?: string;
  /** Status badge color */
  statusColor?: 'green' | 'red';
  /** Payment mode row */
  paymentMode?: string;
  /** Override footer text */
  footerText?: string;
  /** Hide barcode decoration in footer */
  noBarcode?: boolean;
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function fmtAmt(n: number, sym: string): string {
  return `${sym} ${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dashedDiv(): string {
  return `<div style="border-top:1px dashed #aaa;margin:7px 0;"></div>`;
}

function solidDiv(color: string): string {
  return `<div style="border-top:1.5px solid ${color};margin:7px 0;"></div>`;
}

// ─────────────────────────────────────────────
// MAIN BUILDER
// ─────────────────────────────────────────────

/**
 * Builds a complete 80mm thermal slip HTML fragment.
 * Pass the result to printIsolatedHtml().
 */
export function buildThermalSlipHtml(opts: ThermalSlipOptions): string {
  const settings = getPrintSettings();
  const hospName = getHospitalDisplayName();
  const sym      = opts.currencySymbol ?? 'Rs.';
  const accent   = settings.accentColor || '#1e293b';
  const fontSize = settings.fontSize    || 12;

  // ── LOGO ──
  const effectiveLogo = settings.logoUrl || localStorage.getItem('medisaas_hospital_logo') || '';
  const logoHtml = effectiveLogo
    ? `<div style="text-align:center;margin-bottom:6px;"><img src="${effectiveLogo}" style="max-height:48px;max-width:85%;object-fit:contain;margin:0 auto;display:block;" /></div>`
    : '';

  // ── HOSPITAL HEADER ──
  const addrHtml = (opts.addressLines ?? []).map((l) => `<div>${l}</div>`).join('');

  const headerHtml = settings.showHeader
    ? `<div style="text-align:center;padding-bottom:6px;">
         ${logoHtml}
         <div style="font-size:1.2em;font-weight:900;text-transform:uppercase;letter-spacing:0.04em;color:${accent};">${hospName}</div>
         ${addrHtml ? `<div style="font-size:0.82em;color:#444;line-height:1.5;margin-top:2px;">${addrHtml}</div>` : ''}
         ${opts.phone ? `<div style="font-size:0.8em;color:#555;margin-top:1px;">PHONE : ${opts.phone}</div>` : ''}
         ${opts.gstin ? `<div style="font-size:0.78em;color:#555;">GSTIN : ${opts.gstin}</div>` : ''}
       </div>`
    : '';

  // ── BILL NO + DATE ──
  const billDateHtml = (opts.billNo || opts.date)
    ? `${dashedDiv()}
       <div style="display:flex;justify-content:space-between;font-size:0.85em;margin:3px 0;">
         ${opts.billNo ? `<span>Bill No : <strong>${opts.billNo}</strong></span>` : '<span></span>'}
         ${opts.date   ? `<span>Date : <strong>${opts.date}</strong></span>` : '<span></span>'}
       </div>`
    : '';

  // ── SLIP TYPE LABEL ──
  const slipLabelHtml = opts.slipTypeLabel
    ? `${dashedDiv()}
       <div style="text-align:center;font-size:0.78em;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin:3px 0;">${opts.slipTypeLabel}</div>`
    : '';

  // ── TOKEN (OPD Queue) ──
  const tokenHtml = opts.tokenNumber
    ? `<div style="text-align:center;padding:8px 0;margin:6px 0;border:1px solid ${accent}22;border-radius:6px;background:#f8fafc;">
         <div style="font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#888;">${opts.tokenLabel || 'Queue Token'}</div>
         <div style="font-size:2.4em;font-weight:900;color:${accent};line-height:1.1;margin:3px 0;">${opts.tokenNumber}</div>
       </div>`
    : '';

  // ── STATUS BADGE (Billing) ──
  const statusClr = opts.statusColor === 'red' ? '#e11d48' : '#10b981';
  const statusHtml = opts.statusBadge
    ? `<div style="text-align:center;padding:6px 0;margin:6px 0;border:1px solid ${statusClr}33;border-radius:6px;background:#f8fafc;">
         <div style="font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#888;">Transaction Status</div>
         <div style="font-size:1.35em;font-weight:900;color:${statusClr};line-height:1.1;margin:3px 0;">${opts.statusBadge}</div>
       </div>`
    : '';

  // ── META ROWS ──
  const metaHtml = (opts.metaRows ?? []).length > 0
    ? `${dashedDiv()}
       <div style="font-size:0.9em;">
         ${(opts.metaRows ?? []).map((m) =>
           `<div style="display:flex;justify-content:space-between;margin:3px 0;">
              <span style="color:#666;">${m.label}:</span>
              <span style="font-weight:${m.bold ? '800' : '600'};text-align:right;max-width:58%;">${m.value}</span>
            </div>`
         ).join('')}
       </div>`
    : '';

  // ── ITEMS TABLE ──
  let itemsHtml = '';
  if (opts.lineItems && opts.lineItems.length > 0) {
    const thRow = opts.showItemTableHeader !== false
      ? `<tr>
           <th style="text-align:left;padding:5px 3px;border-bottom:1px solid #333;font-size:0.9em;">Item</th>
           <th style="text-align:center;padding:5px 3px;border-bottom:1px solid #333;font-size:0.9em;width:30px;">Qty</th>
           <th style="text-align:right;padding:5px 3px;border-bottom:1px solid #333;font-size:0.9em;width:58px;">Price</th>
           <th style="text-align:right;padding:5px 3px;border-bottom:1px solid #333;font-size:0.9em;width:65px;">Amt</th>
         </tr>`
      : '';
    const bodyRows = opts.lineItems.map((item) => {
      const amt = item.amount !== undefined ? item.amount : item.qty * item.price;
      return `<tr style="border-bottom:1px dashed #ddd;">
                <td style="padding:5px 3px;font-weight:600;">${item.name}</td>
                <td style="padding:5px 3px;text-align:center;">${item.qty}</td>
                <td style="padding:5px 3px;text-align:right;">${item.price.toFixed(2)}</td>
                <td style="padding:5px 3px;text-align:right;font-weight:700;">${amt.toFixed(2)}</td>
              </tr>`;
    }).join('');
    itemsHtml = `${dashedDiv()}
      <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
        <thead>${thRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>`;
  }

  // ── SUBTOTAL ──
  const subtotal = opts.subtotalOverride
    ?? (opts.lineItems ?? []).reduce((s, i) => s + (i.amount !== undefined ? i.amount : i.qty * i.price), 0);
  const subtotalHtml = opts.lineItems && opts.lineItems.length > 0
    ? `${dashedDiv()}
       <div style="display:flex;justify-content:space-between;font-size:0.9em;margin:2px 0;">
         <span>SubTotal</span>
         <span style="font-weight:700;">${subtotal.toFixed(2)}</span>
       </div>`
    : '';

  // ── TAX ROWS ──
  const taxHtml = (opts.taxRows ?? []).length > 0
    ? (opts.taxRows ?? []).map((t) =>
        `<div style="display:flex;justify-content:space-between;font-size:0.82em;margin:1px 0;color:#555;">
           <span>${t.label}</span><span>${t.amount.toFixed(2)}</span>
         </div>`
      ).join('')
    : '';

  // ── GRAND TOTAL ──
  const totalHtml = `
    ${solidDiv(accent)}
    <div style="display:flex;justify-content:space-between;font-size:1.1em;font-weight:900;margin:4px 0;color:${accent};">
      <span>TOTAL</span><span>${fmtAmt(opts.total, sym)}</span>
    </div>
    ${solidDiv(accent)}`;

  // ── PAYMENT MODE ──
  const payHtml = opts.paymentMode
    ? `<div style="display:flex;justify-content:space-between;font-size:0.82em;color:#555;margin:3px 0;">
         <span>Payment Mode:</span><span style="font-weight:700;">${opts.paymentMode}</span>
       </div>`
    : '';

  // ── FOOTER ──
  const footerText = opts.footerText ?? settings.customFooterText ?? 'Thank you for visiting!';
  const footerHtml = settings.showFooter
    ? `${dashedDiv()}
       <div style="text-align:center;padding-top:4px;">
         <div style="font-size:0.82em;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">E &amp; O.E</div>
         <div style="font-size:0.82em;color:#444;font-weight:600;">${footerText}</div>
         <div style="font-size:0.95em;font-weight:900;margin-top:4px;letter-spacing:0.03em;">Thank You</div>
       </div>`
    : '';

  // ── FINAL ASSEMBLY ──
  return `
    <div style="font-family:'Courier New',Courier,monospace;font-size:${fontSize}px;line-height:1.45;color:#111;max-width:72mm;margin:0 auto;">
      ${headerHtml}
      ${billDateHtml}
      ${slipLabelHtml}
      ${tokenHtml}
      ${statusHtml}
      ${metaHtml}
      ${itemsHtml}
      ${subtotalHtml}
      ${taxHtml}
      ${totalHtml}
      ${payHtml}
      ${footerHtml}
    </div>`;
}

// ─────────────────────────────────────────────
// CONVENIENCE BUILDERS (per slip type)
// ─────────────────────────────────────────────

/** OPD Queue / Registration Slip */
export function buildOpdQueueSlipHtml(data: {
  tokenNumber: string;
  patientName: string;
  patientId: string;
  patientNo?: string;
  age: string | number;
  gender: string;
  phone: string;
  doctorName: string;
  feeType: string;
  amount: number;
  date: string;
  billNo?: string;
  footerText?: string;
}): string {
  const isMongoId = Boolean(data.patientId && data.patientId.length === 24 && /^[0-9a-fA-F]{24}$/.test(data.patientId));
  const displayPatientNo = data.patientNo || (!isMongoId ? data.patientId : '');
  const cleanBillNo = data.billNo && !/^[0-9a-fA-F]{24}$/.test(data.billNo) ? data.billNo : displayPatientNo;

  const metaRows: SlipMetaRow[] = [
    { label: 'Patient',    value: data.patientName, bold: true },
    ...(displayPatientNo ? [{ label: 'Patient No', value: displayPatientNo, bold: true }] : []),
    { label: 'Age/Gender', value: `${data.age} Yrs / ${data.gender}` },
    { label: 'Contact',    value: data.phone },
    { label: 'Doctor',     value: `${doctorTitle(data.doctorName)}` },
  ];
  return buildThermalSlipHtml({
    slipTypeLabel: 'OPD Registration Slip',
    billNo:        cleanBillNo,
    date:          data.date,
    tokenNumber:   data.tokenNumber,
    tokenLabel:    'OPD Queue Token',
    metaRows,
    lineItems:           [{ name: data.feeType, qty: 1, price: data.amount }],
    showItemTableHeader: false,
    taxRows:             [],
    total:               data.amount,
    footerText:          data.footerText,
  });
}

/** OPD Billing Invoice Receipt */
export function buildOpdBillingSlipHtml(data: {
  patientName: string;
  patientPhone: string;
  invoiceId: string;
  doctorName: string;
  feeType: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Pending';
  footerText?: string;
}): string {
  const isPaid = data.status === 'Paid';
  const metaRows: SlipMetaRow[] = [
    { label: 'Patient',    value: data.patientName, bold: true },
    { label: 'Invoice Ref',value: data.invoiceId },
    { label: 'Contact',    value: data.patientPhone },
    { label: 'Doctor',     value: `${doctorTitle(data.doctorName)}` },
  ];
  return buildThermalSlipHtml({
    slipTypeLabel:       'OPD Billing Receipt',
    billNo:              data.invoiceId,
    date:                data.date,
    statusBadge:         isPaid ? 'PAID & CLEARED' : 'PENDING DUE',
    statusColor:         isPaid ? 'green' : 'red',
    metaRows,
    lineItems:           [{ name: data.feeType, qty: 1, price: data.amount }],
    showItemTableHeader: false,
    taxRows:             [],
    total:               data.amount,
    footerText:          data.footerText
      ?? (isPaid ? 'Thank you for your cooperation.' : 'Please settle the outstanding payment.'),
  });
}

/** Pharmacy Bill Receipt */
export function buildPharmacyBillSlipHtml(data: {
  billId: string;
  rxCode: string;
  patientName: string;
  patientPhone: string;
  patientNo?: string;
  doctorName: string;
  date: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  paymentMode: string;
  footerText?: string;
  gstin?: string;
}): string {
  const metaRows: SlipMetaRow[] = [
    { label: 'Bill ID',  value: data.billId,  bold: true },
    { label: 'Rx Code',  value: data.rxCode },
    ...(data.patientNo ? [{ label: 'Patient No', value: data.patientNo }] : []),
    { label: 'Patient',  value: data.patientName, bold: true },
    { label: 'Phone',    value: data.patientPhone },
    { label: 'Doctor',   value: `${doctorTitle(data.doctorName)}` },
  ];
  return buildThermalSlipHtml({
    slipTypeLabel:       'Pharmacy Bill Receipt',
    billNo:              data.billId,
    date:                data.date,
    gstin:               data.gstin,
    metaRows,
    lineItems:           data.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
    showItemTableHeader: true,
    taxRows:             [],
    total:               data.total,
    paymentMode:         data.paymentMode,
    footerText:          data.footerText ?? 'Keep medicines out of reach of children.',
  });
}
