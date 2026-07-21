export type LoyaltyIssue =
  | 'DUPLICATES'
  | 'NEGATIVE_QTY'
  | 'NEGATIVE_LOYALTY_SALES';

export interface LoyaltySilverRow {
  id: string;
  DATE: string;
  'TRANSACTION NUMBER': string;
  'REGISTER NUMBER': string;
  'STORE CODE': string;
  'STORE CATEGORIZATION': string;
  'CUSTOMER NUMBER': string;
  'SKU CODE': string;
  'TRANSACTION TYPE': string;
  'LOYALTY SALES': number;
  'QTY SOLD': number;
  validation_status: 'clean' | 'flagged' | 'resolved';
  quality_issues: LoyaltyIssue[];
  original_quality_issues?: LoyaltyIssue[];
  resolution_type?: 'accept' | 'exclude';
  resolution_note?: string;
  resolved_by?: string;
  resolved_at?: string;
}

export const LOYALTY_ROWS_CHECKED = 28_181_998;
export const LOYALTY_ROW_RULE_HITS = 59_520;
export const LOYALTY_ESTIMATED_CLEAN = 28_122_478;

export const LOYALTY_ANOMALY_RULES = [
  { id: 'DUPLICATES' as LoyaltyIssue, severity: 'High', affected: 58_195, percentage: '0.2065%', unit: 'rows', definition: 'Same date, transaction number, register, store, SKU, and transaction type.' },
  { id: 'NEGATIVE_QTY' as LoyaltyIssue, severity: 'High', affected: 663, percentage: '0.0024%', unit: 'rows', definition: 'Quantity sold is below zero.' },
  { id: 'NEGATIVE_LOYALTY_SALES' as LoyaltyIssue, severity: 'High', affected: 662, percentage: '0.0023%', unit: 'rows', definition: 'Loyalty sales amount is below zero.' },
] as const;

export const LOYALTY_SILVER_DEMO_ROWS: LoyaltySilverRow[] = [
  { id: 'loy-1', DATE: '2025-01-04', 'TRANSACTION NUMBER': '9109', 'REGISTER NUMBER': '13', 'STORE CODE': '417', 'STORE CATEGORIZATION': 'SMR Small', 'CUSTOMER NUMBER': '5098***-RPC', 'SKU CODE': '4455845', 'TRANSACTION TYPE': 'REGULAR RETURN', 'LOYALTY SALES': -217.24, 'QTY SOLD': -1, validation_status: 'flagged', quality_issues: ['DUPLICATES', 'NEGATIVE_QTY', 'NEGATIVE_LOYALTY_SALES'] },
  { id: 'loy-2', DATE: '2025-01-04', 'TRANSACTION NUMBER': '9109', 'REGISTER NUMBER': '13', 'STORE CODE': '417', 'STORE CATEGORIZATION': 'SMR Small', 'CUSTOMER NUMBER': '6112***-RPC', 'SKU CODE': '4455845', 'TRANSACTION TYPE': 'REGULAR RETURN', 'LOYALTY SALES': -217.24, 'QTY SOLD': -1, validation_status: 'flagged', quality_issues: ['DUPLICATES', 'NEGATIVE_QTY', 'NEGATIVE_LOYALTY_SALES'] },
  { id: 'loy-3', DATE: '2025-01-06', 'TRANSACTION NUMBER': '9528', 'REGISTER NUMBER': '13', 'STORE CODE': '417', 'STORE CATEGORIZATION': 'SMR Small', 'CUSTOMER NUMBER': '7341***-RPC', 'SKU CODE': '3773016', 'TRANSACTION TYPE': 'REGULAR SALE', 'LOYALTY SALES': -207.82, 'QTY SOLD': 1, validation_status: 'flagged', quality_issues: ['NEGATIVE_LOYALTY_SALES'] },
  { id: 'loy-4', DATE: '2025-02-12', 'TRANSACTION NUMBER': '2427', 'REGISTER NUMBER': '12', 'STORE CODE': '417', 'STORE CATEGORIZATION': 'SMR Small', 'CUSTOMER NUMBER': '8274***-RPC', 'SKU CODE': '3489170', 'TRANSACTION TYPE': 'REGULAR RETURN', 'LOYALTY SALES': 27.19, 'QTY SOLD': -4, validation_status: 'flagged', quality_issues: ['NEGATIVE_QTY'] },
  { id: 'loy-5', DATE: '2025-03-13', 'TRANSACTION NUMBER': '3146', 'REGISTER NUMBER': '14', 'STORE CODE': '417', 'STORE CATEGORIZATION': 'SMR Small', 'CUSTOMER NUMBER': '9135***-RPC', 'SKU CODE': '3050720', 'TRANSACTION TYPE': 'REGULAR SALE', 'LOYALTY SALES': 1343.48, 'QTY SOLD': 22, validation_status: 'clean', quality_issues: [] },
  { id: 'loy-6', DATE: '2025-03-15', 'TRANSACTION NUMBER': '3201', 'REGISTER NUMBER': '14', 'STORE CODE': '417', 'STORE CATEGORIZATION': 'SMR Small', 'CUSTOMER NUMBER': '4219***-RPC', 'SKU CODE': '4333232', 'TRANSACTION TYPE': 'REGULAR SALE', 'LOYALTY SALES': 126.08, 'QTY SOLD': 2, validation_status: 'clean', quality_issues: [] },
  { id: 'loy-7', DATE: '2025-04-18', 'TRANSACTION NUMBER': '4211', 'REGISTER NUMBER': '14', 'STORE CODE': '417', 'STORE CATEGORIZATION': 'SMR Small', 'CUSTOMER NUMBER': '5810***-RPC', 'SKU CODE': '3909861', 'TRANSACTION TYPE': 'REGULAR RETURN', 'LOYALTY SALES': -173.98, 'QTY SOLD': -1, validation_status: 'flagged', quality_issues: ['NEGATIVE_QTY', 'NEGATIVE_LOYALTY_SALES'] },
  { id: 'loy-8', DATE: '2025-05-21', 'TRANSACTION NUMBER': '6003', 'REGISTER NUMBER': '16', 'STORE CODE': '417', 'STORE CATEGORIZATION': 'SMR Small', 'CUSTOMER NUMBER': '6634***-RPC', 'SKU CODE': '3669694', 'TRANSACTION TYPE': 'REGULAR SALE', 'LOYALTY SALES': 34.30, 'QTY SOLD': 1, validation_status: 'clean', quality_issues: [] },
];

const STORAGE_KEY = 'lcc-loyalty-silver-demo-resolutions-v2';

export function loadLoyaltyDemoRows(): LoyaltySilverRow[] {
  try {
    const saved: LoyaltySilverRow[] = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    const byId = new Map(saved.map(row => [row.id, row]));
    return LOYALTY_SILVER_DEMO_ROWS.map(row => byId.get(row.id) || { ...row, quality_issues: [...row.quality_issues] });
  } catch {
    return LOYALTY_SILVER_DEMO_ROWS;
  }
}

export function saveLoyaltyDemoRows(rows: LoyaltySilverRow[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.filter(row => row.validation_status === 'resolved')));
}
