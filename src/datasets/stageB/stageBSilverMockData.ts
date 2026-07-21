export const STAGE_A_COLUMNS = [
  'DATE',
  'TRANSACTION_NUMBER',
  'REGISTER_NUMBER',
  'STORE_CODE',
  'CUSTOMER_NUMBER',
  'CUSTOMER_NUMBER_CLEAN',
  'SKU_CODE',
  'TRANSACTION_TYPE',
  'QTY_SOLD',
  'LOYALTY_SALES',
  'CUSTOMER_MATCH_STATUS',
  'CLD_SOURCE',
  'CLD_CUSTOMER_NUMBER',
  'CLD_GENDER',
  'CLD_BIRTHDAY',
  'CLD_AGE',
  'CLD_CITY',
  'CLD_PROVINCE',
  'CLD_EXPIRY_DATE',
  'CLD_MEMBER_LOCATION',
  'CLD_APPLICATION_DATE',
  'CLD_MEMBER_SINCE',
  'CLD_LAST_VISIT',
  'CLD_FREQUENCY_OF_VISIT',
  'CLD_LAST_VISITED_STORE',
  'HAS_NEGATIVE_QTY_OR_LOYALTY_SALES',
  'Has_Anomaly_Or_Not',
  'Anomaly_Flags',
] as const;

export const MMS_COLUMNS = [
  'DATE',
  'TRANSACTION NUMBER',
  'REGISTER NUMBER',
  'STORE CODE',
  'SKU CODE',
  'TRANSACTION TYPE',
  'MMS SALES',
  'QTY SOLD',
  'MARGIN',
  'STORE CATEGORIZATION',
] as const;

export const STAGE_B_CLASSIFICATION_COLUMNS = [
  'DATASET_ONLY_ANOMALY',
  'MATCH_STATUS',
  'MATCH_QUALITY',
  'BASE_CASE_MATCHING',
  'FINAL_MATCHING',
  'detail',
  'has_anomaly_or_not',
  'loyalty_customer_info_source',
  'STAGE_C_READINESS',
] as const;

export const HUMAN_REVIEW_COLUMNS = [
  'Issue Status',
  'Resolution',
  'Audit Note',
  'Resolved By',
  'Resolved At',
] as const;

export type MatchStatus =
  | 'BOTH_UNDERSTATED'
  | 'MMS_UNDERSTATED'
  | 'LOYALTY_ONLY'
  | 'LOYALTY_UNDERSTATED'
  | 'NON_LOYALTY'
  | 'JOINED - Exact/Near Match'
  | 'JOINED - Mismatch'
  | 'UNJOINABLE'
  | 'UNCERTAIN';

export type MatchQuality =
  | 'EXACT_MATCH_POSITIVE'
  | 'EXACT_MATCH_ZERO'
  | 'EXACT_MATCH_NEGATIVE'
  | 'NEAR_MATCH_WITHIN_1_PESO'
  | 'MMS_ZERO_LOY_NOT_ZERO'
  | 'LOY_ZERO_MMS_NOT_ZERO'
  | 'MMS_POS_LOY_NEG'
  | 'MMS_NEG_LOY_POS'
  | 'LOYALTY_GREATER'
  | 'MMS_GREATER'
  | 'JOINED_OTHER_MISMATCH'
  | 'UNJOINABLE_TRANSACTION_NUMBER'
  | 'UNJOINABLE_TRANSACTION_TYPE'
  | 'BOTH_UNDERSTATED'
  | 'MMS_UNDERSTATED'
  | 'LOYALTY_ONLY'
  | 'LOYALTY_UNDERSTATED'
  | 'NON_LOYALTY'
  | 'UNCERTAIN';

export type ReviewView = 'Basket' | 'Row Comparison' | 'Candidate Comparison' | 'Audit Row';
export type IssueStatus = 'For review' | 'Reviewed';
export type ResolutionChoice = 'Accept as Valid' | 'Exclude from Output';
export type StageCReadiness = 'READY' | 'PENDING_REVIEW' | 'EXCLUDED' | 'AUDIT_ONLY';

export interface StageBRow {
  id: string;
  stageA: Record<string, string>;
  mms: Record<string, string>;
  datasetOnlyAnomaly: string;
  matchStatus: MatchStatus;
  matchQuality: MatchQuality;
  baseCaseMatching: string;
  finalMatching: string;
  detail: string;
  hasAnomalyOrNot: string;
  loyaltyCustomerInfoSource: string;
  stageCReadiness: StageCReadiness;
  issueStatus: IssueStatus;
  resolution?: ResolutionChoice;
  auditNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  requiresStageBReview: boolean;
  isMmsSpine: boolean;
}

export interface MatchStatusSummaryItem {
  status: MatchStatus;
  reviewView: ReviewView;
  affectedMmsRows: number;
  definition: string;
}

