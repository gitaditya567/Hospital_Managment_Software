import type { RxItem } from '../../../store/useHospitalStore';
import { doctorTitle } from '../../../lib/utils';
import { getPrintSettings } from '../../../utils/printSettings';

// ───────── Medicine catalogue ─────────

export interface CatalogMedicine {
  name: string;
  category: string;
  keywords: string[];
  dosage: string;
  timing: string;
  duration: string;
  stock?: number;   // present when the medicine is in this hospital's pharmacy
  price?: number;
}

// Common OPD medicines used when the pharmacy has not stocked an item yet
const LIBRARY: Array<Omit<CatalogMedicine, 'keywords'> & { brands?: string[] }> = [
  { name: 'Paracetamol 650mg', category: 'Fever / Pain', dosage: '1-1-1', timing: 'After food', duration: '3 days', brands: ['dolo 650', 'dolo', 'calpol 650'] },
  { name: 'Paracetamol 500mg', category: 'Fever / Pain', dosage: '1-0-1', timing: 'After food', duration: '3 days', brands: ['crocin', 'calpol', 'fever tablet'] },
  { name: 'Ibuprofen 400mg', category: 'Pain / NSAID', dosage: '1-0-1', timing: 'After food', duration: '3 days', brands: ['brufen', 'painkiller'] },
  { name: 'Diclofenac 50mg', category: 'Pain / NSAID', dosage: '1-0-1', timing: 'After food', duration: '3 days', brands: ['voveran'] },
  { name: 'Amoxicillin 500mg', category: 'Antibiotic', dosage: '1-1-1', timing: 'After food', duration: '5 days', brands: ['mox 500', 'amox'] },
  { name: 'Amoxicillin + Clavulanate 625mg', category: 'Antibiotic', dosage: '1-0-1', timing: 'After food', duration: '5 days', brands: ['augmentin', 'clavam'] },
  { name: 'Azithromycin 500mg', category: 'Antibiotic', dosage: '1-0-0', timing: 'Before food', duration: '3 days', brands: ['azithral', 'azee'] },
  { name: 'Cefixime 200mg', category: 'Antibiotic', dosage: '1-0-1', timing: 'After food', duration: '5 days', brands: ['taxim o', 'zifi'] },
  { name: 'Pantoprazole 40mg', category: 'Antacid', dosage: '1-0-0', timing: 'Empty stomach', duration: '10 days', brands: ['pan 40', 'pan d', 'pan-d', 'pantocid', 'gas medicine'] },
  { name: 'Omeprazole 20mg', category: 'Antacid', dosage: '1-0-0', timing: 'Empty stomach', duration: '10 days', brands: ['omez'] },
  { name: 'Ondansetron 4mg', category: 'Anti-vomiting', dosage: '1-0-1', timing: 'Before food', duration: '3 days', brands: ['emeset', 'ondem', 'vomiting tablet'] },
  { name: 'Domperidone 10mg', category: 'Anti-vomiting', dosage: '1-0-1', timing: 'Before food', duration: '3 days', brands: ['domstal'] },
  { name: 'Cetirizine 10mg', category: 'Allergy', dosage: '0-0-1', timing: 'At bedtime', duration: '5 days', brands: ['okacet', 'cetzine', 'allergy tablet'] },
  { name: 'Levocetirizine 5mg', category: 'Allergy', dosage: '0-0-1', timing: 'At bedtime', duration: '5 days', brands: ['levocet', 'xyzal'] },
  { name: 'Montelukast 10mg', category: 'Allergy / Asthma', dosage: '0-0-1', timing: 'At bedtime', duration: '15 days', brands: ['montair', 'montek'] },
  { name: 'Ambroxol Syrup 100ml', category: 'Cough', dosage: '10ml 1-1-1', timing: 'After food', duration: '5 days', brands: ['cough syrup', 'mucolite'] },
  { name: 'Salbutamol Inhaler', category: 'Asthma', dosage: '2 puffs SOS', timing: 'As needed', duration: '30 days', brands: ['asthalin'] },
  { name: 'ORS Sachet', category: 'Rehydration', dosage: '1 sachet 1-1-1', timing: 'After loose stool', duration: '3 days', brands: ['ors', 'electral'] },
  { name: 'Loperamide 2mg', category: 'Diarrhoea', dosage: '1-0-1', timing: 'After food', duration: '2 days', brands: ['imodium', 'loose motion'] },
  { name: 'Metformin 500mg', category: 'Diabetes', dosage: '1-0-1', timing: 'After food', duration: '30 days', brands: ['glycomet', 'sugar tablet'] },
  { name: 'Glimepiride 1mg', category: 'Diabetes', dosage: '1-0-0', timing: 'Before food', duration: '30 days', brands: ['amaryl'] },
  { name: 'Amlodipine 5mg', category: 'Blood pressure', dosage: '1-0-0', timing: 'After food', duration: '30 days', brands: ['amlong', 'bp tablet'] },
  { name: 'Telmisartan 40mg', category: 'Blood pressure', dosage: '1-0-0', timing: 'After food', duration: '30 days', brands: ['telma'] },
  { name: 'Atorvastatin 10mg', category: 'Cholesterol', dosage: '0-0-1', timing: 'At bedtime', duration: '30 days', brands: ['atorva', 'lipitor'] },
  { name: 'Vitamin D3 60000 IU', category: 'Supplement', dosage: '1 weekly', timing: 'After food', duration: '8 weeks', brands: ['vitamin d', 'd rise', 'calcirol'] },
  { name: 'Calcium + Vitamin D3', category: 'Supplement', dosage: '0-1-0', timing: 'After food', duration: '30 days', brands: ['calcium', 'shelcal'] },
  { name: 'Multivitamin', category: 'Supplement', dosage: '0-1-0', timing: 'After food', duration: '30 days', brands: ['becosules', 'zincovit'] }
];

