export type MmsGoldRecordOrigin = 'Clean from Silver' | 'Accepted resolution';
export type MmsGoldRecordStatus = 'CLEAN' | 'ACCEPTED_RESOLUTION';

export interface MmsGoldRow {
  id: string;
  date: string;
  transactionNumber: string;
  registerNumber: string;
  storeCode: string;
  skuCode: string;
  transactionType: string;
  mmsSales: number;
  quantitySold: number;
  margin: number;
  storeCategorization: string;
  datasetOnlyAnomaly: string;
  recordOrigin: MmsGoldRecordOrigin;
  silverResolution: string;
  resolvedBy: string;
  resolvedAt: string;
  goldRecordStatus: MmsGoldRecordStatus;
  goldBatchId: string;
  goldLoadedAt: string;
}

export const MMS_GOLD_COUNTS = {
  originalBronzeRows: 133_166,
  trusted: 133_130,
  cleanFromSilver: 133_129,
  acceptedFromSilver: 1,
  stillBlocked: 36,
} as const;

export const MMS_DATA_RELIABILITY = (MMS_GOLD_COUNTS.trusted / MMS_GOLD_COUNTS.originalBronzeRows) * 100;

export const MMS_GOLD_DEMO_ROWS: MmsGoldRow[] = [
  {
    id: 'gold-mms-001', date: '240102', transactionNumber: '8712', registerNumber: '13', storeCode: '417', skuCode: '3778875',
    transactionType: 'REGULAR SALE', mmsSales: 61.18665019, quantitySold: 0.618046972, margin: 13.92150803,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
  {
    id: 'gold-mms-002', date: '240102', transactionNumber: '8606', registerNumber: '13', storeCode: '417', skuCode: '3029690',
    transactionType: 'REGULAR SALE', mmsSales: 19.22126082, quantitySold: 0.618046972, margin: 1.900865266,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
  {
    id: 'gold-mms-003', date: '240102', transactionNumber: '8631', registerNumber: '13', storeCode: '417', skuCode: '3689002',
    transactionType: 'REGULAR SALE', mmsSales: 28.12113721, quantitySold: 1.236093943, margin: 2.443510507,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
  {
    id: 'gold-mms-004', date: '240104', transactionNumber: '9402', registerNumber: '12', storeCode: '417', skuCode: '4132337',
    transactionType: 'REGULAR SALE', mmsSales: 50.83436341, quantitySold: 0.618046972, margin: 7.076637824,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
  {
    id: 'gold-mms-005', date: '240106', transactionNumber: '9528', registerNumber: '13', storeCode: '417', skuCode: '3810420',
    transactionType: 'REGULAR SALE', mmsSales: 49.44375773, quantitySold: 0.618046972, margin: 4.820766378,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
  {
    id: 'gold-mms-006', date: '240109', transactionNumber: '3119', registerNumber: '16', storeCode: '417', skuCode: '3699183',
    transactionType: 'REGULAR SALE', mmsSales: 470.9517923, quantitySold: 1.236093943, margin: 26.40037083,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
  {
    id: 'gold-mms-007', date: '240112', transactionNumber: '2535', registerNumber: '12', storeCode: '417', skuCode: '3738769',
    transactionType: 'REGULAR SALE', mmsSales: 42.18170581, quantitySold: 0.618046972, margin: 4.412855377,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
  {
    id: 'gold-mms-008', date: '240116', transactionNumber: '3790', registerNumber: '14', storeCode: '417', skuCode: '4333232',
    transactionType: 'REGULAR SALE', mmsSales: 126.0815822, quantitySold: 2.472187886, margin: 6.352533993,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
  {
    id: 'gold-mms-009', date: '240121', transactionNumber: '6003', registerNumber: '16', storeCode: '721', skuCode: '3669694',
    transactionType: 'REGULAR SALE', mmsSales: 34.30160692, quantitySold: 0.618046972, margin: 8.572311496,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-002', goldLoadedAt: '2026-07-21T08:18:00.000Z',
  },
  {
    id: 'gold-mms-010', date: '240122', transactionNumber: '6114', registerNumber: '16', storeCode: '721', skuCode: '3009131',
    transactionType: 'REGULAR SALE', mmsSales: 44.19035847, quantitySold: 0.618046972, margin: 4.173362176,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-002', goldLoadedAt: '2026-07-21T08:18:00.000Z',
  },
  {
    id: 'gold-mms-011', date: '240126', transactionNumber: '5678', registerNumber: '14', storeCode: '460', skuCode: '3134350',
    transactionType: 'REGULAR SALE', mmsSales: 39.40049444, quantitySold: 0.618046972, margin: 3.965142151,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-002', goldLoadedAt: '2026-07-21T08:18:00.000Z',
  },
  {
    id: 'gold-mms-012', date: '240129', transactionNumber: '6138', registerNumber: '14', storeCode: '460', skuCode: '4127561',
    transactionType: 'REGULAR SALE', mmsSales: 173.671199, quantitySold: 0.618046972, margin: 8.856613103,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-002', goldLoadedAt: '2026-07-21T08:18:00.000Z',
  },
  {
    id: 'gold-mms-013', date: '240130', transactionNumber: '4673', registerNumber: '13', storeCode: '417', skuCode: '4419488',
    transactionType: 'REGULAR SALE', mmsSales: 300.9888752, quantitySold: 1.236093943, margin: 12.18788628,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'NONE', recordOrigin: 'Clean from Silver',
    silverResolution: 'Not required — clean in Silver', resolvedBy: '—', resolvedAt: '—', goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-MMS-20260721-002', goldLoadedAt: '2026-07-21T08:18:00.000Z',
  },
  {
    id: 'gold-mms-014', date: '240104', transactionNumber: '9109', registerNumber: '13', storeCode: '417', skuCode: '4455845',
    transactionType: 'REGULAR SALE', mmsSales: -217.2435105, quantitySold: -1.236093943, margin: -38.00988875,
    storeCategorization: 'SMR Small', datasetOnlyAnomaly: 'MMS_NEGATIVE_QTY_OR_SALES|MMS_NEGATIVE_SALES_IN_SALE_TRANSACTION_TYPE', recordOrigin: 'Accepted resolution',
    silverResolution: 'Accept as Valid', resolvedBy: 'Michelle', resolvedAt: '2026-07-21T07:45:00.000Z', goldRecordStatus: 'ACCEPTED_RESOLUTION',
    goldBatchId: 'GOLD-MMS-20260721-001', goldLoadedAt: '2026-07-21T08:15:00.000Z',
  },
];

export const MMS_GOLD_SCHEMA: Array<[string, string]> = [
  ['DATE', 'Validated MMS transaction date retained from Silver.'],
  ['TRANSACTION NUMBER', 'Trusted source transaction identifier.'],
  ['REGISTER NUMBER', 'Register that recorded the transaction.'],
  ['STORE CODE', 'Trusted source store identifier.'],
  ['SKU CODE', 'Trusted MMS product identifier.'],
  ['TRANSACTION TYPE', 'Validated MMS transaction type such as REGULAR SALE.'],
  ['MMS SALES', 'Gold-eligible MMS sales amount.'],
  ['QUANTITY SOLD', 'Gold-eligible quantity sold.'],
  ['MARGIN', 'Margin retained from the trusted MMS transaction line.'],
  ['STORE CATEGORIZATION', 'Source store segment retained for reporting.'],
  ['DATASET-ONLY ANOMALY', 'Original Silver MMS anomaly lineage; retained for accepted resolutions.'],
  ['RECORD ORIGIN', 'Whether the Gold row was clean in Silver or entered through an accepted resolution.'],
  ['SILVER RESOLUTION', 'The Silver decision that made the row eligible, or an indication that no review was required.'],
  ['RESOLVED BY', 'Reviewer recorded by Silver when applicable.'],
  ['RESOLVED AT', 'Silver resolution timestamp when applicable.'],
  ['GOLD RECORD STATUS', 'Generated Gold eligibility status: CLEAN or ACCEPTED_RESOLUTION.'],
  ['GOLD BATCH ID', 'Generated identifier for the Gold load batch.'],
  ['GOLD LOADED AT', 'Generated timestamp when the row entered Gold.'],
];
