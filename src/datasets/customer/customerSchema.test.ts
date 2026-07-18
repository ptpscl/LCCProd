import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CUSTOMER_COLUMNS,
  validateCustomerHeader,
  validateCustomerRecord,
} from './customerSchema';

test('accepts the exact comma-separated customer header', () => {
  assert.equal(validateCustomerHeader(CUSTOMER_COLUMNS.join(',')).ok, true);
});

test('accepts tab-separated headers regardless of case and surrounding spaces', () => {
  const header = CUSTOMER_COLUMNS.map(column => ` ${column.toLowerCase()} `).join('\t');
  assert.equal(validateCustomerHeader(header).ok, true);
});

test('rejects underscore aliases, missing, extra, and duplicate headers', () => {
  const columns = [...CUSTOMER_COLUMNS];
  columns[0] = 'CUSTOMER_NUMBER';
  columns.push('CITY');
  columns.push('UNKNOWN');
  const result = validateCustomerHeader(columns.join(','));

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['CUSTOMER NUMBER']);
  assert.deepEqual(result.extra, ['CUSTOMER_NUMBER', 'UNKNOWN']);
  assert.deepEqual(result.duplicates, ['CITY']);
});

test('validates required identifiers, real YYYYMMDD dates, and whole numbers', () => {
  const valid = validateCustomerRecord({
    'CUSTOMER NUMBER': 'C-100',
    BIRTHDAY: '19960229',
    AGE: '30',
    'FREQUENCY OF VISIT': '12',
  });
  assert.equal(valid.ok, true);

  const invalid = validateCustomerRecord({
    'CUSTOMER NUMBER': '',
    BIRTHDAY: '20230229',
    AGE: '-1',
    'FREQUENCY OF VISIT': '2.5',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.length, 4);
});

test('detects duplicate customer numbers case-insensitively', () => {
  const seen = new Set<string>();
  assert.equal(validateCustomerRecord({ 'CUSTOMER NUMBER': 'abc' }, seen).ok, true);
  assert.equal(validateCustomerRecord({ 'CUSTOMER NUMBER': ' ABC ' }, seen).ok, false);
});
