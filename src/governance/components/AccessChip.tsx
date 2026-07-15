import { useState } from 'react';
import { useAccess } from '../useAccess';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export default function AccessChip() {
  const { currentUser, canEdit, editAccessStatus, requestEditAccess } = useAccess();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  if (!currentUser) return null;
  if (currentUser.role === 'data_admin') return null;

  const handleSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await requestEditAccess(reason);
      setIsModalOpen(false);
      setReason('');
      alert('Request sent to Data Admin');
    } catch (err) {
      console.error(err);
      alert('Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (canEdit) {
    return (
      <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-50 rounded-full border border-brand-600/20">
        <ShieldCheck className="w-4 h-4 text-brand-600" />
        <span className="text-[12px] font-semibold text-brand-600">Editor Access</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-warning/10 rounded-full border border-warning/20">
        <ShieldAlert className="w-4 h-4 text-warning" />
        <span className="text-[12px] font-semibold text-warning">
          {editAccessStatus === 'pending' ? 'Edit access — pending review' : 'Read-only access'}
        </span>
        {editAccessStatus !== 'pending' && (
          <>
            <span className="text-warning/40">|</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-[12px] font-bold text-warning hover:text-warning/80 transition-colors cursor-pointer"
            >
              Request edit access
            </button>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-text-main/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] shadow-subtle border border-border-subtle p-6 w-full max-w-[400px]">
            <h3 className="text-[18px] font-semibold text-text-main mb-2">Request Edit Access</h3>
            <p className="text-[13px] text-text-muted mb-4">
              Your request will be sent to the Data Admin for approval.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-text-main mb-1.5">Reason (Optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-[8px] text-[13px] text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition-colors resize-none h-24"
                  placeholder="Why do you need edit access?"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 text-white text-[13px] font-semibold rounded-[8px] hover:bg-brand-700 transition-colors disabled:opacity-70 cursor-pointer"
                >
                  {isSubmitting ? 'Sending...' : 'Send request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
