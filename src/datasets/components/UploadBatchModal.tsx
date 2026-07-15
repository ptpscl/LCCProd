import { useState } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { bronzeService } from '../bronzeService';
import { useAccess } from '../../governance/useAccess';

interface UploadBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STORES = [
  { code: 'LEG-001', name: 'LCC Legazpi' },
  { code: 'NAG-001', name: 'LCC Naga' },
  { code: 'TAB-001', name: 'LCC Tabaco' },
  { code: 'SOR-001', name: 'LCC Sorsogon' },
  { code: 'DAE-001', name: 'LCC Daet' },
];

const STAGES = [
  'Uploading raw file...',
  'Normalizing key fields...',
  'Converting to Parquet (partitioned by store/year/month)...',
  'Stitching this store-month...',
  'Registering batch...'
];

export default function UploadBatchModal({ isOpen, onClose, onSuccess }: UploadBatchModalProps) {
  const { currentUser } = useAccess();
  const [storeCode, setStoreCode] = useState('');
  const [month, setMonth] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: import('react').ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!storeCode || !month || !file || !currentUser) return;
    
    setIsUploading(true);
    setError('');
    setSuccess('');
    setCompletedStages([]);
    
    try {
      await bronzeService.uploadBatch({
        storeCode,
        month,
        file,
        uploadedBy: currentUser.full_name,
        onProgress: (stage) => {
          setCurrentStage(stage);
          setCompletedStages(prev => {
            const index = STAGES.indexOf(stage);
            if (index > 0) {
              const previousStage = STAGES[index - 1];
              if (!prev.includes(previousStage)) {
                return [...prev, previousStage];
              }
            }
            return prev;
          });
        }
      });
      
      setCompletedStages([...STAGES]);
      setCurrentStage('');
      setSuccess(`Batch uploaded — ${STORES.find(s => s.code === storeCode)?.name}, ${month}`);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const isFormValid = storeCode && month && file;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-[12px] shadow-lg w-full max-w-[500px] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h3 className="text-[18px] font-semibold text-text-main">Upload new batch</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          {!isUploading && !success && !error && (
            <>
              <div>
                <label className="block text-[13px] font-medium text-text-main mb-1.5">Store</label>
                <select
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-border-subtle rounded-[8px] text-[13px] text-text-main hover:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                >
                  <option value="">Select a store...</option>
                  {STORES.map(s => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-[13px] font-medium text-text-main mb-1.5">Month</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-border-subtle rounded-[8px] text-[13px] text-text-main hover:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-text-main mb-1.5">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full text-[13px] text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-[8px] file:border-0 file:text-[13px] file:font-semibold file:bg-surface-bg file:text-text-main hover:file:bg-border-subtle file:cursor-pointer"
                />
              </div>

              <div className="bg-surface-bg rounded-[8px] p-4 text-[13px] text-text-muted">
                One file = one store-month. Stored raw for audit, then converted to Parquet for fast processing.
              </div>

              <button
                onClick={handleUpload}
                disabled={!isFormValid}
                className="w-full flex items-center justify-center h-10 bg-brand-600 text-white rounded-[8px] text-[13px] font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload batch
              </button>
            </>
          )}

          {(isUploading || success) && (
            <div className="space-y-4">
              <div className="space-y-3">
                {STAGES.map((stage, i) => {
                  const isCompleted = completedStages.includes(stage);
                  const isCurrent = currentStage === stage;
                  const isPending = !isCompleted && !isCurrent;
                  
                  return (
                    <div key={stage} className={`flex items-center text-[13px] ${isPending ? 'text-text-muted opacity-50' : 'text-text-main'}`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 mr-3 text-success shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 mr-3 text-brand-600 shrink-0 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 mr-3 rounded-full border border-border-subtle shrink-0" />
                      )}
                      <span>{stage}</span>
                    </div>
                  );
                })}
              </div>
              
              {success && (
                <div className="mt-6 bg-success/10 border border-success/20 rounded-[8px] p-4 flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-success mr-3 shrink-0" />
                  <p className="text-[13px] font-medium text-success">{success}</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-error/10 border border-error/20 rounded-[8px] p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-error mr-3 shrink-0" />
              <p className="text-[13px] font-medium text-error">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
