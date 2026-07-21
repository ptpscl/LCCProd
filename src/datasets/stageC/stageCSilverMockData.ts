// ============================================================
// STAGE C DEMO MOCK DATA
// Matches dummy Loyalty/MMS transactions against the SKU
// hierarchy (DEMO_SILVER / DEMO_EXCLUDED from skuDemoData.ts)
// and classifies each with a relational flag:
//   SKU_SALES_MATCHED       — SKU exists in silver hierarchy
//   SKU_SALES_UNMATCHED     — SKU code not found anywhere
//   DROPPED_SKU_TRANSACTION — SKU exists but was excluded in
//                             cleaning (purged/bucket/null desc)
// Mirrors the shape/conventions of stageBSilverMockData.ts.
// Remove once real transaction-matching (from your teammates'
// Loyalty/MMS pipelines) replaces this.
// ============================================================

// NOTE: adjust this import path if your SKU demo data file
// lives somewhere other than ../sku/skuDemoData
import { DEMO_SILVER, DEMO_EXCLUDED } from '../sku/skuDemoData';

export type RelationalFlag =
  | 'SKU_SALES_MATCHED'
  | 'SKU_SALES_UNMATCHED'
  | 'DROPPED_SKU_TRANSACTION';

export type IssueStatus = 'For review' | 'Reviewed';
export type ResolutionChoice = 'Accept as Valid' | 'Exclude from Output' | 'Alert Data Manager';

export interface StageCRow {
  id: string;
  transaction: Record<string, string>;
  matchedSku: Record<string, string> | null;
  relationalFlag: RelationalFlag;
  detail: string;
  issueStatus: IssueStatus;
  resolution?: ResolutionChoice;
  auditNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  requiresStageCReview: boolean;
}

export const TRANSACTION_COLUMNS = [
  'DATE',
  'TRANSACTION_NUMBER',
  'REGISTER_NUMBER',
  'STORE_CODE',
  'SKU_CODE',
  'TRANSACTION_TYPE',
  'QTY_SOLD',
  'SALES_AMOUNT',
] as const;

export const SKU_MATCH_COLUMNS = [
  'SKU_CODE',
  'SKU_DESCRIPTION',
  'DIVISION',
  'DEPARTMENT',
  'CATEGORY',
  'CLASS',
  'BRAND',
] as const;

export interface RelationalFlagSummaryItem {
  flag: RelationalFlag;
  affectedRows: number;
  definition: string;
}

export const RELATIONAL_FLAG_SUMMARY: RelationalFlagSummaryItem[] = [
  {
    flag: 'SKU_SALES_MATCHED',
    affectedRows: 0, // computed at runtime from createStageCRows()
    definition: 'Transaction is successfully matched to an SKU in the hierarchy.',
  },
  {
    flag: 'SKU_SALES_UNMATCHED',
    affectedRows: 0,
    definition: 'Transaction references an SKU code that does not exist in the hierarchy — no division/category/brand attribution possible.',
  },
  {
    flag: 'DROPPED_SKU_TRANSACTION',
    affectedRows: 0,
    definition: 'Transaction matches an SKU that was excluded in cleaning (purged, bucket, null description) — sales exist but the SKU has no usable hierarchy.',
  },
];

const STORES = ['417', '721', '512'];

function baseTransaction(index: number, skuCode: string, transactionType = 'REGULAR SALE'): Record<string, string> {
  const day = String((index % 28) + 1).padStart(2, '0');
  return {
    DATE: `2607${day}`,
    TRANSACTION_NUMBER: String(8100 + index),
    REGISTER_NUMBER: String(10 + (index % 7)),
    STORE_CODE: STORES[index % STORES.length],
    SKU_CODE: skuCode,
    TRANSACTION_TYPE: transactionType,
    QTY_SOLD: String(1 + (index % 4)),
    SALES_AMOUNT: (18.5 + index * 6.35).toFixed(2),
  };
}

function skuToMatchRecord(sku: (typeof DEMO_SILVER)[number]): Record<string, string> {
  return {
    SKU_CODE: sku.sku_code,
    SKU_DESCRIPTION: sku.description,
    DIVISION: sku.division,
    DEPARTMENT: sku.department,
    CATEGORY: sku.category,
    CLASS: sku.cls,
    BRAND: sku.brand,
  };
}

