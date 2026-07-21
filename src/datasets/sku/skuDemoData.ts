// ============================================================
// DEMO DATA — dummy anomaly-tagged SKUs for the stakeholder demo.
// Mirrors the real NB3 output shape. Remove once the live
// pipeline (Phase 2) populates silver_sku_hierarchy.
// ============================================================

export interface DemoSku {
  sku_code: string;
  description: string;
  division: string;
  department: string;
  category: string;
  cls: string;
  brand: string;
  units: string;
  is_promo: boolean;
  dup_family_id: string;
  variant_family_id: string;
  variant_type: string;
  promo_family_id: string;
  promo_role: string; // REGULAR_ANCHOR | PROMO_SKU | ''
  has_regular_anchor: string; // Y | N | ''
  anomaly_tags: string;
}

export interface DemoExcluded {
  sku_code: string;
  description: string;
  division: string;
  anomaly_tag: string;
  anomaly_remarks: string;
}

const S = (
  sku_code: string, description: string, division: string, department: string,
  category: string, cls: string, brand: string, units: string, is_promo: boolean,
  dup: string, vfam: string, vtype: string, pfam: string, prole: string, anchor: string,
  tags: string
): DemoSku => ({
  sku_code, description, division, department, category, cls, brand, units, is_promo,
  dup_family_id: dup, variant_family_id: vfam, variant_type: vtype,
  promo_family_id: pfam, promo_role: prole, has_regular_anchor: anchor, anomaly_tags: tags,
});

