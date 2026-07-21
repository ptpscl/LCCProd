export type StageAMatchStatus = 'MATCHED' | 'UNMATCHED_CUSTOMER' | 'MISSING_CUSTOMER_NUMBER' | 'DUPLICATE_CUSTOMER_MATCH';
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
export const STAGE_A_RULE_HITS = 394_967;
export const STAGE_A_ANOMALY_SUMMARY = [
  { anomaly: 'UNMATCHED_CUSTOMER', affected: 394_967, percentage: '1.4015%', definition: 'Loyalty customer number did not match either customer database.' },
  { anomaly: 'MISSING_CUSTOMER_NUMBER', affected: null, percentage: null, definition: 'Loyalty row has no usable customer number, so a customer relationship cannot be evaluated.' },
  { anomaly: 'DUPLICATE_CUSTOMER_MATCH', affected: null, percentage: null, definition: 'One loyalty customer number matches more than one eligible customer record.' },
] as const;

const RELATIONAL_FLAGS = new Set(STAGE_A_ANOMALY_SUMMARY.map(item => item.anomaly));

export const STAGE_A_RELATIONAL_FLAG_SUMMARY = STAGE_A_ANOMALY_SUMMARY;

export function getStageARelationalFlags(row: StageARow): string {
  const flags = row.datasetAnomaly.split('|').filter(flag => RELATIONAL_FLAGS.has(flag));
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
    { id: 'stage-a-01', loyalty: loyalty('9109', '50981396-RPC', '4455845', '217.24', '1'), customer: customer('50981396-RPC', 'CEBU', 'W_PROVINCE'), matchStatus: 'MATCHED', datasetAnomaly: 'NONE', detail: 'Exactly one eligible customer match confirmed.', issueStatus: 'Reviewed', resolution: 'Accept as Valid', auditNote: 'Automatic unique match.', readyForStageB: 'READY' },
    { id: 'stage-a-04', loyalty: loyalty('2142', 'UNKNOWN-001', '3527641', '31.52', '1'), customer: {}, matchStatus: 'UNMATCHED_CUSTOMER', datasetAnomaly: 'UNMATCHED_CUSTOMER', detail: 'Loyalty customer number did not match either customer database.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
    { id: 'stage-a-05', loyalty: loyalty('2427', '', '3489170', '27.19', '4'), customer: {}, matchStatus: 'MISSING_CUSTOMER_NUMBER', datasetAnomaly: 'MISSING_CUSTOMER_NUMBER', detail: 'Loyalty row has no usable customer number.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
    { id: 'stage-a-06', loyalty: loyalty('2535', '66340010-RPC', '3738769', '42.18', '1'), customer: { ...customer('66340010-RPC', 'CEBU', 'W_PROVINCE'), SOURCE: '2 ELIGIBLE MATCHES' }, matchStatus: 'DUPLICATE_CUSTOMER_MATCH', datasetAnomaly: 'DUPLICATE_CUSTOMER_MATCH', detail: 'Customer number matches multiple eligible customer records.', issueStatus: 'For review', readyForStageB: 'PENDING_REVIEW' },
  ];
}
