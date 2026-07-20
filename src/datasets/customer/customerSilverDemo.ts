import { supabase } from '../../auth/authService';
import { CustomerSilverStats } from './customerService';

// Aggregate results reproduced from the completed Customer anomaly notebook.
export const CUSTOMER_SILVER_DEMO_STATS: CustomerSilverStats = {
  total_rows: 1_039_001,
  clean_rows: 736_557,
  flagged_rows: 302_444,
  class_0_rows: 736_557,
  class_1a_rows: 223_901,
  class_1b_rows: 78_543,
  latest_run: null,
};

const EMPTY_MARKERS = new Set(['', '-', 'NAN', '<NA>']);

function cleaned(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return EMPTY_MARKERS.has(text.toUpperCase()) ? null : text;
}

function parseDate(value: unknown): string | null {
  const text = cleaned(value);
  if (!text) return null;
  let year: number;
  let month: number;
  let day: number;
  if (/^\d{8}$/.test(text)) {
    year = Number(text.slice(0, 4)); month = Number(text.slice(4, 6)); day = Number(text.slice(6, 8));
  } else if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    [year, month, day] = text.slice(0, 10).split('-').map(Number);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [first, second, final] = text.split('/').map(Number);
    year = final; month = first; day = second;
    if (month > 12) [month, day] = [day, month];
  } else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseInteger(value: unknown): number | null {
  const text = cleaned(value);
  if (!text || !/^-?\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

function classifyRows(sourceRows: any[]) {
  const keyCounts = new Map<string, number>();
  sourceRows.forEach(row => {
    const customer = cleaned(row['CUSTOMER NUMBER'])?.toUpperCase() || '';
    const key = `${row.source_batch_id}:${customer}`;
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  });

  return sourceRows.map(row => {
    const customerNumber = cleaned(row['CUSTOMER NUMBER'])?.toUpperCase() || '-';
    const birthday = parseDate(row.BIRTHDAY);
    const age = parseInteger(row.AGE);
    const province = cleaned(row.PROVINCE);
    const issues: string[] = [];
    const key = `${row.source_batch_id}:${customerNumber === '-' ? '' : customerNumber}`;
    const rawBirthday = cleaned(row.BIRTHDAY);
    const rawAge = cleaned(row.AGE);

    if (customerNumber === '-') issues.push('missing_customer_number');
    else if ((keyCounts.get(key) || 0) > 1) issues.push('duplicate_customer_number');
    if (!province) issues.push('without_province');
    if (rawBirthday && !birthday) issues.push('birthday_invalid');
    if (birthday) {
      const birthYear = Number(birthday.slice(0, 4));
      const currentYear = new Date().getFullYear();
      if (birthYear > currentYear) issues.push('birthday_in_future');
      if (currentYear - birthYear > 120) issues.push('birthday_age_over_120');
      if (age !== null && Math.abs(currentYear - birthYear - age) > 2) issues.push('birthday_age_mismatch');
    }
    if (rawAge && age === null) issues.push('age_invalid');

    const serious = issues.some(issue => issue !== 'without_province');
    const anomalyClass = serious ? '1B' : issues.includes('without_province') ? '1A' : '0';
    return {
      ...row,
      id: `demo-${row.id}`,
      'CUSTOMER NUMBER': customerNumber,
      GENDER: cleaned(row.GENDER)?.toUpperCase(),
      BIRTHDAY: birthday,
      AGE: age,
      CITY: cleaned(row.CITY),
      PROVINCE: province,
      'LAST VISIT': parseDate(row['LAST VISIT']),
      anomaly_class: anomalyClass,
      validation_status: anomalyClass === '0' ? 'clean' : 'flagged',
      quality_issues: issues,
    };
  });
}

export async function loadCustomerSilverDemoRows(): Promise<any[]> {
  const batches = await supabase
    .from('customer_batches')
    .select('id')
    .eq('status', 'ingested')
    .order('created_at', { ascending: true })
    .limit(2);
  if (batches.error) throw new Error(`Could not load demo batches: ${batches.error.message}`);

  const batchRows = await Promise.all((batches.data || []).map(batch =>
    supabase
      .from('bronze_customer_database')
      .select('*')
      .eq('source_batch_id', batch.id)
      .order('id', { ascending: true })
      .limit(50)
  ));
  const failed = batchRows.find(result => result.error);
  if (failed?.error) throw new Error(`Could not load real demo rows: ${failed.error.message}`);
  return classifyRows(batchRows.flatMap(result => result.data || []));
}
