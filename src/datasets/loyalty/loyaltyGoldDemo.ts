import {
  LOYALTY_ESTIMATED_CLEAN,
  LOYALTY_ROW_RULE_HITS,
  loadLoyaltyDemoRows,
  LoyaltySilverRow,
} from './loyaltySilverDemo';

export interface LoyaltyGoldRow {
  id: string;
  date: string;
  transaction_number: string;
  register_number: string;
  store_code: string;
  store_categorization: string;
  customer_number: string;
  sku_code: string;
  transaction_type: string;
  loyalty_sales: number;
  qty_sold: number;
  record_origin: 'clean' | 'resolved';
  resolution: string;
}

function transactionKey(row: LoyaltySilverRow): string {
  return [row.DATE, row['TRANSACTION NUMBER'], row['REGISTER NUMBER'], row['STORE CODE'], row['SKU CODE'], row['TRANSACTION TYPE']].join('|');
}

export function getLoyaltyGoldDemoRows(): LoyaltyGoldRow[] {
  const eligible = loadLoyaltyDemoRows().filter(row =>
    row.validation_status === 'clean'
    || (row.validation_status === 'resolved' && row.resolution_type !== 'exclude'));
  const winners = new Map<string, LoyaltySilverRow>();
  eligible.forEach(row => {
    const key = transactionKey(row);
    const current = winners.get(key);
    if (!current || (row.validation_status === 'resolved' && current.validation_status !== 'resolved')) {
      winners.set(key, row);
    }
  });
  return [...winners.values()].map(row => ({
    id: `gold-${row.id}`,
    date: row.DATE,
    transaction_number: row['TRANSACTION NUMBER'],
    register_number: row['REGISTER NUMBER'],
    store_code: row['STORE CODE'],
    store_categorization: row['STORE CATEGORIZATION'],
    customer_number: row['CUSTOMER NUMBER'],
    sku_code: row['SKU CODE'],
    transaction_type: row['TRANSACTION TYPE'],
    loyalty_sales: row['LOYALTY SALES'],
    qty_sold: row['QTY SOLD'],
    record_origin: row.validation_status === 'resolved' ? 'resolved' : 'clean',
    resolution: row.resolution_note || 'No correction required',
  }));
}

export function getLoyaltyGoldDemoStats() {
  const resolved = loadLoyaltyDemoRows().filter(row => row.validation_status === 'resolved' && row.resolution_type !== 'exclude').length;
  const excluded = loadLoyaltyDemoRows().filter(row => row.validation_status === 'resolved' && row.resolution_type === 'exclude').length;
  return {
    trusted: LOYALTY_ESTIMATED_CLEAN + resolved,
    clean: LOYALTY_ESTIMATED_CLEAN,
    resolved,
    blocked: Math.max(0, LOYALTY_ROW_RULE_HITS - resolved - excluded),
  };
}

export const LOYALTY_GOLD_SCHEMA = [
  ['DATE', 'Validated transaction date'],
  ['TRANSACTION NUMBER', 'Trusted source transaction identifier'],
  ['REGISTER NUMBER', 'Register that recorded the transaction'],
  ['STORE CODE', 'Trusted store identifier'],
  ['STORE CATEGORIZATION', 'Store segment retained from Silver'],
  ['CUSTOMER NUMBER', 'Masked Loyalty customer identifier'],
  ['SKU CODE', 'Trusted product identifier'],
  ['TRANSACTION TYPE', 'Validated sale, return, or adjustment type'],
  ['LOYALTY SALES', 'Accepted Loyalty sales amount'],
  ['QTY SOLD', 'Accepted quantity sold'],
  ['RECORD ORIGIN', 'Clean or manually resolved Silver record'],
];
