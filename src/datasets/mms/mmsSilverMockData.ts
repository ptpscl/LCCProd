export type MmsAnomalyId =
  | 'MMS_NEGATIVE_QTY_OR_SALES'
  | 'MMS_NEGATIVE_SALES_IN_SALE_TRANSACTION_TYPE'
  | 'MMS_MISSING_CRITICAL_KEY'
  | 'MULTIPLE_MMS_6KEY_ROWS';

export type ReviewStatus = 'for-review' | 'reviewed';
export type ResolutionChoice = 'accept' | 'exclude';

export interface MmsAnomalyRow {
  id: string;
  sourceRow: number;
  date: string;
  transactionNumber: string;
  registerNumber: string;
  storeCode: string;
  skuCode: string;
  transactionType: string;
  mmsSales: string;
  quantitySold: string;
  margin: string;
  storeCategorization: string;
  anomalyTypes: MmsAnomalyId[];
  status: ReviewStatus;
  resolution?: ResolutionChoice;
  auditNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface MmsAnomalyRule {
  id: MmsAnomalyId;
  affectedRows: number;
  definition: string;
}

export const MMS_ROWS_CHECKED = 133_166;
export const MMS_AUTOMATICALLY_CLEAN = 133_129;

export const MMS_ANOMALY_RULES: MmsAnomalyRule[] = [
  {
    id: 'MMS_NEGATIVE_QTY_OR_SALES',
    affectedRows: 32,
    definition: 'MMS has negative quantity or negative sales. This may be valid for returns, but should be reviewed if not expected.',
  },
  {
    id: 'MMS_NEGATIVE_SALES_IN_SALE_TRANSACTION_TYPE',
    affectedRows: 16,
    definition: 'MMS sales is negative even though the transaction type looks like a sale.',
  },
  {
    id: 'MMS_MISSING_CRITICAL_KEY',
    affectedRows: 5,
    definition: 'MMS row is missing a key required for matching, such as date, transaction number, register, store, SKU, or transaction type.',
  },
  {
    id: 'MULTIPLE_MMS_6KEY_ROWS',
    affectedRows: 0,
    definition: 'More than one MMS row has the same six-key combination.',
  },
];

type SourceRow = [
  sourceRow: number,
  date: string,
  transactionNumber: string,
  registerNumber: string,
  storeCode: string,
  skuCode: string,
  transactionType: string,
  mmsSales: string,
  quantitySold: string,
  margin: string,
  storeCategorization: string,
];

// These are the 37 unique source rows flagged by the MMS-only rules in 417.csv.
const SOURCE_ROWS: SourceRow[] = [
  [9098, '240104', '9109', '13', '417', '4455845', 'REGULAR RETURN', '-217.2435105', '-1.236093943', '-38.00988875', 'SMR Small'],
  [9100, '240104', '9109', '13', '417', '4455755', 'REGULAR RETURN', '-214.1532756', '-1.854140915', '-38.00988875', 'SMR Small'],
  [12094, '240104', '9109', '13', '417', '4455845', 'REGULAR SALE', '-217.2435105', '-1.236093943', '-38.00988875', 'SMR Small'],
  [12133, '240104', '9109', '13', '417', '4455755', 'REGULAR SALE', '-214.1532756', '-1.854140915', '-38.00988875', 'SMR Small'],
  [20463, '240106', '9528', '13', '417', '3773016', 'REGULAR SALE', '-207.8182942', '-0.618046972', '-22.01279357', 'SMR Small'],
  [21755, '240106', '2142', '16', '417', '3527641', 'REGULAR SALE', '-31.52039555', '-0.618046972', '-3.152039555', 'SMR Small'],
  [22875, '240106', '2142', '16', '417', '3527641', 'REGULAR RETURN', '-31.52039555', '-0.618046972', '-3.152039555', 'SMR Small'],
  [22877, '240106', '9528', '13', '417', '3773016', 'REGULAR RETURN', '-207.8182942', '-0.618046972', '-22.01279357', 'SMR Small'],
  [33171, '240109', '3119', '16', '417', '3699183', 'REGULAR RETURN', '-470.9517923', '-0.618046972', '-26.40037083', 'SMR Small'],
  [33609, '240109', '3119', '16', '417', '3699183', 'REGULAR SALE', '-470.9517923', '-0.618046972', '-26.40037083', 'SMR Small'],
  [45836, '240112', '2427', '12', '417', '3489170', 'REGULAR RETURN', '-27.19406675', '-4.944375773', '-3.693448702', 'SMR Small'],
  [45838, '240112', '2535', '12', '417', '3738769', '', '42.18170581', '0.618046972', '4.412855377', 'SMR Small'],
  [45839, '240112', '2535', '12', '417', '3757283', '', '32.75648949', '1.236093943', '3.275648949', 'SMR Small'],
  [45840, '240112', '2535', '12', '417', '4110549', '', '45.7354759', '1.236093943', '6.700370828', 'SMR Small'],
  [45841, '240112', '2535', '12', '417', '4305203', '', '27.81211372', '3.708281829', '4.264524104', 'SMR Small'],
  [45842, '240112', '2535', '12', '417', '3101793', '', '47.74412855', '1.854140915', '2.827564895', 'SMR Small'],
  [46579, '240112', '2427', '12', '417', '3489170', 'REGULAR SALE', '-27.19406675', '-4.944375773', '-3.693448702', 'SMR Small'],
  [50327, '240113', '3146', '14', '417', '3050720', 'REGULAR RETURN', '-1343.479604', '-22.86773795', '-269.6517923', 'SMR Small'],
  [52950, '240113', '3146', '14', '417', '3050720', 'REGULAR SALE', '-1343.479604', '-22.86773795', '-269.6517923', 'SMR Small'],
  [65201, '240116', '3790', '14', '417', '4333232', 'REGULAR RETURN', '-126.0815822', '-2.472187886', '-6.352533993', 'SMR Small'],
  [65202, '240116', '1491', '13', '417', '3055597', 'REGULAR RETURN', '-129.1718171', '-0.618046972', '-17.71347342', 'SMR Small'],
  [65959, '240116', '3790', '14', '417', '4333232', 'REGULAR SALE', '-126.0815822', '-2.472187886', '-6.352533993', 'SMR Small'],
  [67597, '240116', '1491', '13', '417', '3055597', 'REGULAR SALE', '-129.1718171', '-0.618046972', '-17.71347342', 'SMR Small'],
  [74563, '240118', '4211', '14', '417', '3909861', 'REGULAR SALE', '-173.9802225', '-0.618046972', '-10.18955501', 'SMR Small'],
  [77259, '240118', '4211', '14', '417', '3909861', 'REGULAR RETURN', '-173.9802225', '-0.618046972', '-10.18955501', 'SMR Small'],
  [86862, '240121', '5903', '16', '417', '3428800', 'REGULAR RETURN', '-21.78615575', '-0.618046972', '-3.776514215', 'SMR Small'],
  [86863, '240121', '6003', '16', '417', '3669694', 'REGULAR RETURN', '-34.30160692', '-0.618046972', '-8.572311496', 'SMR Small'],
  [89495, '240121', '6003', '16', '417', '3669694', 'REGULAR SALE', '-34.30160692', '-0.618046972', '-8.572311496', 'SMR Small'],
  [91014, '240121', '5903', '16', '417', '3428800', 'REGULAR SALE', '-21.78615575', '-0.618046972', '-3.776514215', 'SMR Small'],
  [91603, '240122', '6114', '16', '417', '3009131', 'REGULAR RETURN', '-44.19035847', '-0.618046972', '-4.173362176', 'SMR Small'],
  [92391, '240122', '6114', '16', '417', '3009131', 'REGULAR SALE', '-44.19035847', '-0.618046972', '-4.173362176', 'SMR Small'],
  [106564, '240126', '5678', '14', '417', '3134350', 'REGULAR RETURN', '-39.40049444', '-0.618046972', '-3.965142151', 'SMR Small'],
  [110907, '240126', '5678', '14', '417', '3134350', 'REGULAR SALE', '-39.40049444', '-0.618046972', '-3.965142151', 'SMR Small'],
  [121256, '240129', '6138', '14', '417', '4127561', 'REGULAR SALE', '-173.671199', '-0.618046972', '-8.856613103', 'SMR Small'],
  [124785, '240129', '6138', '14', '417', '4127561', 'REGULAR RETURN', '-173.671199', '-0.618046972', '-8.856613103', 'SMR Small'],
  [125211, '240130', '4673', '13', '417', '4419488', 'REGULAR SALE', '-300.9888752', '-1.236093943', '-12.18788628', 'SMR Small'],
  [128868, '240130', '4673', '13', '417', '4419488', 'REGULAR RETURN', '-300.9888752', '-1.236093943', '-12.18788628', 'SMR Small'],
];

export function createMmsAnomalyRows(): MmsAnomalyRow[] {
  return SOURCE_ROWS.map(([
    sourceRow,
    date,
    transactionNumber,
    registerNumber,
    storeCode,
    skuCode,
    transactionType,
    mmsSales,
    quantitySold,
    margin,
    storeCategorization,
  ]) => {
    const anomalyTypes: MmsAnomalyId[] = transactionType
      ? ['MMS_NEGATIVE_QTY_OR_SALES']
      : ['MMS_MISSING_CRITICAL_KEY'];

    if (transactionType.includes('SALE') && Number(mmsSales) < 0) {
      anomalyTypes.push('MMS_NEGATIVE_SALES_IN_SALE_TRANSACTION_TYPE');
    }

    return {
      id: `mms-${sourceRow}`,
      sourceRow,
      date,
      transactionNumber,
      registerNumber,
      storeCode,
      skuCode,
      transactionType,
      mmsSales,
      quantitySold,
      margin,
      storeCategorization,
      anomalyTypes,
      status: 'for-review',
    };
  });
}
