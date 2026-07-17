export const EXPECTED_LOYALTY_COLUMNS = [
  "DATE",
  "TRANSACTION NUMBER",
  "REGISTER NUMBER",
  "STORE CODE",
  "STORE CATEGORIZATION",
  "CUSTOMER NUMBER",
  "SKU CODE",
  "TRANSACTION TYPE",
  "LOYALTY SALES",
  "QTY SOLD"
];

export function validateLoyaltyHeader(headerLine: string): { ok: boolean; missing: string[]; extra: string[] } {
  // Split on tab, but fallback to comma if no tabs are present
  const separator = headerLine.includes('\t') ? '\t' : ',';
  const columns = headerLine.split(separator).map(col => col.trim().toUpperCase());
  
  const expectedSet = new Set(EXPECTED_LOYALTY_COLUMNS);
  const actualSet = new Set(columns);

  const missing = EXPECTED_LOYALTY_COLUMNS.filter(col => !actualSet.has(col));
  const extra = columns.filter(col => !expectedSet.has(col) && col !== ''); // Ignore empty trailing columns

  return {
    ok: missing.length === 0 && extra.length === 0,
    missing,
    extra
  };
}
