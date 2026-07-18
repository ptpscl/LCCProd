export const EXPECTED_CUSTOMER_COLUMNS = [
  'CUSTOMER_NUMBER',
  'GENDER',
  'BIRTHDAY',
  'AGE',
  'CITY',
  'PROVINCE',
  'EXPIRY_DATE',
  'MEMBER_LOCATION',
  'APPLICATION_DATE',
  'MEMBER_SINCE',
  'LAST_VISIT',
  'FREQUENCY_OF_VISIT',
  'LAST_VISITED_STORE',
] as const;

export function validateCustomerHeader(headerLine: string) {
  const separator = headerLine.includes('\t') ? '\t' : ',';
  const columns = headerLine
    .replace(/^\uFEFF/, '')
    .split(separator)
    .map(column => column.trim().toUpperCase());
  const expected = new Set<string>(EXPECTED_CUSTOMER_COLUMNS);
  const actual = new Set(columns);
  const missing = EXPECTED_CUSTOMER_COLUMNS.filter(column => !actual.has(column));
  const extra = columns.filter(column => column && !expected.has(column));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}
