export const EXPECTED_CUSTOMER_COLUMNS = [
  'CUSTOMER NUMBER',
  'GENDER',
  'BIRTHDAY',
  'AGE',
  'CITY',
  'PROVINCE',
  'EXPIRY DATE',
  'MEMBER LOCATION',
  'APPLICATION DATE',
  'MEMBER SINCE',
  'LAST VISIT',
  'FREQUENCY OF VISIT',
  'LAST VISITED STORE',
] as const;

function parseHeader(headerLine: string): string[] {
  const separator = headerLine.includes('\t') ? '\t' : ',';
  const columns: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < headerLine.length; index += 1) {
    const character = headerLine[index];
    if (character === '"') {
      if (quoted && headerLine[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === separator && !quoted) {
      columns.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  columns.push(value);
  return columns;
}

export function validateCustomerHeader(headerLine: string) {
  const columns = parseHeader(headerLine).map(column => (
    column.replace(/^\uFEFF/, '').trim().toUpperCase()
  ));
  const expected = new Set<string>(EXPECTED_CUSTOMER_COLUMNS);
  const actual = new Set(columns);
  const seen = new Set<string>();
  const duplicates = columns.filter(column => {
    if (!seen.has(column)) {
      seen.add(column);
      return false;
    }
    return Boolean(column);
  });
  const missing = EXPECTED_CUSTOMER_COLUMNS.filter(column => !actual.has(column));
  const extra = columns.filter(column => column && !expected.has(column));

  return {
    ok: missing.length === 0 && extra.length === 0 && duplicates.length === 0,
    missing,
    extra,
    duplicates: [...new Set(duplicates)],
  };
}
