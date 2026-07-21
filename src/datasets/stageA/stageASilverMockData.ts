export type StageAMatchStatus = 'MATCHED_W_PROVINCE' | 'MATCHED_WO_FALLBACK' | 'UNMATCHED_CUSTOMER' | 'MISSING_CUSTOMER_NUMBER';
export type StageAIssueStatus = 'For review' | 'Reviewed';
export type StageAResolution = 'Accept as Valid' | 'Exclude from Output';

export interface StageARow {
  id: string;
  loyalty: Record<string, string>;
  customer: Record<string, string>;
  matchStatus: StageAMatchStatus;
  datasetAnomaly: string;
  detail: string;
  issueStatus: StageAIssueStatus;
  resolution?: StageAResolution;
  auditNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  readyForStageB: 'READY' | 'PENDING_REVIEW' | 'EXCLUDED';
}

export const LOYALTY_COLUMNS = ['DATE', 'TRANSACTION NUMBER', 'REGISTER NUMBER', 'STORE CODE', 'CUSTOMER NUMBER', 'SKU CODE', 'TRANSACTION TYPE', 'LOYALTY SALES', 'QTY SOLD'] as const;
export const CUSTOMER_COLUMNS = ['CUSTOMER NUMBER', 'GENDER', 'BIRTHDAY', 'AGE', 'CITY', 'PROVINCE', 'MEMBER LOCATION', 'MEMBER SINCE', 'LAST VISIT'] as const;

export const STAGE_A_ROWS_CHECKED = 28_181_998;
export const STAGE_A_RULE_HITS = 3_068_093;
export const STAGE_A_ANOMALY_SUMMARY = [
  { anomaly: 'WITHOUT_PROVINCE', affected: 2_551_212, percentage: '9.0526%', definition: 'Matched customer has a blank or - province.' },
  { anomaly: 'UNMATCHED_CUSTOMER', affected: 394_967, percentage: '1.4015%', definition: 'Loyalty customer number did not match either customer database.' },
  { anomaly: 'DUPLICATES', affected: 58_195, percentage: '0.2065%', definition: 'Same date, transaction number, register, store, SKU, and transaction type.' },
  { anomaly: 'BIRTHDAY_AGE_OVER_120', affected: 44_716, percentage: '0.1587%', definition: 'Birthday-derived age exceeds 120.' },
  { anomaly: 'BIRTHDAY_INVALID', affected: 12_748, percentage: '0.0452%', definition: 'Populated birthday cannot be parsed.' },
  { anomaly: 'BIRTHDAY_AGE_MISMATCH', affected: 2_555, percentage: '0.0091%', definition: 'Reported age differs from birthday-derived age by more than two years.' },
  { anomaly: 'BIRTHDAY_IN_FUTURE', affected: 2_375, percentage: '0.0084%', definition: 'Birthday is after the processing date.' },
  { anomaly: 'NEGATIVE_QTY', affected: 663, percentage: '0.0024%', definition: 'Quantity sold is below zero.' },
  { anomaly: 'NEGATIVE_LOYALTY_SALES', affected: 662, percentage: '0.0023%', definition: 'Loyalty sales amount is below zero.' },
] as const;

const DATASET_ONLY_FLAGS = new Set(['DUPLICATES', 'NEGATIVE_QTY', 'NEGATIVE_LOYALTY_SALES']);

export const STAGE_A_RELATIONAL_FLAG_SUMMARY = STAGE_A_ANOMALY_SUMMARY.filter(item =>
  !DATASET_ONLY_FLAGS.has(item.anomaly));

export const STAGE_A_DATASET_ANOMALY_SUMMARY = STAGE_A_ANOMALY_SUMMARY.filter(item =>
  DATASET_ONLY_FLAGS.has(item.anomaly));

export function getStageADatasetOnlyFlags(row: StageARow): string {
  const flags = row.datasetAnomaly.split('|').filter(flag => DATASET_ONLY_FLAGS.has(flag));
  return flags.length ? flags.join('|') : 'NONE';
}

export function getStageARelationalFlags(row: StageARow): string {
  const flags = row.datasetAnomaly.split('|').filter(flag => flag !== 'NONE' && !DATASET_ONLY_FLAGS.has(flag));
  return flags.length ? flags.join('|') : 'NONE';
}

