import { CUSTOMER_SILVER_DEMO_ROWS, applyCustomerDemoResolutions } from './customerSilverDemo';

export const CUSTOMER_GOLD_DEMO_ROWS = [
  { id: 'gold-1', customer_number: 'DEMO-0001', gender: 'FEMALE', birthday: '1992-11-25', age: 34, city: 'CEBU CITY', province: 'CEBU', last_visit: '2026-04-20', record_origin: 'clean', resolution: 'No correction required' },
  { id: 'gold-2', customer_number: 'DEMO-0002', gender: 'MALE', birthday: '2001-05-04', age: 25, city: 'MANDAUE CITY', province: 'CEBU', last_visit: '2026-04-20', record_origin: 'resolved', resolution: 'Missing province supplied' },
  { id: 'gold-3', customer_number: 'DEMO-0003', gender: 'NOT GIVEN', birthday: '1996-06-27', age: 30, city: 'CEBU CITY', province: 'CEBU', last_visit: '2026-04-25', record_origin: 'resolved', resolution: 'City and province supplied' },
  { id: 'gold-4', customer_number: 'DEMO-0004', gender: 'FEMALE', birthday: '1990-01-01', age: 36, city: 'CEBU CITY', province: 'CEBU', last_visit: '2026-04-20', record_origin: 'resolved', resolution: 'Birthday and age corrected' },
  { id: 'gold-5', customer_number: 'DEMO-0005', gender: 'MALE', birthday: '1984-03-12', age: 42, city: 'CEBU CITY', province: 'CEBU', last_visit: '2026-03-18', record_origin: 'resolved', resolution: 'Invalid birthday replaced from verified source' },
  { id: 'gold-6', customer_number: 'DEMO-0006', gender: 'FEMALE', birthday: '2006-02-10', age: 20, city: 'LAPU-LAPU CITY', province: 'CEBU', last_visit: '2026-05-01', record_origin: 'resolved', resolution: 'Future birthday and age mismatch corrected' },
  { id: 'gold-7', customer_number: 'DEMO-DUPLICATE', gender: 'MALE', birthday: '1988-08-08', age: 38, city: 'CEBU CITY', province: 'CEBU', last_visit: '2026-04-12', record_origin: 'resolved', resolution: 'Duplicate consolidated; latest visit retained' },
];

export const CUSTOMER_GOLD_SCHEMA = [
  ['CUSTOMER NUMBER', 'Canonical unique customer identifier'],
  ['GENDER', 'Trusted customer gender value'],
  ['BIRTHDAY', 'Validated customer birth date'],
  ['AGE', 'Age reconciled with birthday'],
  ['CITY', 'Trusted registered city'],
  ['PROVINCE', 'Trusted registered province'],
  ['LAST VISIT', 'Most recent trusted visit date'],
  ['RECORD ORIGIN', 'Clean or manually resolved Silver record'],
];

export function getCustomerGoldDemoRows(): any[] {
  const baseline = CUSTOMER_GOLD_DEMO_ROWS.map(row => ({
    id: row.id, 'CUSTOMER NUMBER': row.customer_number, GENDER: row.gender,
    BIRTHDAY: row.birthday, AGE: row.age, CITY: row.city, PROVINCE: row.province,
    'LAST VISIT': row.last_visit, gold_origin: row.record_origin,
    resolution_note: row.resolution, validation_status: row.record_origin === 'resolved' ? 'resolved' : 'clean',
  }));
  const browserResolutions = applyCustomerDemoResolutions(CUSTOMER_SILVER_DEMO_ROWS)
    .filter(row => row.validation_status === 'resolved')
    .map(row => ({ ...row, gold_origin: 'resolved' }));
  const winners = new Map<string, any>();
  [...browserResolutions, ...baseline].forEach(row => {
    if (!winners.has(row['CUSTOMER NUMBER'])) winners.set(row['CUSTOMER NUMBER'], row);
  });
  return [...winners.values()];
}

export function getCustomerGoldDemoStats() {
  const resolvedCount = applyCustomerDemoResolutions(CUSTOMER_SILVER_DEMO_ROWS)
    .filter(row => row.validation_status === 'resolved').length;
  return {
    trusted: 736_557 + resolvedCount,
    clean: 736_557,
    resolved: resolvedCount,
    blocked: 302_444 - resolvedCount,
  };
}