const baseName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

const keywordsFor = (name: string, extra: string[] = []) => {
  const full = baseName(name);
  const noUnit = full.replace(/(\d+)\s*(mg|ml|mcg|iu|g)\b/g, '$1').trim();
  const first = full.split(/[\s(]/)[0];
  return [...new Set([full, noUnit, first, ...extra.map(baseName)])].filter(k => k.length >= 3);
};

// Pharmacy stock first (with live stock and price), then library items not already stocked
export function buildCatalog(inventory: Array<{ name: string; category?: string; stock: number; price: number }>): CatalogMedicine[] {
  const stocked = new Set(inventory.map(m => baseName(m.name)));
  const fromStock: CatalogMedicine[] = inventory.map(m => {
    const lib = LIBRARY.find(l => baseName(l.name) === baseName(m.name));
    return {
      name: m.name,
      category: m.category || lib?.category || 'Pharmacy stock',
      keywords: keywordsFor(m.name, lib?.brands),
      dosage: lib?.dosage || '1-0-1',
      timing: lib?.timing || 'After food',
      duration: lib?.duration || '5 days',
      stock: m.stock,
      price: m.price
    };
  });
  const fromLibrary: CatalogMedicine[] = LIBRARY
    .filter(l => !stocked.has(baseName(l.name)))
    .map(({ brands, ...l }) => ({ ...l, keywords: keywordsFor(l.name, brands) }));
  return [...fromStock, ...fromLibrary];
}

export function searchCatalog(catalog: CatalogMedicine[], query: string, limit = 8) {
  const q = baseName(query);
  if (!q) return [];
  return catalog
    .map(m => {
      const name = baseName(m.name);
      const score = name.startsWith(q) ? 3 : m.keywords.some(k => k.startsWith(q)) ? 2 : (name.includes(q) || m.category.toLowerCase().includes(q)) ? 1 : 0;
      return { m, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.m.stock !== undefined ? 1 : 0) - (a.m.stock !== undefined ? 1 : 0))
    .slice(0, limit)
    .map(x => x.m);
}

// ───────── Dosage helpers ─────────

export const DOSAGES = ['1-0-1', '1-1-1', '1-0-0', '0-0-1', '0-1-0', '1-1-1-1', 'SOS'];
export const TIMINGS = ['After food', 'Before food', 'Empty stomach', 'At bedtime', 'As needed'];
export const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '15 days', '30 days'];

const durationDays = (duration: string) => {
  const m = /(\d+)\s*(day|days|din|week|weeks|hafte|month|months|mahine)/i.exec(duration);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  if (/week|hafte/i.test(m[2])) return n * 7;
  if (/month|mahine/i.test(m[2])) return n * 30;
  return n;
};

// Units to dispense: doses per day × days (e.g. 1-0-1 for 5 days = 10). Weekly doses count once per week.
export function computeQty(dosage: string, duration: string) {
  const days = durationDays(duration);
  if (!days) return 1;
  if (/weekly/i.test(dosage)) return Math.max(1, Math.round(days / 7));
  if (/sos|as needed/i.test(dosage)) return Math.min(days, 10);
  if (/syrup|ml|inhaler|puff/i.test(dosage)) return 1;
  const pattern = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/.exec(dosage);
  const perDay = pattern ? pattern.slice(1).filter(Boolean).reduce((s, n) => s + parseFloat(n), 0) : 1;
  return Math.max(1, Math.ceil(perDay * days));
}

export function newRxItem(m: Pick<CatalogMedicine, 'name' | 'dosage' | 'timing' | 'duration'>): RxItem {
  return { name: m.name, dosage: m.dosage, timing: m.timing, duration: m.duration, qty: computeQty(m.dosage, m.duration) };
}

// ───────── Voice dictation ─────────

const spokenNumbers: Record<string, string> = { ek: '1', one: '1', do: '2', two: '2', teen: '3', tin: '3', three: '3', char: '4', four: '4', paanch: '5', panch: '5', five: '5', saat: '7', seven: '7', das: '10', ten: '10', pandrah: '15', fifteen: '15' };

const segmentDosage = (seg: string) => {
  if (/(four times|char baar|4 times)/.test(seg)) return '1-1-1-1';
  if (/(thrice|three times|teen baar|tin baar|3 times|1-1-1)/.test(seg)) return '1-1-1';
  if (/(twice|two times|do baar|2 times|subah shaam|morning and night|1-0-1)/.test(seg)) return '1-0-1';
  if (/(at night|raat|bedtime|sone se pehle|0-0-1)/.test(seg)) return '0-0-1';
  if (/(once|ek baar|1 time|subah|morning|1-0-0)/.test(seg)) return '1-0-0';
  if (/(sos|if needed|zarurat|jab dard)/.test(seg)) return 'SOS';
  return '';
};

const segmentTiming = (seg: string) => {
  if (/(empty stomach|khali pet)/.test(seg)) return 'Empty stomach';
  if (/(before food|before meal|khane se pehle)/.test(seg)) return 'Before food';
  if (/(after food|after meal|khane ke baad)/.test(seg)) return 'After food';
  if (/(bedtime|sone se pehle)/.test(seg)) return 'At bedtime';
  return '';
};

const segmentDuration = (seg: string) => {
  const normalised = seg.replace(/\b(ek|one|do|two|teen|tin|three|char|four|paanch|panch|five|saat|seven|das|ten|pandrah|fifteen)\b/g, w => spokenNumbers[w] || w);
  const m = /(\d+)\s*(day|days|din|week|weeks|hafte|month|months|mahine)/.exec(normalised);
  if (!m) return '';
  const unit = /week|hafte/.test(m[2]) ? 'weeks' : /month|mahine/.test(m[2]) ? 'months' : 'days';
  return `${m[1]} ${unit}`;
};

// Turns dictated text into prescription lines. Each medicine reads its own dose/timing/duration from its phrase,
// and the longest matching name wins ("paracetamol 650" beats "paracetamol").
export function parseDictation(text: string, catalog: CatalogMedicine[]): RxItem[] {
  const lower = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;

  // Every mention of every keyword, as whole words
  const hits: Array<{ start: number; end: number; med: CatalogMedicine }> = [];
  for (const med of catalog) {
    for (const k of med.keywords) {
      const re = new RegExp(`(?<![a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(lower))) hits.push({ start: m.index, end: m.index + k.length, med });
    }
  }

  // Keep the longest non-overlapping mentions; prefer stocked medicines on ties
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || (b.med.stock !== undefined ? 1 : 0) - (a.med.stock !== undefined ? 1 : 0));
  const chosen: typeof hits = [];
  for (const h of hits) {
    if (!chosen.some(c => h.start < c.end && c.start < h.end)) chosen.push(h);
  }
  chosen.sort((a, b) => a.start - b.start);

  // Each medicine's instructions are the words up to the next medicine
  const found: RxItem[] = [];
  chosen.forEach((h, i) => {
    if (found.some(f => f.name === h.med.name)) return;
    const phrase = lower.slice(h.start, i + 1 < chosen.length ? chosen[i + 1].start : lower.length);
    const dosage = segmentDosage(phrase) || h.med.dosage;
    const duration = segmentDuration(phrase) || h.med.duration;
    found.push({ name: h.med.name, dosage, timing: segmentTiming(phrase) || h.med.timing, duration, qty: computeQty(dosage, duration) });
  });
  return found;
}

// ───────── Consultation quick picks ─────────

export const COMMON_DIAGNOSES = ['Viral fever', 'Upper respiratory infection', 'Acute gastritis', 'Hypertension', 'Type 2 diabetes', 'Allergic rhinitis', 'Gastroenteritis', 'Migraine', 'Urinary tract infection', 'Lower back pain'];
export const COMMON_ADVICE = ['Drink plenty of fluids', 'Take rest for 2–3 days', 'Avoid oily and spicy food', 'Steam inhalation twice daily', 'Low salt diet', 'Regular walk 30 minutes', 'Return immediately if symptoms worsen'];
export const FOLLOW_UPS: Array<{ label: string; days: number }> = [
  { label: '3 days', days: 3 }, { label: '1 week', days: 7 }, { label: '2 weeks', days: 14 }, { label: '1 month', days: 30 }
];

export const addDaysYMD = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const prettyDate = (ymd?: string) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ───────── Printable prescription ─────────

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export interface PrescriptionPrint {
  hospitalName: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  logoUrl?: string;
  doctor: { name: string; department?: string; licenseNo?: string; qualifications?: string };
  patient: { name: string; patientNo?: string; age: number | string; gender?: string; phone?: string; tokenNumber?: string };
  vitals?: Array<{ name: string; value: string }>;
  complaints?: string;
  diagnosis?: string;
  advice?: string;
  followUpDate?: string;
  items: RxItem[];
  rxCode?: string;
  date?: string;
}

export function buildPrescriptionHtml(rx: PrescriptionPrint) {
  const accent = getPrintSettings().accentColor || '#3683F8';
  const rows = rx.items.map((m, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${esc(m.name)}</strong></td>
      <td class="c mono">${esc(m.dosage)}</td>
      <td class="c">${esc(m.timing || '')}</td>
      <td class="c">${esc(m.duration)}</td>
      <td class="c mono">${esc(m.qty)}</td>
    </tr>`).join('');
  const vitals = (rx.vitals || []).map(v => `<span class="pill">${esc(v.name)}: <b>${esc(v.value)}</b></span>`).join('');
  const block = (title: string, body?: string) => body ? `<div class="block"><div class="label">${title}</div><div>${esc(body).replace(/\n/g, '<br>')}</div></div>` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Prescription ${esc(rx.rxCode || '')}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 13px; margin: 0; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${accent}; padding-bottom: 12px; }
    .head h1 { margin: 0; font-size: 22px; }
    .head .sub { color: #64748b; font-size: 12px; margin-top: 2px; }
    .doc { text-align: right; }
    .doc .name { font-size: 16px; font-weight: 800; }
    .doc .meta { color: #475569; font-size: 12px; }
    .patient { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin: 14px 0; }
    .patient b { color: #0f172a; }
    .pill { display: inline-block; border: 1px solid #e2e8f0; border-radius: 999px; padding: 2px 8px; margin: 0 6px 6px 0; font-size: 11.5px; }
    .block { margin: 10px 0; }
    .label { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
    .rx { font-family: Georgia, serif; font-style: italic; font-size: 30px; font-weight: 700; color: ${accent}; margin: 12px 0 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #475569; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .c { text-align: center; } .mono { font-family: Consolas, monospace; font-weight: 700; }
    .follow { margin-top: 12px; padding: 8px 12px; border-left: 4px solid ${accent}; background: #f8fafc; font-weight: 700; }
    .sign { margin-top: 56px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #64748b; }
    .sign .box { text-align: center; min-width: 220px; border-top: 1.5px solid #1e293b; padding-top: 6px; color: #1e293b; font-weight: 700; }
    .foot { margin-top: 24px; border-top: 1px dashed #cbd5e1; padding-top: 8px; font-size: 10.5px; color: #94a3b8; text-align: center; }
  </style></head><body>
    <div class="head">
      <div>
        ${rx.logoUrl ? `<img src="${esc(rx.logoUrl)}" style="max-height:48px;margin-bottom:6px" alt="">` : ''}
        <h1>${esc(rx.hospitalName)}</h1>
        <div class="sub">${esc(rx.hospitalAddress || '')}${rx.hospitalPhone ? ` · Ph: ${esc(rx.hospitalPhone)}` : ''}</div>
      </div>
      <div class="doc">
        <div class="name">${esc(doctorTitle(rx.doctor.name))}</div>
        ${rx.doctor.qualifications ? `<div class="meta">${esc(rx.doctor.qualifications).replace(/\n/g, ' · ')}</div>` : ''}
        ${rx.doctor.department ? `<div class="meta">${esc(rx.doctor.department)}</div>` : ''}
        ${rx.doctor.licenseNo ? `<div class="meta">Reg. No: ${esc(rx.doctor.licenseNo)}</div>` : ''}
      </div>
    </div>
    <div class="patient">
      <div>Patient: <b>${esc(rx.patient.name)}</b></div>
      <div>Age / Sex: <b>${esc(rx.patient.age)} / ${esc(rx.patient.gender || '-')}</b></div>
      <div>Date: <b>${esc(rx.date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}</b></div>
      <div>Patient No: <b>${esc(rx.patient.patientNo || '-')}</b></div>
      <div>Phone: <b>${esc(rx.patient.phone || '-')}</b></div>
      <div>Rx No: <b>${esc(rx.rxCode || 'Draft')}</b></div>
    </div>
    ${vitals ? `<div class="block"><div class="label">Vitals</div>${vitals}</div>` : ''}
    ${block('Complaints', rx.complaints)}
    ${block('Diagnosis', rx.diagnosis)}
    ${rx.items.length ? `<div class="rx">Rx</div>
    <table><thead><tr><th>#</th><th>Medicine</th><th class="c">Dose</th><th class="c">When</th><th class="c">Duration</th><th class="c">Qty</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
    ${block('Advice', rx.advice)}
    ${rx.followUpDate ? `<div class="follow">Follow-up on ${esc(prettyDate(rx.followUpDate))}</div>` : ''}
    <div class="sign">
      <div>Dose format: Morning-Afternoon-Night</div>
      <div class="box">${esc(doctorTitle(rx.doctor.name))}${rx.doctor.licenseNo ? `<br><span style="font-weight:500">Reg. No ${esc(rx.doctor.licenseNo)}</span>` : ''}</div>
    </div>
    <div class="foot">${esc(getPrintSettings().customFooterText || 'This prescription is valid only with the doctor\'s signature.')}</div>
  </body></html>`;
}

// Prints a full HTML document in a hidden frame (no popup blocker issues)
export function printDocument(html: string) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  (window as any).__lastPrintedHtml = html;
  setTimeout(() => {
    try { win.focus(); win.print(); } finally { setTimeout(() => frame.remove(), 1000); }
  }, 250);
}
