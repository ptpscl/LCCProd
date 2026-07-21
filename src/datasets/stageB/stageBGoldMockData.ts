import {
  MMS_COLUMNS,
  STAGE_A_COLUMNS,
  MatchQuality,
  MatchStatus,
} from './stageBSilverMockData';

export type GoldStageBRecordOrigin = 'Clean from Silver' | 'Accepted resolution';
export type GoldStageBRecordStatus = 'CLEAN' | 'ACCEPTED_RESOLUTION';

export interface GoldStageBRow {
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
  stageCReadiness: 'READY';
  silverIssueStatus: 'Reviewed';
  silverResolution: string;
  silverAuditNote: string;
  resolvedBy: string;
  resolvedAt: string;
  recordOrigin: GoldStageBRecordOrigin;
  goldRecordStatus: GoldStageBRecordStatus;
  goldBatchId: string;
  goldLoadedAt: string;
}

export const GOLD_STAGE_B_COUNTS = {
  stageBRowsChecked: 133_166,
  trusted: 133_157,
  cleanFromSilver: 133_157,
  acceptedFromSilver: 0,
  stillBlocked: 9,
} as const;

export const GOLD_STAGE_B_RELIABILITY = (
  GOLD_STAGE_B_COUNTS.trusted / GOLD_STAGE_B_COUNTS.stageBRowsChecked
) * 100;

export const GOLD_MATCH_STATUS_PROFILE: Array<{
  status: MatchStatus;
  affectedMmsRows: number;
  blockedInSilver: number | null;
  publishedToGold: number;
  definition: string;
}> = [
  {
    status: 'BOTH_UNDERSTATED',
    affectedMmsRows: 15,
    blockedInSilver: 1,
    publishedToGold: 14,
    definition: 'The same basket exists in MMS and Loyalty, but both sides are understated.',
  },
  {
    status: 'MMS_UNDERSTATED',
    affectedMmsRows: 20,
    blockedInSilver: 1,
    publishedToGold: 19,
    definition: 'The basket exists in Loyalty, but some Loyalty SKU rows are missing in MMS.',
  },
  {
    status: 'LOYALTY_ONLY',
    affectedMmsRows: 0,
    blockedInSilver: null,
    publishedToGold: 0,
    definition: 'The transaction exists in Loyalty but has no corresponding MMS transaction. It remains audit-only and is not published to this MMS-spine Gold output.',
  },
  {
    status: 'LOYALTY_UNDERSTATED',
    affectedMmsRows: 18,
    blockedInSilver: 1,
    publishedToGold: 17,
    definition: 'The basket exists in MMS, but some MMS SKU rows are missing in Loyalty.',
  },
  {
    status: 'NON_LOYALTY',
    affectedMmsRows: 30,
    blockedInSilver: 1,
    publishedToGold: 29,
    definition: 'The MMS transaction has no Loyalty evidence and is treated as a non-loyalty transaction.',
  },
  {
    status: 'JOINED - Exact/Near Match',
    affectedMmsRows: 132_980,
    blockedInSilver: 0,
    publishedToGold: 132_980,
    definition: 'MMS and Loyalty joined on the six-key and sales matched exactly or within the accepted tolerance.',
  },
  {
    status: 'JOINED - Mismatch',
    affectedMmsRows: 54,
    blockedInSilver: 3,
    publishedToGold: 51,
    definition: 'MMS and Loyalty joined using the six-key, but their sales values do not agree.',
  },
  {
    status: 'UNJOINABLE',
    affectedMmsRows: 32,
    blockedInSilver: 1,
    publishedToGold: 31,
    definition: 'Possible Loyalty evidence exists, but the row cannot be safely joined because of key issues such as transaction number or transaction type.',
  },
  {
    status: 'UNCERTAIN',
    affectedMmsRows: 17,
    blockedInSilver: 1,
    publishedToGold: 16,
    definition: 'The row did not clearly fit a defined reconciliation rule and requires review in Silver.',
  },
];

interface GoldRowSeed {
  status: MatchStatus;
  quality: MatchQuality;
  anomaly?: string;
  loyaltySales?: number;
  mmsSales?: number;
  detail: string;
}

