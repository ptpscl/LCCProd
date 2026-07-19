import { useEffect, useState } from 'react';
import { bronzeService, BronzeBatch } from '../bronzeService';
import LoyaltyBronzeView from '../loyalty/LoyaltyBronzeView';
import SkuBronzeView from '../sku/SkuBronzeView';
import CustomerBronzeView from '../customer/CustomerBronzeView';

function DefaultBronzeView({ datasetId, refreshTrigger }: { datasetId: string, refreshTrigger: number }) {
  const [batches, setBatches] = useState<BronzeBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true);
      const data = await bronzeService.listBatches();
      setBatches(data);
      setLoading(false);
    };
    fetchBatches();
  }, [datasetId, refreshTrigger]);

  const totalBatches = batches.length;
  const totalRows = batches.reduce((sum, b) => sum + (b.row_count || 0), 0);
  const totalSize = "24.5 MB"; // Placeholder

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
          <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Total Batches</h3>
          <p className="text-[28px] font-bold text-text-main">{loading ? '-' : totalBatches}</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
          <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Total Rows</h3>
          <p className="text-[28px] font-bold text-text-main">{loading ? '-' : totalRows.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
          <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Storage Size</h3>
          <p className="text-[28px] font-bold text-text-main">{loading ? '-' : totalSize}</p>
        </div>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-text-main">Recent batches</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Batch ID</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Store</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Month</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Rows</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Uploaded By</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">Loading batches...</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">No batches uploaded yet.</td>
                </tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id} className="hover:bg-surface-bg transition-colors">
                    <td className="px-6 py-4 text-[13px] font-mono text-text-muted whitespace-nowrap">
                      {b.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-[13px] font-medium text-text-main whitespace-nowrap">
                      {b.store_code}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                      {b.month}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                      {b.row_count ? b.row_count.toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                      {b.uploaded_by}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6 text-center">
        <h3 className="text-[16px] font-semibold text-text-main mb-2">Schema</h3>
        <p className="text-[14px] text-text-muted">
          Static mock per dataset will be shown here.
        </p>
      </div>
    </div>
  );
}

export default function BronzeView({ datasetId, refreshTrigger }: { datasetId: string, refreshTrigger: number }) {
  if (datasetId === 'customer-database') {
    return <CustomerBronzeView refreshTrigger={refreshTrigger} />;
  }
  if (datasetId === 'loyalty-sales') {
    return <LoyaltyBronzeView refreshTrigger={refreshTrigger} />;
  }
  if (datasetId === 'sku-hierarchy') {
    return <SkuBronzeView refreshTrigger={refreshTrigger} />;
  }
  return <DefaultBronzeView datasetId={datasetId} refreshTrigger={refreshTrigger} />;
}
