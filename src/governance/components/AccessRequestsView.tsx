import { useState, useEffect } from 'react';
import { governanceService } from '../governanceService';
import { AccessRequest } from '../types';
import { ShieldCheck, XCircle } from 'lucide-react';

export default function AccessRequestsView() {
  const [pending, setPending] = useState<AccessRequest[]>([]);
  const [history, setHistory] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const [p, h] = await Promise.all([
      governanceService.listPendingRequests(),
      governanceService.listHistoryRequests()
    ]);
    setPending(p);
    setHistory(h);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = governanceService.subscribe(loadData);
    return unsubscribe;
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await governanceService.approveRequest(id);
    } catch (err) {
      console.error(err);
      alert('Failed to approve request');
    }
  };

  const handleDeny = async (id: string) => {
    try {
      await governanceService.denyRequest(id);
    } catch (err) {
      console.error(err);
      alert('Failed to deny request');
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-8">
      <div>
        <h2 className="text-[20px] font-semibold text-text-main mb-2">Access Requests</h2>
        <p className="text-[14px] text-text-muted">Manage edit permissions for Data Console users.</p>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle bg-surface-bg flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-text-main flex items-center">
            Pending Approval
            {pending.length > 0 && (
              <span className="ml-2 bg-error text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-text-muted text-[13px]">Loading requests...</div>
        ) : pending.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <ShieldCheck className="w-10 h-10 text-border-subtle mb-3" />
            <p className="text-[14px] text-text-muted font-medium">All caught up</p>
            <p className="text-[13px] text-text-muted mt-1">No pending access requests.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Requested On</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {pending.map(req => (
                  <tr key={req.id} className="hover:bg-surface-bg transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-[14px] font-medium text-text-main">{req.userName}</p>
                      <p className="text-[12px] text-text-muted">{req.userPosition} • {req.userEmail}</p>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-main">
                      {new Date(req.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] text-text-muted line-clamp-2 max-w-[300px]">
                        {req.reason || <span className="italic text-text-muted/60">No reason provided</span>}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleDeny(req.id)}
                        className="px-3 py-1.5 text-[13px] font-medium text-error hover:bg-error/10 rounded-[6px] transition-colors cursor-pointer"
                      >
                        Deny
                      </button>
                      <button
                        onClick={() => handleApprove(req.id)}
                        className="px-3 py-1.5 text-[13px] font-medium bg-success text-white hover:bg-success/90 rounded-[6px] transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h3 className="text-[14px] font-semibold text-text-main">Decision History</h3>
        </div>
        
        {history.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-[13px]">No decision history yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-border-subtle">
                {history.map(req => (
                  <tr key={req.id} className="hover:bg-surface-bg transition-colors">
                    <td className="px-6 py-4 w-1/3">
                      <p className="text-[13px] font-medium text-text-main">{req.userName}</p>
                      <p className="text-[12px] text-text-muted">{req.userEmail}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {req.status === 'approved' ? (
                          <ShieldCheck className="w-4 h-4 text-success" />
                        ) : (
                          <XCircle className="w-4 h-4 text-error" />
                        )}
                        <span className={`text-[13px] font-medium ${req.status === 'approved' ? 'text-success' : 'text-error'}`}>
                          {req.status === 'approved' ? 'Approved' : 'Denied'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[12px] text-text-muted text-right">
                      {req.decidedAt ? new Date(req.decidedAt).toLocaleDateString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