const ROW_SEEDS: GoldRowSeed[] = [
  { status: 'JOINED - Exact/Near Match', quality: 'EXACT_MATCH_POSITIVE', loyaltySales: 61.18665, mmsSales: 61.18665, detail: 'Six-key join and positive sales values matched exactly.' },
  { status: 'JOINED - Exact/Near Match', quality: 'EXACT_MATCH_ZERO', loyaltySales: 0, mmsSales: 0, detail: 'Six-key join and both sales values are zero.' },
  { status: 'JOINED - Exact/Near Match', quality: 'NEAR_MATCH_WITHIN_1_PESO', loyaltySales: 42.18, mmsSales: 42.68, detail: 'Six-key joined sales are within the accepted one-peso tolerance.' },
  { status: 'JOINED - Exact/Near Match', quality: 'EXACT_MATCH_NEGATIVE', anomaly: 'HAS_NEGATIVE_QTY_OR_LOYALTY_SALES|MMS_NEGATIVE_QTY_OR_SALES', loyaltySales: -25, mmsSales: -25, detail: 'Six-key join and negative return values matched exactly.' },
  { status: 'BOTH_UNDERSTATED', quality: 'BOTH_UNDERSTATED', anomaly: 'MULTIPLE_MMS_6KEY_ROWS', loyaltySales: 84.2, mmsSales: 79.1, detail: 'Published basket retains the final Silver both-understated classification.' },
  { status: 'MMS_UNDERSTATED', quality: 'MMS_UNDERSTATED', loyaltySales: 124.4, mmsSales: 101.8, detail: 'Published row retains the final Silver MMS-understated classification.' },
  { status: 'LOYALTY_UNDERSTATED', quality: 'LOYALTY_UNDERSTATED', loyaltySales: 71.5, mmsSales: 92.4, detail: 'Published row retains the final Silver Loyalty-understated classification.' },
  { status: 'NON_LOYALTY', quality: 'NON_LOYALTY', loyaltySales: 0, mmsSales: 54.75, detail: 'No Loyalty evidence was found; the MMS row was published as non-loyalty.' },
  { status: 'JOINED - Mismatch', quality: 'LOYALTY_GREATER', loyaltySales: 153.75, mmsSales: 148.25, detail: 'Six-key join retained with Loyalty sales greater than MMS sales.' },
  { status: 'JOINED - Mismatch', quality: 'MMS_GREATER', loyaltySales: 210.4, mmsSales: 218.9, detail: 'Six-key join retained with MMS sales greater than Loyalty sales.' },
  { status: 'JOINED - Mismatch', quality: 'MMS_POS_LOY_NEG', anomaly: 'HAS_NEGATIVE_QTY_OR_LOYALTY_SALES', loyaltySales: -35, mmsSales: 35, detail: 'Six-key join retained with opposing sales signs after Silver validation.' },
  { status: 'UNJOINABLE', quality: 'UNJOINABLE_TRANSACTION_NUMBER', anomaly: 'MMS_MISSING_CRITICAL_KEY', loyaltySales: 88.2, mmsSales: 88.2, detail: 'Silver retained the MMS-spine row while possible Loyalty evidence remained unjoinable.' },
  { status: 'UNJOINABLE', quality: 'UNJOINABLE_TRANSACTION_TYPE', loyaltySales: 73.9, mmsSales: 73.9, detail: 'Silver retained the MMS-spine row after a transaction-type candidate conflict.' },
  { status: 'UNCERTAIN', quality: 'UNCERTAIN', anomaly: 'MMS_NEGATIVE_QTY_OR_SALES', loyaltySales: 46.1, mmsSales: 46.1, detail: 'Silver validation retained the MMS-spine row with uncertain reconciliation lineage.' },
];

