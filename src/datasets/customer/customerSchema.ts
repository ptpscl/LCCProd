export const CUSTOMER_COLUMNS = [
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

export type CustomerColumn = typeof CUSTOMER_COLUMNS[number];
export type CustomerRecord = Partial<Record<CustomerColumn, unknown>>;

export const CUSTOMER_DATE_COLUMNS = [
  'BIRTHDAY',
  'EXPIRY DATE',
  'APPLICATION DATE',
  'MEMBER SINCE',
  'LAST VISIT',
] as const satisfies readonly CustomerColumn[];

export const CUSTOMER_WHOLE_NUMBER_COLUMNS = [
  'AGE',
  'FREQUENCY OF VISIT',
] as const satisfies readonly CustomerColumn[];

export const CUSTOMER_SCHEMA = [
  { name: 'CUSTOMER NUMBER', type: 'identifier', required: true, unique: true },
  { name: 'GENDER', type: 'categorical', required: false },
  { name: 'BIRTHDAY', type: 'date', format: 'YYYYMMDD', required: false },
  { name: 'AGE', type: 'whole_number', minimum: 0, required: false },
  { name: 'CITY', type: 'categorical', required: false },
  { name: 'PROVINCE', type: 'categorical', required: false },
  { name: 'EXPIRY DATE', type: 'date', format: 'YYYYMMDD', required: false },
  { name: 'MEMBER LOCATION', type: 'identifier', required: false },
  { name: 'APPLICATION DATE', type: 'date', format: 'YYYYMMDD', required: false },
  { name: 'MEMBER SINCE', type: 'date', format: 'YYYYMMDD', required: false },
  { name: 'LAST VISIT', type: 'date', format: 'YYYYMMDD', required: false },
  { name: 'FREQUENCY OF VISIT', type: 'whole_number', minimum: 0, required: false },
  { name: 'LAST VISITED STORE', type: 'identifier', required: false },
] as const;

export interface HeaderValidationResult {
  ok: boolean;
  columns: string[];
  missing: CustomerColumn[];
  extra: string[];
  duplicates: string[];
}

export interface RecordValidationResult {
  ok: boolean;
  errors: string[];
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toUpperCase();
}

function parseHeaderLine(headerLine: string): string[] {
  const delimiter = headerLine.includes('\t') ? '\t' : ',';
  const values: string[] = [];
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
    } else if (character === delimiter && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

export function validateCustomerHeader(headerLine: string): HeaderValidationResult {
  const columns = parseHeaderLine(headerLine).map(normalizeHeader);
  const expected = new Set<string>(CUSTOMER_COLUMNS);
  const actual = new Set(columns);
  const seen = new Set<string>();
  const duplicates = columns.filter(column => {
    if (!column || !seen.has(column)) {
      seen.add(column);
      return false;
    }
    return true;
  });
  const missing = CUSTOMER_COLUMNS.filter(column => !actual.has(column));
  const extra = columns.filter(column => column && !expected.has(column));

  return {
    ok: missing.length === 0 && extra.length === 0 && duplicates.length === 0,
    columns,
    missing,
    extra,
    duplicates: [...new Set(duplicates)],
  };
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function isValidYYYYMMDD(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function validateCustomerRecord(
  record: CustomerRecord,
  seenCustomerNumbers?: Set<string>,
): RecordValidationResult {
  const errors: string[] = [];
  const customerNumber = isBlank(record['CUSTOMER NUMBER'])
    ? ''
    : String(record['CUSTOMER NUMBER']).trim().toUpperCase();

  if (!customerNumber) {
    errors.push('CUSTOMER NUMBER is required.');
  } else if (seenCustomerNumbers?.has(customerNumber)) {
    errors.push(`CUSTOMER NUMBER must be unique; duplicate: ${customerNumber}.`);
  } else {
    seenCustomerNumbers?.add(customerNumber);
  }

  for (const column of CUSTOMER_DATE_COLUMNS) {
    const value = record[column];
    if (!isBlank(value) && !isValidYYYYMMDD(String(value).trim())) {
      errors.push(`${column} must be a valid date in YYYYMMDD format.`);
    }
  }

  for (const column of CUSTOMER_WHOLE_NUMBER_COLUMNS) {
    const value = record[column];
    if (!isBlank(value) && !/^\d+$/.test(String(value).trim())) {
      errors.push(`${column} must be a non-negative whole number.`);
    }
  }

  return { ok: errors.length === 0, errors };
}