export const STAGE_B_MMS_ROWS_CHECKED = 133_166;

export const RECONCILIATION_CONTEXT = [
  {
    label: 'Full Audit Records',
    value: 133_194,
    definition: 'All provisional Stage B reconciliation records, including MMS-spine rows and audit-only records retained outside the output spine.',
  },
  {
    label: 'Matched 6-Key Records',
    value: 133_112,
    definition: 'Provisional full-audit records joined on date, transaction number, register, store, SKU, and transaction type.',
  },
  {
    label: 'MMS-Only Records',
    value: 54,
    definition: 'Provisional full-audit records present on the MMS side without a confirmed Stage A counterpart.',
  },
  {
    label: 'Loyalty-Only Differences',
    value: 28,
    definition: 'Provisional Stage A records retained for reconciliation accounting but not added to the MMS output spine.',
  },
] as const;

export const REVIEW_VIEW_DEFINITIONS: Record<ReviewView, string> = {
  Basket: 'The 4-key transaction group: date + transaction number + register + store. Review displays every SKU row belonging to the basket.',
  'Row Comparison': 'A confirmed MMS-to-Stage A join on all 6 keys. Review displays both source records in the stitched row.',
  'Candidate Comparison': 'A confirmed 6-key join was not possible. Review displays the original record and one or more possible candidates with transaction-number or transaction-type differences.',
  'Audit Row': 'A record retained for reconciliation accounting but not added to the MMS output spine.',
};

export const MATCH_STATUS_SUMMARY: MatchStatusSummaryItem[] = [
  { status: 'BOTH_UNDERSTATED', reviewView: 'Basket', affectedMmsRows: 15, definition: 'The same 4-key basket exists in MMS and Loyalty, but each side contains one or more SKU rows missing from the other.' },
  { status: 'MMS_UNDERSTATED', reviewView: 'Basket', affectedMmsRows: 20, definition: 'The basket exists in both sources, but one or more Loyalty SKU rows are missing from MMS. MMS is incomplete compared with Loyalty.' },
  { status: 'LOYALTY_ONLY', reviewView: 'Audit Row', affectedMmsRows: 0, definition: 'The transaction exists in Loyalty or Stage A but has no corresponding MMS transaction. It remains in the full audit and does not create an MMS output row.' },
  { status: 'LOYALTY_UNDERSTATED', reviewView: 'Basket', affectedMmsRows: 18, definition: 'The basket exists in both sources, but one or more MMS SKU rows are missing from Loyalty. Loyalty is incomplete compared with MMS.' },
  { status: 'NON_LOYALTY', reviewView: 'Basket', affectedMmsRows: 30, definition: 'The MMS transaction has no Loyalty basket. This is generally a valid non-loyal transaction and is not automatically an anomaly.' },
  { status: 'JOINED - Exact/Near Match', reviewView: 'Row Comparison', affectedMmsRows: 132_980, definition: 'MMS and Loyalty joined on all 6 keys, and their sales values are equal or within the approved one-peso tolerance.' },
  { status: 'JOINED - Mismatch', reviewView: 'Row Comparison', affectedMmsRows: 54, definition: 'MMS and Loyalty joined on all 6 keys, but their sales values do not agree. MATCH_QUALITY identifies the mismatch subtype.' },
  { status: 'UNJOINABLE', reviewView: 'Candidate Comparison', affectedMmsRows: 32, definition: 'Possible matching evidence exists, but the records cannot be joined safely because of transaction-number or transaction-type key differences.' },
  { status: 'UNCERTAIN', reviewView: 'Candidate Comparison', affectedMmsRows: 17, definition: 'The record does not clearly fit any current reconciliation rule and requires manual review or future rule refinement.' },
];

const exactQualities: MatchQuality[] = [
  'EXACT_MATCH_POSITIVE',
  'EXACT_MATCH_ZERO',
  'EXACT_MATCH_NEGATIVE',
  'NEAR_MATCH_WITHIN_1_PESO',
];