export const DEMO_SILVER: DemoSku[] = [
  // ── Duplicate family 1: same coffee encoded 3 ways ──
  S('9000101','Kape Sinag 3in1 Original 20g','grocery food','beverages','coffee','coffee mixes','Kape Sinag','20g',false,'DUP-0000001','','','','','','AUTO_DUPLICATE'),
  S('9000102','KapeSinag 3-in-1 Original 20g','grocery food','beverages','coffee','coffee mixes','Kape Sinag','20g',false,'DUP-0000001','','','','','','AUTO_DUPLICATE'),
  S('9000103','KAPE SINAG 3IN1 ORIG 20G','grocery food','beverages','coffee','coffee mixes','Kape Sinag','20g',false,'DUP-0000001','','','','','','AUTO_DUPLICATE'),
  // ── Duplicate family 2: baby soap pair ──
  S('9000201','Bantay Bata Baby Soap 55g','grocery nonfood','personal care','bath','baby soap','Bantay Bata','55g',false,'DUP-0000002','','','','','','AUTO_DUPLICATE'),
  S('9000202','BantayBata BabySoap 55g','grocery nonfood','personal care','bath','baby soap','Bantay Bata','55g',false,'DUP-0000002','','','','','','AUTO_DUPLICATE'),
  // ── Duplicate family 3: sardines pair ──
  S('9000301','Isda Kusina Sardines Tomato 155g','grocery food','canned goods','canned fish','sardines','Isda Kusina','155g',false,'DUP-0000003','','','','','','AUTO_DUPLICATE'),
  S('9000302','ISDA KUSINA SARDINES TOMATO 155G','grocery food','canned goods','canned fish','sardines','Isda Kusina','155g',false,'DUP-0000003','','','','','','AUTO_DUPLICATE'),
  // ── Variant family 1 (SIZE): detergent ──
  S('9001101','Linis Labada Powder Detergent 500g','grocery nonfood','household','laundry','powder detergent','Linis Labada','500g',false,'','VAR-0000001','SIZE','','','','AUTO_VARIANT'),
  S('9001102','Linis Labada Powder Detergent 1kg','grocery nonfood','household','laundry','powder detergent','Linis Labada','1kg',false,'','VAR-0000001','SIZE','','','','AUTO_VARIANT'),
  S('9001103','Linis Labada Powder Detergent 2kg','grocery nonfood','household','laundry','powder detergent','Linis Labada','2kg',false,'','VAR-0000001','SIZE','','','','AUTO_VARIANT'),
  // ── Variant family 2 (FLAVOR): juice ──
  S('9001201','Tubig Prutas Juice Mango 1L','grocery food','beverages','juice','ready to drink','Tubig Prutas','1l',false,'','VAR-0000002','FLAVOR','','','','AUTO_VARIANT'),
  S('9001202','Tubig Prutas Juice Orange 1L','grocery food','beverages','juice','ready to drink','Tubig Prutas','1l',false,'','VAR-0000002','FLAVOR','','','','AUTO_VARIANT'),
  S('9001203','Tubig Prutas Juice Pineapple 1L','grocery food','beverages','juice','ready to drink','Tubig Prutas','1l',false,'','VAR-0000002','FLAVOR','','','','AUTO_VARIANT'),
  S('9001204','Tubig Prutas Juice Calamansi 1L','grocery food','beverages','juice','ready to drink','Tubig Prutas','1l',false,'','VAR-0000002','FLAVOR','','','','AUTO_VARIANT'),
  // ── Variant family 3 (COLOR/SCENT): dish liquid ──
  S('9001301','Hugas Plato Dish Liquid Green 250ml','grocery nonfood','household','dishwashing','dish liquid','Hugas Plato','250ml',false,'','VAR-0000003','COLOR','','','','AUTO_VARIANT'),
  S('9001302','Hugas Plato Dish Liquid Lemon 250ml','grocery nonfood','household','dishwashing','dish liquid','Hugas Plato','250ml',false,'','VAR-0000003','COLOR','','','','AUTO_VARIANT'),
  // ── Promo family 1: shampoo anchor + 2 promo SKUs ──
  S('9002101','Buhok Ganda Shampoo 180ml','grocery nonfood','personal care','hair care','shampoo','Buhok Ganda','180ml',false,'','','','PRM-0000001','REGULAR_ANCHOR','Y','PROMO_FAMILY_MEMBER'),
  S('9002102','Buhok Ganda Shampoo 180ml B1T1','grocery nonfood','personal care','hair care','shampoo','Buhok Ganda','180ml',true,'','','','PRM-0000001','PROMO_SKU','Y','PROMO_FAMILY_MEMBER'),
  S('9002103','Buhok Ganda Shampoo 180ml w/ Free Sabon','grocery nonfood','personal care','hair care','shampoo','Buhok Ganda','180ml',true,'','','','PRM-0000001','PROMO_SKU','Y','PROMO_FAMILY_MEMBER'),
  // ── Promo family 2: biscuit anchor + promo ──
  S('9002201','Masarap Biscuit Choco 10s','grocery food','snacks','biscuits','sandwich biscuits','Masarap','10s',false,'','','','PRM-0000002','REGULAR_ANCHOR','Y','PROMO_FAMILY_MEMBER'),
  S('9002202','Masarap Biscuit Choco 10s SaveP5','grocery food','snacks','biscuits','sandwich biscuits','Masarap','10s',true,'','','','PRM-0000002','PROMO_SKU','Y','PROMO_FAMILY_MEMBER'),
  // ── Promo orphan: no regular counterpart ──
  S('9002301','Tindahan Mix Holiday Bundle B1T1','grocery food','snacks','assorted','bundles','Tindahan Mix','',true,'','','','PRM-0000003','PROMO_SKU','N','PROMO_FAMILY_MEMBER'),
  // ── Clean unique sample ──
  S('9003001','Asukal Puti Refined Sugar 1kg','grocery food','baking','sugar','refined sugar','Asukal Puti','1kg',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003002','Bigas Ginto Jasmine Rice 5kg','grocery food','rice','rice','jasmine rice','Bigas Ginto','5kg',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003003','Mantika Gintuang Cooking Oil 1L','grocery food','cooking essentials','oil','cooking oil','Mantika Gintuang','1l',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003004','Gatas Bukid Fresh Milk 1L','grocery food','dairy','milk','fresh milk','Gatas Bukid','1l',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003005','Tinapay Bahay White Bread 450g','grocery food','bakery','bread','loaf bread','Tinapay Bahay','450g',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003006','Sabaw Sarap Chicken Broth Cubes 60g','grocery food','cooking essentials','seasoning','broth cubes','Sabaw Sarap','60g',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003007','Toyo Itim Soy Sauce 385ml','grocery food','condiments','sauces','soy sauce','Toyo Itim','385ml',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003008','Suka Asim Vinegar 385ml','grocery food','condiments','sauces','vinegar','Suka Asim','385ml',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003009','Panyo Bulak Facial Tissue 200s','grocery nonfood','paper goods','tissue','facial tissue','Panyo Bulak','200s',false,'','','','','','','CLEAN_UNIQUE'),
  S('9003010','Sipilyo Ngiti Toothbrush Soft 1s','grocery nonfood','personal care','oral care','toothbrush','Sipilyo Ngiti','1s',false,'','','','','','','CLEAN_UNIQUE'),
];

