// lib/exportProfiles.ts
// Market-specific export profiles for CH Expense Tracker.
// Each profile defines headers, date formatting, and row mapping.
// Adding a new market = adding a new entry to EXPORT_PROFILES.

import { PROVINCE_TAX_RATES } from '@/lib/canada';

export interface ReceiptRow {
  id: string;
  supplier: string;
  receipt_date: string; // ISO: YYYY-MM-DD
  category: string;
  total_cost: number;
  notes: string | null;
  project_notes: string | null;
  image_path: string | null;
  imageUrl: string;
  province?: string;   // CA only — 2-letter province code e.g. 'ON'
}

export interface ExportProfile {
  id: string;
  label: string;
  country: string;
  software: string;
  currency: string;
  filenameSuffix: string;
  headers: string[];
  mapRow: (receipt: ReceiptRow) => string[];
}

// ─── Date formatting helpers ──────────────────────────────────────────────────

function toSwissDate(iso: string): string {
  // YYYY-MM-DD → DD.MM.YYYY
  const [year, month, day] = iso.split('T')[0].split('-');
  return `${day}.${month}.${year}`;
}

function toIrishUKDate(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  const [year, month, day] = iso.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function toNorthAmericanDate(iso: string): string {
  // YYYY-MM-DD → MM/DD/YYYY
  const [year, month, day] = iso.split('T')[0].split('-');
  return `${month}/${day}/${year}`;
}

// ─── Bexio (Switzerland) ──────────────────────────────────────────────────────
//
// Bexio has no CSV import for expenses — entry is manual only.
// This export is designed as a bookkeeper reconciliation format:
// column order mirrors the Bexio expense entry screen so the bookkeeper
// can work left-to-right with our CSV on one screen and Bexio on the other.
//
// Bexio expense entry screen fields (in order):
//   Date | Contact (supplier) | Title/Booking text | Currency | Gross | Net |
//   Accounting account | Project
//
// We add Receipt URL at the end so the bookkeeper can pull up the image
// without hunting through emails or WhatsApp.
//
// Swiss VAT rate is 8.1% standard (changed from 7.7% in Jan 2024).
// Net is back-calculated from gross using the category VAT rate.
// Accounting account codes use standard Swiss SME chart of accounts.
// Transport & Transportation mapped identically (duplicate DB categories).
// Meals & "Meals & Entertainment" mapped identically.

const BEXIO_VAT_RATE_MAP: Record<string, number> = {
  'Accommodation':          0.081,  // 8.1% standard
  'Communication':          0.081,
  'Donations':              0,      // Exempt
  'Education & Training':   0.081,
  'Entertainment':          0.081,
  'Fuel':                   0.081,
  'Home Office':            0.081,
  'Insurance':              0,      // Exempt
  'Meals':                  0.081,
  'Meals & Entertainment':  0.081,
  'Medical & Health':       0.026,  // 2.6% reduced rate (updated Jan 2024)
  'Office Supplies':        0.081,
  'Other':                  0,
  'Other Deductible':       0.081,
  'Parking':                0.081,
  'Personal':               0,
  'Professional Expenses':  0.081,
  'Professional Services':  0.081,
  'Transport':              0.081,
  'Transportation':         0.081,
};

const BEXIO_ACCOUNT_MAP: Record<string, string> = {
  'Accommodation':          '6300',  // Reisekosten
  'Communication':          '6530',  // Kommunikation
  'Donations':              '6950',  // Spenden
  'Education & Training':   '6600',  // Weiterbildung
  'Entertainment':          '6570',  // Repräsentation
  'Fuel':                   '6310',  // Fahrzeugkosten
  'Home Office':            '6500',  // Bürokosten
  'Insurance':              '6700',  // Versicherungen
  'Meals':                  '6570',  // Repräsentation
  'Meals & Entertainment':  '6570',  // Repräsentation
  'Medical & Health':       '6900',  // Übriger Aufwand
  'Office Supplies':        '6500',  // Büromaterial
  'Other':                  '6800',  // Übriger Aufwand
  'Other Deductible':       '6800',  // Übriger Aufwand
  'Parking':                '6310',  // Fahrzeugkosten
  'Personal':               '6900',  // Privatanteil
  'Professional Expenses':  '6800',  // Übriger Aufwand
  'Professional Services':  '6850',  // Beratungskosten
  'Transport':              '6300',  // Reisekosten
  'Transportation':         '6300',  // Reisekosten (duplicate)
};

const bexioProfile: ExportProfile = {
  id: 'bexio-ch',
  label: 'Bexio (Switzerland)',
  country: 'Switzerland',
  software: 'Bexio',
  currency: 'CHF',
  filenameSuffix: 'bexio-ch',
  headers: [
    'Date',                 // Paid on — DD.MM.YYYY
    'Supplier',             // Contact in Bexio
    'Title / Booking text', // Description
    'Currency',
    'Gross',                // Total amount paid
    'Net',                  // Gross minus VAT
    'Accounting Account',   // Swiss chart of accounts code
    'Client / Project',     // project_notes free text
    'Notes',
    'Receipt URL',          // 1-year signed URL for bookkeeper reference
  ],
  mapRow: (r) => {
    const vatRate = BEXIO_VAT_RATE_MAP[r.category] ?? 0;
    const gross = r.total_cost;
    const net = vatRate > 0 ? gross / (1 + vatRate) : gross;
    return [
      toSwissDate(r.receipt_date),
      r.supplier,
      `${r.supplier} — ${r.category}`,
      'CHF',
      gross.toFixed(2),
      net.toFixed(2),
      BEXIO_ACCOUNT_MAP[r.category] ?? '6800',
      r.project_notes ?? '',
      r.notes ?? '',
      r.imageUrl,
    ];
  },
};

// ─── Sage Accounting — Ireland ────────────────────────────────────────────────
//
// Currency: EUR. Date: DD/MM/YYYY.
// T1 = 23% standard, T5 = 13.5% reduced, T0 = exempt/zero-rated.
// Net and Tax are back-calculated from stored gross amount.

const SAGE_IE_TAX_MAP: Record<string, string> = {
  'Accommodation':          'T1',
  'Communication':          'T1',
  'Donations':              'T0',
  'Education & Training':   'T1',
  'Entertainment':          'T1',
  'Fuel':                   'T1',
  'Home Office':            'T1',
  'Insurance':              'T0',
  'Meals':                  'T1',
  'Meals & Entertainment':  'T1',
  'Medical & Health':       'T0',   // Medical zero-rated in IE
  'Office Supplies':        'T1',
  'Other':                  'T0',
  'Other Deductible':       'T1',
  'Parking':                'T1',
  'Personal':               'T0',
  'Professional Expenses':  'T1',
  'Professional Services':  'T1',
  'Transport':              'T0',   // Public transport zero-rated in IE
  'Transportation':         'T0',
};

const SAGE_IE_LEDGER_MAP: Record<string, string> = {
  'Accommodation':          'Travel',
  'Communication':          'Telephone and Internet',
  'Donations':              'Charitable Donations',
  'Education & Training':   'Training Costs',
  'Entertainment':          'Entertainment',
  'Fuel':                   'Motor Expenses',
  'Home Office':            'Office Costs',
  'Insurance':              'Insurance',
  'Meals':                  'Entertainment',
  'Meals & Entertainment':  'Entertainment',
  'Medical & Health':       'General Expenses',
  'Office Supplies':        'Office Costs',
  'Other':                  'General Expenses',
  'Other Deductible':       'General Expenses',
  'Parking':                'Motor Expenses',
  'Personal':               'General Expenses',
  'Professional Expenses':  'Professional Fees',
  'Professional Services':  'Professional Fees',
  'Transport':              'Travelling',
  'Transportation':         'Travelling',
};

const SAGE_IE_TAX_RATE_MAP: Record<string, number> = { T1: 0.23, T5: 0.135, T0: 0 };

const sageIrelandProfile: ExportProfile = {
  id: 'sage-ie',
  label: 'Sage (Ireland)',
  country: 'Ireland',
  software: 'Sage',
  currency: 'EUR',
  filenameSuffix: 'sage-ie',
  headers: ['Type', 'Date', 'Business Name', 'Reference', 'Ledger Account', 'Client / Project', 'Details', 'Net', 'Tax Rate', 'Tax', 'Total', 'Receipt URL'],
  mapRow: (r) => {
    const taxRate = SAGE_IE_TAX_MAP[r.category] ?? 'T0';
    const taxPct = SAGE_IE_TAX_RATE_MAP[taxRate] ?? 0;
    const gross = r.total_cost;
    const net = taxPct > 0 ? gross / (1 + taxPct) : gross;
    const tax = gross - net;
    return [
      'Purchase',
      toIrishUKDate(r.receipt_date),
      r.supplier,
      r.id.slice(0, 8).toUpperCase(),
      SAGE_IE_LEDGER_MAP[r.category] ?? 'General Expenses',
      r.project_notes ?? '',
      r.category + (r.notes ? ` — ${r.notes}` : ''),
      net.toFixed(2),
      taxRate,
      tax.toFixed(2),
      gross.toFixed(2),
      r.imageUrl,
    ];
  },
};

// ─── Sage Accounting — United Kingdom ────────────────────────────────────────
//
// Currency: GBP. Date: DD/MM/YYYY.
// T1 = 20% standard, T5 = 5% reduced, T0 = zero/exempt.

const SAGE_UK_TAX_MAP: Record<string, string> = {
  'Accommodation':          'T1',
  'Communication':          'T1',
  'Donations':              'T0',
  'Education & Training':   'T0',   // Training often exempt in UK
  'Entertainment':          'T1',
  'Fuel':                   'T1',
  'Home Office':            'T1',
  'Insurance':              'T0',   // Exempt (IPT applies separately)
  'Meals':                  'T1',
  'Meals & Entertainment':  'T1',
  'Medical & Health':       'T0',   // Medical zero-rated in UK
  'Office Supplies':        'T1',
  'Other':                  'T0',
  'Other Deductible':       'T1',
  'Parking':                'T1',
  'Personal':               'T0',
  'Professional Expenses':  'T1',
  'Professional Services':  'T1',
  'Transport':              'T0',   // Rail/bus zero-rated in UK
  'Transportation':         'T0',
};

const SAGE_UK_LEDGER_MAP: Record<string, string> = {
  'Accommodation':          'Travelling',
  'Communication':          'Telephone and Internet',
  'Donations':              'Charitable Donations',
  'Education & Training':   'Training Costs',
  'Entertainment':          'Entertainment',
  'Fuel':                   'Motor Expenses',
  'Home Office':            'Office Costs',
  'Insurance':              'Insurance',
  'Meals':                  'Entertainment',
  'Meals & Entertainment':  'Entertainment',
  'Medical & Health':       'General Expenses',
  'Office Supplies':        'Office Costs',
  'Other':                  'General Expenses',
  'Other Deductible':       'General Expenses',
  'Parking':                'Motor Expenses',
  'Personal':               'General Expenses',
  'Professional Expenses':  'Professional Fees',
  'Professional Services':  'Professional Fees',
  'Transport':              'Travelling',
  'Transportation':         'Travelling',
};

const SAGE_UK_TAX_RATE_MAP: Record<string, number> = { T1: 0.20, T5: 0.05, T0: 0 };

const sageUKProfile: ExportProfile = {
  id: 'sage-uk',
  label: 'Sage (United Kingdom)',
  country: 'United Kingdom',
  software: 'Sage',
  currency: 'GBP',
  filenameSuffix: 'sage-uk',
  headers: ['Type', 'Date', 'Business Name', 'Reference', 'Ledger Account', 'Client / Project', 'Details', 'Net', 'Tax Rate', 'Tax', 'Total', 'Receipt URL'],
  mapRow: (r) => {
    const taxRate = SAGE_UK_TAX_MAP[r.category] ?? 'T0';
    const taxPct = SAGE_UK_TAX_RATE_MAP[taxRate] ?? 0;
    const gross = r.total_cost;
    const net = taxPct > 0 ? gross / (1 + taxPct) : gross;
    const tax = gross - net;
    return [
      'Purchase',
      toIrishUKDate(r.receipt_date),
      r.supplier,
      r.id.slice(0, 8).toUpperCase(),
      SAGE_UK_LEDGER_MAP[r.category] ?? 'General Expenses',
      r.project_notes ?? '',
      r.category + (r.notes ? ` — ${r.notes}` : ''),
      net.toFixed(2),
      taxRate,
      tax.toFixed(2),
      gross.toFixed(2),
      r.imageUrl,
    ];
  },
};

// ─── Canada shared data ───────────────────────────────────────────────────────
//
// Whether a category attracts GST/HST in Canada.
// false = exempt (insurance, most medical, donations, etc.)

const CA_TAXABLE: Record<string, boolean> = {
  'Accommodation':          true,
  'Communication':          true,
  'Donations':              false,
  'Education & Training':   false,  // Training courses often exempt
  'Entertainment':          true,
  'Fuel':                   true,
  'Home Office':            true,
  'Insurance':              false,  // Insurance premiums exempt from GST/HST
  'Meals':                  true,
  'Meals & Entertainment':  true,
  'Medical & Health':       false,  // Most medical services exempt
  'Office Supplies':        true,
  'Other':                  true,
  'Other Deductible':       true,
  'Parking':                true,
  'Personal':               false,
  'Professional Expenses':  true,
  'Professional Services':  true,
  'Transport':              true,
  'Transportation':         true,
};

// Generic account name mapping used by QuickBooks CA and Xero CA
const CA_ACCOUNT_NAME_MAP: Record<string, string> = {
  'Accommodation':          'Travel & Accommodation',
  'Communication':          'Telephone & Internet',
  'Donations':              'Charitable Donations',
  'Education & Training':   'Training & Development',
  'Entertainment':          'Entertainment',
  'Fuel':                   'Motor Vehicle Expenses',
  'Home Office':            'Office Expenses',
  'Insurance':              'Insurance',
  'Meals':                  'Meals & Entertainment',
  'Meals & Entertainment':  'Meals & Entertainment',
  'Medical & Health':       'Medical Expenses',
  'Office Supplies':        'Office Supplies',
  'Other':                  'General Expenses',
  'Other Deductible':       'General Expenses',
  'Parking':                'Motor Vehicle Expenses',
  'Personal':               'Personal Expenses',
  'Professional Expenses':  'Professional Fees',
  'Professional Services':  'Professional Fees',
  'Transport':              'Travel & Transportation',
  'Transportation':         'Travel & Transportation',
};

// Sage 50 CA (Simply Accounting) default chart of accounts codes
const SAGE50_CA_ACCOUNT_MAP: Record<string, string> = {
  'Accommodation':          '5100',  // Travel
  'Communication':          '5200',  // Telephone & Internet
  'Donations':              '5260',  // Charitable Donations
  'Education & Training':   '5180',  // Training
  'Entertainment':          '5080',  // Entertainment/Meals
  'Fuel':                   '5060',  // Auto & Truck
  'Home Office':            '5040',  // Office Expenses
  'Insurance':              '5140',  // Insurance
  'Meals':                  '5080',  // Entertainment/Meals
  'Meals & Entertainment':  '5080',
  'Medical & Health':       '5280',  // Medical
  'Office Supplies':        '5040',  // Office Expenses
  'Other':                  '5300',  // Miscellaneous
  'Other Deductible':       '5300',
  'Parking':                '5060',  // Auto & Truck
  'Personal':               '5400',  // Personal
  'Professional Expenses':  '5160',  // Professional Fees
  'Professional Services':  '5160',
  'Transport':              '5100',  // Travel
  'Transportation':         '5100',
};

// province → QuickBooks tax code
function qboTaxCode(province: string, taxable: boolean): string {
  if (!taxable) return 'Exempt';
  const hst = ['NB', 'NL', 'NS', 'ON', 'PE'];
  const gstPst = ['BC', 'MB', 'SK'];
  if (hst.includes(province)) return 'HST';
  if (gstPst.includes(province)) return 'GST+PST';
  return 'GST';
}

// province → Xero tax type
function xeroTaxType(province: string, taxable: boolean): string {
  if (!taxable) return 'Exempt Expenses';
  const hst = ['NB', 'NL', 'NS', 'ON', 'PE'];
  const gstPst = ['BC', 'MB', 'SK'];
  if (hst.includes(province)) return 'HST on Expenses';
  if (gstPst.includes(province)) return 'GST/PST on Expenses';
  return 'GST on Expenses';
}

// province → Sage 50 CA tax code
function sage50TaxCode(province: string, taxable: boolean): string {
  if (!taxable) return 'E';
  const hst = ['NB', 'NL', 'NS', 'ON', 'PE'];
  const gstPst = ['BC', 'MB', 'SK'];
  if (hst.includes(province)) return 'H';
  if (gstPst.includes(province)) return 'GP';
  return 'G';
}

function caTaxAmounts(r: ReceiptRow): { net: number; tax: number; taxRate: number } {
  const province = r.province ?? 'ON';
  const taxable = CA_TAXABLE[r.category] ?? true;
  const taxRate = taxable ? (PROVINCE_TAX_RATES[province] ?? 0.13) : 0;
  const gross = r.total_cost;
  const net = taxRate > 0 ? gross / (1 + taxRate) : gross;
  const tax = gross - net;
  return { net, tax, taxRate };
}

// ─── QuickBooks Online — Canada ───────────────────────────────────────────────
//
// Currency: CAD. Date: MM/DD/YYYY (North American).
// This format is designed for manual entry reference and QBO Expense import.
// Tax codes: GST | HST | GST+PST | Exempt — based on user's province.

const quickbooksCAProfile: ExportProfile = {
  id: 'quickbooks-ca',
  label: 'QuickBooks Online (Canada)',
  country: 'Canada',
  software: 'QuickBooks',
  currency: 'CAD',
  filenameSuffix: 'quickbooks-ca',
  headers: [
    'Date',
    'Supplier',
    'Description',
    'Account',
    'Province',
    'Net (CAD)',
    'Tax Code',
    'Tax (CAD)',
    'Total (CAD)',
    'Client / Project',
    'Notes',
    'Receipt URL',
  ],
  mapRow: (r) => {
    const province = r.province ?? 'ON';
    const taxable = CA_TAXABLE[r.category] ?? true;
    const { net, tax } = caTaxAmounts(r);
    return [
      toNorthAmericanDate(r.receipt_date),
      r.supplier,
      `${r.supplier} — ${r.category}`,
      CA_ACCOUNT_NAME_MAP[r.category] ?? 'General Expenses',
      province,
      net.toFixed(2),
      qboTaxCode(province, taxable),
      tax.toFixed(2),
      r.total_cost.toFixed(2),
      r.project_notes ?? '',
      r.notes ?? '',
      r.imageUrl,
    ];
  },
};

// ─── Xero — Canada ────────────────────────────────────────────────────────────
//
// Currency: CAD. Date: DD/MM/YYYY (Xero international standard).
// Tax types: GST on Expenses | HST on Expenses | GST/PST on Expenses | Exempt Expenses.

const xeroCAProfile: ExportProfile = {
  id: 'xero-ca',
  label: 'Xero (Canada)',
  country: 'Canada',
  software: 'Xero',
  currency: 'CAD',
  filenameSuffix: 'xero-ca',
  headers: [
    'Date',
    'Contact',
    'Description',
    'Account',
    'Province',
    'Net (CAD)',
    'Tax Type',
    'Tax (CAD)',
    'Total (CAD)',
    'Client / Project',
    'Notes',
    'Receipt URL',
  ],
  mapRow: (r) => {
    const province = r.province ?? 'ON';
    const taxable = CA_TAXABLE[r.category] ?? true;
    const { net, tax } = caTaxAmounts(r);
    return [
      toIrishUKDate(r.receipt_date),
      r.supplier,
      r.category + (r.notes ? ` — ${r.notes}` : ''),
      CA_ACCOUNT_NAME_MAP[r.category] ?? 'General Expenses',
      province,
      net.toFixed(2),
      xeroTaxType(province, taxable),
      tax.toFixed(2),
      r.total_cost.toFixed(2),
      r.project_notes ?? '',
      r.notes ?? '',
      r.imageUrl,
    ];
  },
};

// ─── Sage 50 — Canada ─────────────────────────────────────────────────────────
//
// Currency: CAD. Date: MM/DD/YYYY (North American).
// Tax codes: H (HST) | G (GST) | GP (GST+PST) | E (Exempt).
// Account numbers match Sage 50 CA default chart of accounts.

const sage50CAProfile: ExportProfile = {
  id: 'sage50-ca',
  label: 'Sage 50 (Canada)',
  country: 'Canada',
  software: 'Sage 50',
  currency: 'CAD',
  filenameSuffix: 'sage50-ca',
  headers: [
    'Date',
    'Vendor',
    'Reference',
    'Description',
    'Account',
    'Province',
    'Net (CAD)',
    'Tax Code',
    'Tax (CAD)',
    'Total (CAD)',
    'Client / Project',
    'Notes',
    'Receipt URL',
  ],
  mapRow: (r) => {
    const province = r.province ?? 'ON';
    const taxable = CA_TAXABLE[r.category] ?? true;
    const { net, tax } = caTaxAmounts(r);
    return [
      toNorthAmericanDate(r.receipt_date),
      r.supplier,
      r.id.slice(0, 8).toUpperCase(),
      r.category + (r.notes ? ` — ${r.notes}` : ''),
      SAGE50_CA_ACCOUNT_MAP[r.category] ?? '5300',
      province,
      net.toFixed(2),
      sage50TaxCode(province, taxable),
      tax.toFixed(2),
      r.total_cost.toFixed(2),
      r.project_notes ?? '',
      r.notes ?? '',
      r.imageUrl,
    ];
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add future profiles here. Order determines dropdown order in UI.

export const EXPORT_PROFILES: ExportProfile[] = [
  bexioProfile,
  sageIrelandProfile,
  sageUKProfile,
  quickbooksCAProfile,
  xeroCAProfile,
  sage50CAProfile,
];

export const DEFAULT_PROFILE_ID = 'bexio-ch';

// Profiles that require a paid tier (Solo or Team)
export const PAID_PROFILE_IDS = new Set(['quickbooks-ca', 'xero-ca', 'sage50-ca']);
