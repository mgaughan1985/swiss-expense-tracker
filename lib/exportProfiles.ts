// lib/exportProfiles.ts
// Market-specific export profiles for CH Expense Tracker.
// Each profile defines headers, date formatting, and row mapping.
// Adding a new market = adding a new entry to EXPORT_PROFILES.

export interface ReceiptRow {
  id: string;
  supplier: string;
  receipt_date: string; // ISO: YYYY-MM-DD
  category: string;
  total_cost: number;
  notes: string | null;
  image_path: string | null;
  imageUrl: string;
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
    'Date',               // Paid on — DD.MM.YYYY
    'Supplier',           // Contact in Bexio
    'Title / Booking text', // Description
    'Currency',
    'Gross',              // Total amount paid
    'Net',                // Gross minus VAT
    'Accounting Account', // Swiss chart of accounts code
    'Notes',
    'Receipt URL',        // 1-year signed URL for bookkeeper reference
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
  headers: ['Type', 'Date', 'Business Name', 'Reference', 'Ledger Account', 'Details', 'Net', 'Tax Rate', 'Tax', 'Total', 'Receipt URL'],
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
  headers: ['Type', 'Date', 'Business Name', 'Reference', 'Ledger Account', 'Details', 'Net', 'Tax Rate', 'Tax', 'Total', 'Receipt URL'],
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
      r.category + (r.notes ? ` — ${r.notes}` : ''),
      net.toFixed(2),
      taxRate,
      tax.toFixed(2),
      gross.toFixed(2),
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
];

export const DEFAULT_PROFILE_ID = 'bexio-ch';