const reviewSeeds: Array<{
  status: MatchStatus;
  quality: MatchQuality;
  anomaly: string;
  detail: string;
}> = [
  { status: 'BOTH_UNDERSTATED', quality: 'BOTH_UNDERSTATED', anomaly: 'MMS_NEGATIVE_QTY_OR_SALES|MMS_NEGATIVE_SALES_IN_SALE_TRANSACTION_TYPE', detail: 'Basket comparison suggests both sources are understated.' },
  { status: 'MMS_UNDERSTATED', quality: 'MMS_UNDERSTATED', anomaly: 'MMS_NEGATIVE_QTY_OR_SALES', detail: 'MMS basket total is below the Stage A loyalty total.' },
  { status: 'LOYALTY_ONLY', quality: 'LOYALTY_ONLY', anomaly: 'CUSTOMER_BIRTHDAY_AGE_OVER_120', detail: 'Audit-only Stage A row; no MMS output-spine row is created.' },
  { status: 'LOYALTY_UNDERSTATED', quality: 'LOYALTY_UNDERSTATED', anomaly: 'HAS_NEGATIVE_QTY_OR_LOYALTY_SALES', detail: 'Stage A loyalty total is below the MMS basket total.' },
  { status: 'NON_LOYALTY', quality: 'NON_LOYALTY', anomaly: 'NONE', detail: 'MMS transaction has no loyalty-side contribution.' },
  { status: 'JOINED - Mismatch', quality: 'MMS_ZERO_LOY_NOT_ZERO', anomaly: 'MMS_MISSING_CRITICAL_KEY', detail: 'Six-key join succeeded; MMS sales is zero while loyalty sales is non-zero.' },
  { status: 'JOINED - Mismatch', quality: 'LOY_ZERO_MMS_NOT_ZERO', anomaly: 'MULTIPLE_MMS_6KEY_ROWS', detail: 'Six-key join succeeded; loyalty sales is zero while MMS sales is non-zero.' },
  { status: 'JOINED - Mismatch', quality: 'MMS_POS_LOY_NEG', anomaly: 'MMS_NEGATIVE_QTY_OR_SALES', detail: 'Six-key join succeeded; MMS is positive while loyalty sales is negative.' },
  { status: 'UNJOINABLE', quality: 'UNJOINABLE_TRANSACTION_NUMBER', anomaly: 'MMS_MISSING_CRITICAL_KEY', detail: 'Candidate rows differ on transaction number and need comparison.' },
  { status: 'UNCERTAIN', quality: 'UNCERTAIN', anomaly: 'HAS_NEGATIVE_QTY_OR_LOYALTY_SALES|MMS_NEGATIVE_QTY_OR_SALES', detail: 'Candidate evidence is insufficient for a confident final classification.' },
];

function stageARecord(index: number): Record<string, string> {
  const day = String((index % 28) + 1).padStart(2, '0');
  const customer = `50000000033${String(8000 + index).padStart(4, '0')}-RPC`;
  return {
    DATE: `2401${day}`,
    TRANSACTION_NUMBER: String(4100 + index),
    REGISTER_NUMBER: String(10 + (index % 7)),
    STORE_CODE: '417',
    CUSTOMER_NUMBER: customer,
    CUSTOMER_NUMBER_CLEAN: customer,
    SKU_CODE: String(3_000_000 + (index * 13_719)),
    TRANSACTION_TYPE: 'REGULAR SALE',
    QTY_SOLD: index % 5 === 0 ? '-1.0000210066' : String(1 + (index % 3)),
    LOYALTY_SALES: (24.75 + (index * 8.35)).toFixed(6),
    CUSTOMER_MATCH_STATUS: index % 3 === 0 ? 'MATCHED_VIA_W_PROVINCE' : 'MATCHED_VIA_W_CITY',
    CLD_SOURCE: index % 3 === 0 ? 'W_PROVINCE' : 'W_CITY',
    CLD_CUSTOMER_NUMBER: customer,
    CLD_GENDER: index % 2 === 0 ? 'Female' : 'Not Given',
    CLD_BIRTHDAY: `${1970 + (index % 28)}${String((index % 12) + 1).padStart(2, '0')}15`,
    CLD_AGE: String(28 + index),
    CLD_CITY: index % 2 === 0 ? 'CITY OF MASBATE (Capital)' : 'USON',
    CLD_PROVINCE: 'MASBATE',
    CLD_EXPIRY_DATE: `202${7 + (index % 2)}1231`,
    CLD_MEMBER_LOCATION: String(400 + index),
    CLD_APPLICATION_DATE: `2023${String((index % 12) + 1).padStart(2, '0')}07`,
    CLD_MEMBER_SINCE: `2023${String((index % 12) + 1).padStart(2, '0')}07`,
    CLD_LAST_VISIT: `2026${String((index % 12) + 1).padStart(2, '0')}13`,
    CLD_FREQUENCY_OF_VISIT: String(8 + (index * 2)),
    CLD_LAST_VISITED_STORE: index % 2 === 0 ? '417' : '721',
    HAS_NEGATIVE_QTY_OR_LOYALTY_SALES: index % 5 === 0 ? 'true' : 'false',
    Has_Anomaly_Or_Not: index % 5 === 0 ? '1A' : '0',
    Anomaly_Flags: index % 5 === 0 ? 'NEGATIVE_QTY_OR_LOYALTY_SALES' : 'NONE',
  };
}

