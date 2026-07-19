export const EXPECTED_MMS_COLUMNS = [
  'DATE',
  'TRANSACTION NUMBER',
  'REGISTER NUMBER',
  'STORE CODE',
  'STORE CATEGORIZATION',
  'SKU CODE',
  'TRANSACTION TYPE',
  'MMS SALES',
  'QTY SOLD',
  'MARGIN',
] as const;

export interface MmsHeaderValidation {
  ok: boolean;
  missing: string[];
  extra: string[];
  duplicates: string[];
  orderMismatch: boolean;
}

function parseCsvHeader(headerLine: string): string[] {
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
    } else if (character === ',' && !quoted) {
      columns.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  columns.push(value);
  if (columns.length > 0) columns[0] = columns[0].replace(/^\uFEFF/, '');
  return columns;
}

export function validateMmsHeader(headerLine: string): MmsHeaderValidation {
  const columns = parseCsvHeader(headerLine.replace(/\r$/, ''));
  const expected = new Set<string>(EXPECTED_MMS_COLUMNS);
  const actual = new Set(columns);
  const seen = new Set<string>();
  const duplicates = columns.filter(column => {
    if (seen.has(column)) return true;
    seen.add(column);
    return false;
  });

  const missing = EXPECTED_MMS_COLUMNS.filter(column => !actual.has(column));
  const extra = columns.filter(column => !expected.has(column));
  const orderMismatch = columns.length !== EXPECTED_MMS_COLUMNS.length
    || columns.some((column, index) => column !== EXPECTED_MMS_COLUMNS[index]);

  return {
    ok: !orderMismatch,
    missing,
    extra,
    duplicates: [...new Set(duplicates)],
    orderMismatch,
  };
}