function createStageARecord(index: number, seed: GoldRowSeed): Record<string, string> {
  const day = String(index + 1).padStart(2, '0');
  const customerNumber = seed.status === 'NON_LOYALTY' ? '' : `50000000033${String(8100 + index).padStart(4, '0')}-RPC`;
  const hasNegative = Number(seed.loyaltySales) < 0;
  return {
    DATE: `2401${day}`,
    TRANSACTION_NUMBER: String(8700 + index),
    REGISTER_NUMBER: String(11 + (index % 5)),
    STORE_CODE: '417',
    CUSTOMER_NUMBER: customerNumber,
    CUSTOMER_NUMBER_CLEAN: customerNumber,
    SKU_CODE: String(3_700_000 + (index * 17_875)),
    TRANSACTION_TYPE: 'REGULAR SALE',
    QTY_SOLD: hasNegative ? '-1.000000' : String(1 + (index % 3)),
    LOYALTY_SALES: seed.status === 'NON_LOYALTY' ? '' : Number(seed.loyaltySales).toFixed(6),
    CUSTOMER_MATCH_STATUS: customerNumber ? 'MATCHED_VIA_W_CITY' : 'NO_LOYALTY_CUSTOMER',
    CLD_SOURCE: customerNumber ? 'W_CITY' : 'NONE',
    CLD_CUSTOMER_NUMBER: customerNumber,
    CLD_GENDER: customerNumber ? (index % 2 === 0 ? 'Female' : 'Not Given') : '',
    CLD_BIRTHDAY: customerNumber ? `${1970 + index}0615` : '',
    CLD_AGE: customerNumber ? String(34 + index) : '',
    CLD_CITY: customerNumber ? (index % 2 === 0 ? 'CITY OF MASBATE (Capital)' : 'USON') : '',
    CLD_PROVINCE: customerNumber ? 'MASBATE' : '',
    CLD_EXPIRY_DATE: customerNumber ? '20281231' : '',
    CLD_MEMBER_LOCATION: customerNumber ? String(417 + index) : '',
    CLD_APPLICATION_DATE: customerNumber ? '20230107' : '',
    CLD_MEMBER_SINCE: customerNumber ? '20230107' : '',
    CLD_LAST_VISIT: customerNumber ? '20260713' : '',
    CLD_FREQUENCY_OF_VISIT: customerNumber ? String(10 + index) : '',
    CLD_LAST_VISITED_STORE: customerNumber ? '417' : '',
    HAS_NEGATIVE_QTY_OR_LOYALTY_SALES: hasNegative ? 'true' : 'false',
    Has_Anomaly_Or_Not: hasNegative ? '1A' : '0',
    Anomaly_Flags: hasNegative ? 'NEGATIVE_QTY_OR_LOYALTY_SALES' : 'NONE',
  };
}

function createMmsRecord(index: number, seed: GoldRowSeed): Record<string, string> {
  const stageA = createStageARecord(index, seed);
  return {
    DATE: stageA.DATE,
    'TRANSACTION NUMBER': stageA.TRANSACTION_NUMBER,
    'REGISTER NUMBER': stageA.REGISTER_NUMBER,
    'STORE CODE': stageA.STORE_CODE,
    'SKU CODE': stageA.SKU_CODE,
    'TRANSACTION TYPE': 'REGULAR SALE',
    'MMS SALES': Number(seed.mmsSales).toFixed(6),
    'QTY SOLD': Number(seed.mmsSales) < 0 ? '-1.000000' : stageA.QTY_SOLD,
    MARGIN: (Number(seed.mmsSales) * 0.12).toFixed(6),
    'STORE CATEGORIZATION': 'SMR Small',
  };
}

export const GOLD_STAGE_B_DEMO_ROWS: GoldStageBRow[] = ROW_SEEDS.map((seed, index) => {
  const stageA = createStageARecord(index, seed);
  const mms = createMmsRecord(index, seed);
  const datasetOnlyAnomaly = seed.anomaly || 'NONE';
  return {
    id: `gold-stage-b-${String(index + 1).padStart(3, '0')}`,
    stageA,
    mms,
    datasetOnlyAnomaly,
    matchStatus: seed.status,
    matchQuality: seed.quality,
    baseCaseMatching: seed.status.startsWith('JOINED') ? '6-Key Match' : 'Basket/Candidate Check',
    finalMatching: seed.status === 'JOINED - Exact/Near Match' ? 'Matched' : 'Validated for Gold',
    detail: seed.detail,
    hasAnomalyOrNot: datasetOnlyAnomaly === 'NONE' ? '0' : '1',
    loyaltyCustomerInfoSource: stageA.CLD_SOURCE,
    stageCReadiness: 'READY',
    silverIssueStatus: 'Reviewed',
    silverResolution: 'Not required — clean in Silver',
    silverAuditNote: datasetOnlyAnomaly === 'NONE'
      ? 'Stage B validation passed; no human resolution required.'
      : 'Dataset anomaly lineage retained after upstream validation.',
    resolvedBy: 'Stage B validation',
    resolvedAt: '2026-07-21T09:00:00.000Z',
    recordOrigin: 'Clean from Silver',
    goldRecordStatus: 'CLEAN',
    goldBatchId: 'GOLD-STAGE-B-20260721-001',
    goldLoadedAt: '2026-07-21T09:30:00.000Z',
  };
});