function mmsRecord(index: number): Record<string, string> {
  const source = stageARecord(index);
  return {
    DATE: source.DATE,
    'TRANSACTION NUMBER': source.TRANSACTION_NUMBER,
    'REGISTER NUMBER': source.REGISTER_NUMBER,
    'STORE CODE': source.STORE_CODE,
    'SKU CODE': source.SKU_CODE,
    'TRANSACTION TYPE': 'REGULAR SALE',
    'MMS SALES': (25.1 + (index * 8.2)).toFixed(6),
    'QTY SOLD': source.QTY_SOLD,
    MARGIN: (3.25 + (index * 1.18)).toFixed(6),
    'STORE CATEGORIZATION': 'SMR Small',
  };
}

function cleanRow(index: number): StageBRow {
  const stageA = stageARecord(index);
  const mms = mmsRecord(index);
  const quality = exactQualities[(index - 1) % exactQualities.length];
  if (quality === 'EXACT_MATCH_ZERO') {
    stageA.LOYALTY_SALES = '0';
    mms['MMS SALES'] = '0';
  }
  if (quality === 'EXACT_MATCH_NEGATIVE') {
    stageA.LOYALTY_SALES = '-25.000000';
    mms['MMS SALES'] = '-25.000000';
    stageA.HAS_NEGATIVE_QTY_OR_LOYALTY_SALES = 'true';
    stageA.Has_Anomaly_Or_Not = '1A';
    stageA.Anomaly_Flags = 'NEGATIVE_QTY_OR_LOYALTY_SALES';
  }
  if (quality === 'NEAR_MATCH_WITHIN_1_PESO') mms['MMS SALES'] = (Number(stageA.LOYALTY_SALES) + 0.5).toFixed(6);

  const datasetOnlyAnomaly = index === 3
    ? 'HAS_NEGATIVE_QTY_OR_LOYALTY_SALES|MMS_NEGATIVE_QTY_OR_SALES'
    : 'NONE';
  return {
    id: `stage-b-${String(index).padStart(2, '0')}`,
    stageA,
    mms,
    datasetOnlyAnomaly,
    matchStatus: 'JOINED - Exact/Near Match',
    matchQuality: quality,
    baseCaseMatching: '6-Key Match',
    finalMatching: 'Matched',
    detail: 'Six-key stitched row passed the provisional exact/near reconciliation rule.',
    hasAnomalyOrNot: datasetOnlyAnomaly === 'NONE' ? '0' : '1',
    loyaltyCustomerInfoSource: stageA.CLD_SOURCE,
    stageCReadiness: 'READY',
    issueStatus: 'Reviewed',
    resolution: 'Accept as Valid',
    auditNote: datasetOnlyAnomaly === 'NONE' ? 'No Stage B relational issue.' : 'Dataset anomaly was reviewed upstream; no repeat Stage B review required.',
    resolvedBy: 'Upstream validation',
    resolvedAt: '2026-07-20T09:30:00.000Z',
    requiresStageBReview: false,
    isMmsSpine: true,
  };
}

function reviewRow(seed: typeof reviewSeeds[number], offset: number): StageBRow {
  const index = offset + 11;
  const stageA = stageARecord(index);
  const mms = mmsRecord(index);
  const isMmsSpine = seed.status !== 'LOYALTY_ONLY';

  if (!isMmsSpine) Object.keys(mms).forEach(key => { mms[key] = ''; });
  if (seed.status === 'UNJOINABLE') mms['TRANSACTION NUMBER'] = String(Number(stageA.TRANSACTION_NUMBER) + 1);
  if (seed.quality === 'MMS_ZERO_LOY_NOT_ZERO') mms['MMS SALES'] = '0';
  if (seed.quality === 'LOY_ZERO_MMS_NOT_ZERO') stageA.LOYALTY_SALES = '0';
  if (seed.quality === 'MMS_POS_LOY_NEG') stageA.LOYALTY_SALES = '-35.000000';

  return {
    id: `stage-b-${String(index).padStart(2, '0')}`,
    stageA,
    mms,
    datasetOnlyAnomaly: seed.anomaly,
    matchStatus: seed.status,
    matchQuality: seed.quality,
    baseCaseMatching: seed.status.startsWith('JOINED') ? '6-Key Match' : 'Basket/Candidate Check',
    finalMatching: 'Review',
    detail: seed.detail,
    hasAnomalyOrNot: '1',
    loyaltyCustomerInfoSource: stageA.CLD_SOURCE,
    stageCReadiness: 'PENDING_REVIEW',
    issueStatus: 'For review',
    requiresStageBReview: true,
    isMmsSpine,
  };
}

export function createStageBRows(): StageBRow[] {
  return [
    ...Array.from({ length: 10 }, (_, index) => cleanRow(index + 1)),
    ...reviewSeeds.map(reviewRow),
  ];
}
