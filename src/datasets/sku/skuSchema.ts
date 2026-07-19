export const EXPECTED_SKU_COLUMNS = [
  "SKU CODE",
  "SKU DESCRIPTION",
  "DIVISION",
  "DEPARTMENT",
  "CATEGORY",
  "CLASS",
  "BRAND",
  "STANDARD PACK",
  "PACK TYPE",
  "BUY UNIT OF MEASURE",
  "SELL UNIT OF MEASURE",
  "UNIT COST",
  "WEIGTH",
  "HEIGHT",
  "LENGTH",
  "WIDTH",
  "CUBE",
  "VENDOR CODE",
  "VENDOR DESCRIPTION"
];

export function validateSkuHeader(headerLine: string): { ok: boolean; missing: string[]; extra: string[] } {
  // Split on tab, but fallback to comma if no tabs are present
  const separator = headerLine.includes('\t') ? '\t' : ',';
  const columns = headerLine.split(separator).map(col => col.trim().toUpperCase());

  const expectedSet = new Set(EXPECTED_SKU_COLUMNS);
  const actualSet = new Set(columns);

  const missing = EXPECTED_SKU_COLUMNS.filter(col => !actualSet.has(col));
  const extra = columns.filter(col => !expectedSet.has(col) && col !== ''); // Ignore empty trailing columns

  return {
    ok: missing.length === 0 && extra.length === 0,
    missing,
    extra
  };
}