const loyalty = (txn: string, customer: string, sku: string, sales: string, qty: string, type = 'REGULAR SALE') => ({
  DATE: '2025-01-04', 'TRANSACTION NUMBER': txn, 'REGISTER NUMBER': '13', 'STORE CODE': '417', 'CUSTOMER NUMBER': customer,
  'SKU CODE': sku, 'TRANSACTION TYPE': type, 'LOYALTY SALES': sales, 'QTY SOLD': qty,
});
const customer = (number: string, province: string, source: string) => ({
  'CUSTOMER NUMBER': number, GENDER: 'FEMALE', BIRTHDAY: '1992-11-25', AGE: '33', CITY: 'CEBU CITY', PROVINCE: province,
  'MEMBER LOCATION': '417', 'MEMBER SINCE': '2018-05-14', 'LAST VISIT': '2025-01-04', SOURCE: source,
});

export function createStageARows(): StageARow[] {
  return [
    { id: 'stage-a-01', loyalty: loyalty('9109', '50981396-RPC', '4455845', '217.24', '1'), customer: customer('50981396-RPC', 'CEBU', 'W_PROVINCE'), matchStatus: 'MATCHED_W_PROVINCE', datasetAnomaly: 'NONE', detail: 'Primary customer match confirmed.', issueStatus: 'Reviewed', resolution: 'Accept as Valid', auditNote: 'Automatic primary match.', readyForStageB: 'READY' },
    { id: 'stage-a-02', loyalty: loyalty('9110', '61120451-RPC', '4455755', '214.15', '1'), customer: customer('61120451-RPC', '', 'WO_PROVINCE'), matchStatus: 'MATCHED_WO_FALLBACK', datasetAnomaly: 'WITHOUT_PROVINCE', detail: 'Customer recovered through fallback source with blank province.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
    { id: 'stage-a-03', loyalty: loyalty('9528', '73418820-RPC', '3773016', '-207.82', '-1', 'REGULAR RETURN'), customer: customer('73418820-RPC', 'CEBU', 'W_PROVINCE'), matchStatus: 'MATCHED_W_PROVINCE', datasetAnomaly: 'NEGATIVE_QTY|NEGATIVE_LOYALTY_SALES', detail: 'Matched customer; upstream Loyalty value flags retained.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
    { id: 'stage-a-04', loyalty: loyalty('2142', 'UNKNOWN-001', '3527641', '31.52', '1'), customer: {}, matchStatus: 'UNMATCHED_CUSTOMER', datasetAnomaly: 'UNMATCHED_CUSTOMER', detail: 'Loyalty customer number did not match either customer database.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
    { id: 'stage-a-05', loyalty: loyalty('2427', 'UNKNOWN-002', '3489170', '27.19', '4'), customer: {}, matchStatus: 'UNMATCHED_CUSTOMER', datasetAnomaly: 'UNMATCHED_CUSTOMER|DUPLICATES', detail: 'Customer is unmatched and the six-key transaction line repeats.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
    { id: 'stage-a-06', loyalty: loyalty('2535', '66340010-RPC', '3738769', '42.18', '1'), customer: { ...customer('66340010-RPC', 'CEBU', 'W_PROVINCE'), BIRTHDAY: '10112' }, matchStatus: 'MATCHED_W_PROVINCE', datasetAnomaly: 'BIRTHDAY_INVALID', detail: 'Customer birthday cannot be parsed.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
    { id: 'stage-a-07', loyalty: loyalty('3146', '91350114-RPC', '3050720', '1343.48', '22'), customer: { ...customer('91350114-RPC', 'BOHOL', 'W_PROVINCE'), BIRTHDAY: '1900-01-01', AGE: '35' }, matchStatus: 'MATCHED_W_PROVINCE', datasetAnomaly: 'BIRTHDAY_AGE_OVER_120|BIRTHDAY_AGE_MISMATCH', detail: 'Birthday implies age over 120 and conflicts with reported age.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
    { id: 'stage-a-08', loyalty: loyalty('3790', '82744510-RPC', '4333232', '126.08', '2'), customer: { ...customer('82744510-RPC', '', 'WO_PROVINCE'), BIRTHDAY: '2030-02-10' }, matchStatus: 'MATCHED_WO_FALLBACK', datasetAnomaly: 'WITHOUT_PROVINCE|BIRTHDAY_IN_FUTURE', detail: 'Fallback customer has blank province and future birthday.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
  ];
}
