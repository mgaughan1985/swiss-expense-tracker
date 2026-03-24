// lib/canada.ts
// Canadian province/territory data and tax rates.
// Quebec is intentionally excluded (requires French + QST — future sprint).

export interface Province {
  code: string;
  name: string;
}

export const CANADIAN_PROVINCES: Province[] = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

// Combined federal + provincial tax rates (GST/HST/PST).
// AB, NT, NU, YT: GST only (5%)
// BC: GST 5% + PST 7% = 12%
// MB: GST 5% + RST 7% = 12%
// SK: GST 5% + PST 6% = 11%
// ON: HST 13%
// NS: HST 14%
// NB, NL, PE: HST 15%
export const PROVINCE_TAX_RATES: Record<string, number> = {
  AB: 0.05,
  BC: 0.12,
  MB: 0.12,
  NB: 0.15,
  NL: 0.15,
  NS: 0.14,
  NT: 0.05,
  NU: 0.05,
  ON: 0.13,
  PE: 0.15,
  SK: 0.11,
  YT: 0.05,
};

// Returns the province name for a given code, or the code itself if not found.
export function getProvinceName(code: string): string {
  return CANADIAN_PROVINCES.find(p => p.code === code)?.name ?? code;
}