export const DEMO_EXCLUDED: DemoExcluded[] = [
  { sku_code: '9100001', description: 'P SKU', division: 'grocery food', anomaly_tag: 'FOR_REMOVAL', anomaly_remarks: 'P SKU — purged placeholder, for removal' },
  { sku_code: '9100002', description: 'P SKU', division: 'grocery nonfood', anomaly_tag: 'FOR_REMOVAL', anomaly_remarks: 'P SKU — purged placeholder, for removal' },
  { sku_code: '9100003', description: 'Assorted Item', division: 'others', anomaly_tag: 'FOR_RECLASSIFICATION', anomaly_remarks: 'Others bucket — no real hierarchy, for reclassification' },
  { sku_code: '9100004', description: 'GMD Item 12345', division: 'gmd', anomaly_tag: 'FOR_RECLASSIFICATION', anomaly_remarks: 'GMD bucket — no real hierarchy, for reclassification' },
  { sku_code: '9100005', description: '(empty)', division: 'grocery food', anomaly_tag: 'NULL_SKU_DESCRIPTION', anomaly_remarks: 'Null SKU description — cannot classify without description' },
  { sku_code: '9100006', description: 'Duplicate Code Item A', division: 'grocery food', anomaly_tag: 'FOR_RECLASSIFICATION', anomaly_remarks: 'Duplicate SKU code — same code appearing more than once' },
  { sku_code: '9100007', description: 'Mystery NonFood Item', division: 'grocery nonfood', anomaly_tag: 'FOR_RECLASSIFICATION', anomaly_remarks: 'Flagged for transfer to GMD — needs LCC reclassification' },
  { sku_code: '9100008', description: 'Unknown Gadget', division: 'grocery nonfood', anomaly_tag: 'FOR_RECLASSIFICATION', anomaly_remarks: 'Unidentified SKU — team unsure of correct classification' },
];

// ============================================================
// Resolution store — in-memory + sessionStorage so decisions
// survive navigating between Silver and Gold during the demo.
// ============================================================

export interface DemoResolution {
  family_id: string;
  family_type: 'DUP' | 'VARIANT' | 'PROMO';
  action: 'merge' | 'confirm_variants' | 'link_promo' | 'keep';
  canonical_sku_code?: string;
  excluded_members?: string[]; // SKU codes isolated out of this family — kept separate, treated as still-pending
  audit_note: string;
  resolved_by: string;
  resolved_at: string;
}

const STORE_KEY = 'lcc_demo_sku_resolutions';

function safeRead(): DemoResolution[] {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function safeWrite(rs: DemoResolution[]) {
  try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(rs)); } catch { /* in-memory only */ }
}

let _resolutions: DemoResolution[] = safeRead();

export function getResolutions(): DemoResolution[] { return [..._resolutions]; }

export function addResolution(r: DemoResolution) {
  _resolutions = [..._resolutions.filter(x => x.family_id !== r.family_id), r];
  safeWrite(_resolutions);
}

export function removeResolution(familyId: string) {
  _resolutions = _resolutions.filter(x => x.family_id !== familyId);
  safeWrite(_resolutions);
}

export function clearResolutions() {
  _resolutions = [];
  safeWrite(_resolutions);
}

// CSV export of current anomalies (for the Download anomalies CSV button)
export function anomaliesCsv(): string {
  const header = ['SKU_CODE','DESCRIPTION','DIVISION','CLASS','BRAND','ANOMALY_TAGS','FAMILY_ID','STATUS'];
  const res = new Set(getResolutions().map(r => r.family_id));
  const lines = DEMO_SILVER.filter(s => s.anomaly_tags !== 'CLEAN_UNIQUE').map(s => {
    const fid = s.dup_family_id || s.variant_family_id || s.promo_family_id;
    const status = fid && res.has(fid) ? 'RESOLVED' : 'FOR_REVIEW';
    return [s.sku_code, s.description, s.division, s.cls, s.brand, s.anomaly_tags, fid, status]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

// Gold derivation: silver minus merged-away duplicates
export function deriveGold() {
  const res = getResolutions();
  const merges = res.filter(r => r.action === 'merge' && r.canonical_sku_code);
  const mergedAway = new Set<string>();
  const mergedInto: Record<string, string> = {};
  for (const m of merges) {
    const excluded = new Set(m.excluded_members || []);
    for (const sku of DEMO_SILVER.filter(s => s.dup_family_id === m.family_id)) {
      if (excluded.has(sku.sku_code)) continue; // isolated — not part of this merge
      if (sku.sku_code !== m.canonical_sku_code) {
        mergedAway.add(sku.sku_code);
        mergedInto[sku.sku_code] = m.canonical_sku_code!;
      }
    }
  }
  const gold = DEMO_SILVER.filter(s => !mergedAway.has(s.sku_code));
  return { gold, mergedAway, mergedInto, resolutions: res };
}
