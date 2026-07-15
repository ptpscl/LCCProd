export const DATASETS = [
  { id: 'customer-database', label: 'Customer database' },
  { id: 'loyalty-sales', label: 'Loyalty sales' },
  { id: 'all-transactions', label: 'All transactions' },
  { id: 'sku-hierarchy', label: 'SKU hierarchy' },
] as const;

export const LAYERS = [
  { id: 'bronze', label: 'Bronze', accent: 'text-bronze-accent', tagText: 'text-bronze-text', tagBg: 'bg-bronze-bg', borderTop: 'border-t-bronze-accent' },
  { id: 'silver', label: 'Silver', accent: 'text-silver-accent', tagText: 'text-silver-text', tagBg: 'bg-silver-bg', borderTop: 'border-t-silver-accent' },
  { id: 'gold', label: 'Gold', accent: 'text-gold-accent', tagText: 'text-gold-text', tagBg: 'bg-gold-bg', borderTop: 'border-t-gold-accent' },
] as const;

export type DatasetId = typeof DATASETS[number]['id'];
export type LayerId = typeof LAYERS[number]['id'];