function matchedRow(index: number): StageCRow {
  const sku = DEMO_SILVER[index % DEMO_SILVER.length];
  return {
    id: `stage-c-matched-${String(index).padStart(2, '0')}`,
    transaction: baseTransaction(index, sku.sku_code),
    matchedSku: skuToMatchRecord(sku),
    relationalFlag: 'SKU_SALES_MATCHED',
    detail: 'SKU code found in silver_sku_hierarchy; full attribution available.',
    issueStatus: 'Reviewed',
    resolution: 'Accept as Valid',
    auditNote: 'Clean match — no relational issue.',
    resolvedBy: 'Upstream validation',
    resolvedAt: '2026-07-20T09:30:00.000Z',
    requiresStageCReview: false,
  };
}

function unmatchedRow(index: number): StageCRow {
  const fakeCode = String(7_700_000 + index * 911);
  return {
    id: `stage-c-unmatched-${String(index).padStart(2, '0')}`,
    transaction: baseTransaction(index, fakeCode),
    matchedSku: null,
    relationalFlag: 'SKU_SALES_UNMATCHED',
    detail: 'SKU code does not exist anywhere in the SKU hierarchy (bronze or silver). No division/category/brand attribution possible.',
    issueStatus: 'For review',
    requiresStageCReview: true,
  };
}

function droppedRow(index: number): StageCRow {
  const excluded = DEMO_EXCLUDED[index % DEMO_EXCLUDED.length];
  return {
    id: `stage-c-dropped-${String(index).padStart(2, '0')}`,
    transaction: baseTransaction(index, excluded.sku_code),
    matchedSku: {
      SKU_CODE: excluded.sku_code,
      SKU_DESCRIPTION: excluded.description,
      DIVISION: excluded.division,
      DEPARTMENT: '',
      CATEGORY: '',
      CLASS: '',
      BRAND: '',
    },
    relationalFlag: 'DROPPED_SKU_TRANSACTION',
    detail: `SKU was excluded during cleaning (${excluded.anomaly_tag}: ${excluded.anomaly_remarks}). Sales exist but the SKU has no usable hierarchy.`,
    issueStatus: 'For review',
    requiresStageCReview: true,
  };
}

export function createStageCRows(): StageCRow[] {
  return [
    ...Array.from({ length: 15 }, (_, i) => matchedRow(i + 1)),
    ...Array.from({ length: 8 }, (_, i) => unmatchedRow(i + 1)),
    ...Array.from({ length: 7 }, (_, i) => droppedRow(i + 1)),
  ];
}

export function calculateStageCScorecards(rows: StageCRow[]) {
  const matched = rows.filter(r => r.relationalFlag === 'SKU_SALES_MATCHED').length;
  const unmatched = rows.filter(r => r.relationalFlag === 'SKU_SALES_UNMATCHED');
  const dropped = rows.filter(r => r.relationalFlag === 'DROPPED_SKU_TRANSACTION');
  const forReview = [...unmatched, ...dropped].filter(r => r.issueStatus === 'For review').length;
  const resolved = [...unmatched, ...dropped].filter(r => r.issueStatus === 'Reviewed').length;
  return {
    totalChecked: rows.length,
    matched,
    unmatchedCount: unmatched.length,
    droppedCount: dropped.length,
    forReview,
    resolved,
  };
}

export function applyStageCResolution(
  rows: StageCRow[],
  ids: string[],
  resolution: ResolutionChoice,
  note: string,
  resolvedAt = new Date().toISOString(),
  resolvedBy = 'Michelle',
): StageCRow[] {
  if (!note.trim()) return rows;
  const selected = new Set(ids);
  return rows.map(row => (selected.has(row.id) && row.requiresStageCReview && row.issueStatus === 'For review'
    ? {
        ...row,
        issueStatus: 'Reviewed' as IssueStatus,
        resolution,
        auditNote: note.trim(),
        resolvedBy,
        resolvedAt,
      }
    : row));
}