export interface GoldStageBExportColumn {
  group: string;
  header: string;
  description: string;
  value: (row: GoldStageBRow) => string;
}

export const GOLD_STAGE_B_EXPORT_COLUMNS: GoldStageBExportColumn[] = [
  ...STAGE_A_COLUMNS.map(column => ({
    group: 'Stage A — Customer and Loyalty',
    header: `Stage A · ${column}`,
    description: `Retained Stage A source field: ${column}.`,
    value: (row: GoldStageBRow) => row.stageA[column] || '',
  })),
  ...MMS_COLUMNS.map(column => ({
    group: 'MMS',
    header: `MMS · ${column}`,
    description: `Retained MMS source field: ${column}.`,
    value: (row: GoldStageBRow) => row.mms[column] || '',
  })),
  { group: 'Reconciliation', header: 'DATASET_ONLY_ANOMALY', description: 'Pipe-delimited upstream dataset anomaly lineage.', value: row => row.datasetOnlyAnomaly },
  { group: 'Reconciliation', header: 'MATCH_STATUS', description: 'Final Stage B reconciliation group.', value: row => row.matchStatus },
  { group: 'Reconciliation', header: 'MATCH_QUALITY', description: 'Pipeline match-quality classification.', value: row => row.matchQuality },
  { group: 'Reconciliation', header: 'BASE_CASE_MATCHING', description: 'Base pipeline matching classification.', value: row => row.baseCaseMatching },
  { group: 'Reconciliation', header: 'FINAL_MATCHING', description: 'Final pipeline matching classification.', value: row => row.finalMatching },
  { group: 'Reconciliation', header: 'detail', description: 'Stage B reconciliation detail.', value: row => row.detail },
  { group: 'Reconciliation', header: 'has_anomaly_or_not', description: 'Retained anomaly indicator.', value: row => row.hasAnomalyOrNot },
  { group: 'Reconciliation', header: 'loyalty_customer_info_source', description: 'Lineage for joined Loyalty and Customer information.', value: row => row.loyaltyCustomerInfoSource },
  { group: 'Reconciliation', header: 'STAGE_C_READINESS', description: 'Stage B readiness value retained for lineage.', value: row => row.stageCReadiness },
  { group: 'Silver resolution audit', header: 'Silver Issue Status', description: 'Final human-review status from Silver.', value: row => row.silverIssueStatus },
  { group: 'Silver resolution audit', header: 'Silver Resolution', description: 'Silver resolution outcome or clean-row disposition.', value: row => row.silverResolution },
  { group: 'Silver resolution audit', header: 'Silver Audit Note', description: 'Audit note retained from Silver.', value: row => row.silverAuditNote },
  { group: 'Silver resolution audit', header: 'Resolved By', description: 'Silver reviewer or validation source.', value: row => row.resolvedBy },
  { group: 'Silver resolution audit', header: 'Resolved At', description: 'Silver resolution timestamp.', value: row => row.resolvedAt },
  { group: 'Gold publication audit', header: 'Record Origin', description: 'Whether the Gold row was clean or accepted in Silver.', value: row => row.recordOrigin },
  { group: 'Gold publication audit', header: 'Gold Record Status', description: 'Read-only Gold eligibility status.', value: row => row.goldRecordStatus },
  { group: 'Gold publication audit', header: 'Gold Batch ID', description: 'Demo Gold publication batch identifier.', value: row => row.goldBatchId },
  { group: 'Gold publication audit', header: 'Gold Loaded At', description: 'Demo Gold publication timestamp.', value: row => row.goldLoadedAt },
];
