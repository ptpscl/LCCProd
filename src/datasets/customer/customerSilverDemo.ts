import { CustomerSilverStats } from './customerService';

// Prototype-only values reproduced from the completed Customer anomaly
// notebook. They are clearly labelled in the UI and never written to Supabase.
export const CUSTOMER_SILVER_DEMO_STATS: CustomerSilverStats = {
  total_rows: 1_039_001,
  clean_rows: 736_557,
  flagged_rows: 302_444,
  class_0_rows: 736_557,
  class_1a_rows: 223_901,
  class_1b_rows: 78_543,
  latest_run: null,
};

export const CUSTOMER_SILVER_DEMO_ROWS = [
  {
    id: 'demo-1', 'CUSTOMER NUMBER': 'DEMO-0001', GENDER: 'FEMALE',
    BIRTHDAY: '1992-11-25', AGE: 34, CITY: 'CEBU CITY', PROVINCE: 'CEBU',
    'LAST VISIT': '2026-04-20', anomaly_class: '0', validation_status: 'clean',
    quality_issues: [],
  },
  {
    id: 'demo-2', 'CUSTOMER NUMBER': 'DEMO-0002', GENDER: 'MALE',
    BIRTHDAY: '2001-05-04', AGE: 25, CITY: 'MANDAUE CITY', PROVINCE: null,
    'LAST VISIT': '2026-04-20', anomaly_class: '1A', validation_status: 'flagged',
    quality_issues: ['without_province'],
  },
  {
    id: 'demo-3', 'CUSTOMER NUMBER': 'DEMO-0003', GENDER: 'NOT GIVEN',
    BIRTHDAY: '1996-06-27', AGE: 30, CITY: null, PROVINCE: null,
    'LAST VISIT': null, anomaly_class: '1A', validation_status: 'flagged',
    quality_issues: ['without_province'],
  },
  {
    id: 'demo-4', 'CUSTOMER NUMBER': 'DEMO-0004', GENDER: 'FEMALE',
    BIRTHDAY: '1900-01-01', AGE: 126, CITY: null, PROVINCE: null,
    'LAST VISIT': '2026-04-20', anomaly_class: '1B', validation_status: 'flagged',
    quality_issues: ['without_province', 'birthday_age_over_120'],
  },
  {
    id: 'demo-5', 'CUSTOMER NUMBER': 'DEMO-0005', GENDER: 'MALE',
    BIRTHDAY: null, AGE: 42, CITY: 'CEBU CITY', PROVINCE: 'CEBU',
    'LAST VISIT': '2026-03-18', anomaly_class: '1B', validation_status: 'flagged',
    quality_issues: ['birthday_invalid'],
  },
  {
    id: 'demo-6', 'CUSTOMER NUMBER': 'DEMO-0006', GENDER: 'FEMALE',
    BIRTHDAY: '2030-02-10', AGE: 20, CITY: 'LAPU-LAPU CITY', PROVINCE: 'CEBU',
    'LAST VISIT': '2026-05-01', anomaly_class: '1B', validation_status: 'flagged',
    quality_issues: ['birthday_in_future', 'birthday_age_mismatch'],
  },
  {
    id: 'demo-7', 'CUSTOMER NUMBER': 'DEMO-DUPLICATE', GENDER: 'MALE',
    BIRTHDAY: '1988-08-08', AGE: 38, CITY: 'CEBU CITY', PROVINCE: 'CEBU',
    'LAST VISIT': '2026-02-15', anomaly_class: '1B', validation_status: 'flagged',
    quality_issues: ['duplicate_customer_number'],
  },
  {
    id: 'demo-8', 'CUSTOMER NUMBER': 'DEMO-DUPLICATE', GENDER: 'MALE',
    BIRTHDAY: '1988-08-08', AGE: 38, CITY: 'CEBU CITY', PROVINCE: 'CEBU',
    'LAST VISIT': '2026-04-12', anomaly_class: '1B', validation_status: 'flagged',
    quality_issues: ['duplicate_customer_number'],
  },
];
