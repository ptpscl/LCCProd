import { useEffect, useState } from 'react';
import { LoyaltyBatch, listLoyaltyBatches } from './loyaltyService';

export default function LoyaltyBronzeView({ refreshTrigger }: { refreshTrigger: number }) {
  const [batches, setBatches] = useState<LoyaltyBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true);
      try {
        const data = await listLoyaltyBatches();
        setBatches(data);
      } catch (error) {
        console.error("Error fetching loyalty batches:", error);
      }
      setLoading(false);
    };
    fetchBatches();
  }, [refreshTrigger]);

  const totalBatches = batches.length;
  const totalRows = batches.reduce((sum, b) => sum + (b.row_count || 0), 0);
  const totalSizeBytes = batches.reduce((sum, b) => sum + (b.file_size_bytes || 0), 0);
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formattedTotalSize = formatSize(totalSizeBytes);

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
          <p className="text-[28px] font-bold text-text-main">{loading ? '-' : formattedTotalSize}</p>
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
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">File Name</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Rows</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Uploaded By</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[13px] text-text-muted">Loading batches...</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[13px] text-text-muted">No batches uploaded yet.</td>
                </tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id} className="hover:bg-surface-bg transition-colors">
                    <td className="px-6 py-4 text-[13px] font-medium text-text-main whitespace-nowrap">
                      {b.file_name}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                      {b.row_count != null ? b.row_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">
                      {formatSize(b.file_size_bytes || 0)}
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
      
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle">
          <h3 className="text-[16px] font-semibold text-text-main">Schema</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Column</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">DATE</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Transaction date</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">TRANSACTION NUMBER</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Unique identifier for the transaction</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">REGISTER NUMBER</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Register POS ID</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">STORE CODE</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Store identifier code</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">STORE CATEGORIZATION</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Category of the store</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">CUSTOMER NUMBER</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Loyalty customer ID</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">SKU CODE</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Product SKU identifier</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">TRANSACTION TYPE</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Type of transaction</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">LOYALTY SALES</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Amount of loyalty sales</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">QTY SOLD</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Quantity of product sold</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
