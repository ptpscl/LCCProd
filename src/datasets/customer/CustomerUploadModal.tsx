import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from 'lucide-react';

import { useAccess } from '../../governance/useAccess';
import { eventsService } from '../../services/eventsService';
import { validateCustomerHeader } from './customerSchema';
import { uploadCustomerBatch } from './customerService';

interface Props { isOpen: boolean; onClose: () => void; onSuccess: () => void }
interface UploadFile { file: File; status: 'pending' | 'uploading' | 'success' | 'error'; message?: string }

export default function CustomerUploadModal({ isOpen, onClose, onSuccess }: Props) {
  const { currentUser } = useAccess();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  if (!isOpen) return null;

  const updateFile = (index: number, update: Partial<UploadFile>) => {
    setFiles(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item));
  };

  const handleUpload = async () => {
    if (!currentUser || !files.length) return;
    setUploading(true);
    setError('');
    let allSucceeded = true;

    for (let index = 0; index < files.length; index += 1) {
      if (files[index].status === 'success') continue;
      updateFile(index, { status: 'uploading', message: undefined });
      try {
        const header = (await files[index].file.slice(0, 4096).text()).split(/\r?\n/)[0];
        const validation = validateCustomerHeader(header);
        if (!validation.ok) {
          const details: string[] = [];
          if (validation.missing.length) details.push(`Missing: ${validation.missing.join(', ')}`);
          if (validation.extra.length) details.push(`Extra: ${validation.extra.join(', ')}`);
          if (validation.duplicates.length) details.push(`Duplicate: ${validation.duplicates.join(', ')}`);
          throw new Error(`Invalid schema. ${details.join(' | ')}`);
        }
        const batch = await uploadCustomerBatch(files[index].file, currentUser.email);
        const formattedFileSize = files[index].file.size < 1024 * 1024
          ? `${(files[index].file.size / 1024).toFixed(1)} KB`
          : `${(files[index].file.size / 1024 / 1024).toFixed(2)} MB`;
        try {
          await eventsService.logEvent({
            type: 'upload',
            dataset: 'customer-database',
            detail: `Uploaded ${files[index].file.name} (${formattedFileSize}), batch ${batch.id.slice(0, 8)}`,
            actor: currentUser.email,
          });
        } catch (eventError) {
          console.error('Failed to log Customer upload event', eventError);
        }
        updateFile(index, { status: 'success', message: `Batch ${batch.id.slice(0, 8)} created.` });
      } catch (uploadError: any) {
        allSucceeded = false;
        updateFile(index, { status: 'error', message: uploadError.message || 'Upload failed' });
      }
    }
    setUploading(false);
    if (allSucceeded) {
      setSuccess('All Customer files uploaded successfully.');
      onSuccess();
    } else {
      setError('Some Customer files failed to upload.');
    }
  };

  return <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-[12px] shadow-lg w-full max-w-[600px] overflow-hidden flex flex-col max-h-[90vh]">
      <div className="flex items-center justify-between p-6 border-b border-border-subtle"><h3 className="text-[18px] font-semibold text-text-main">Upload to Customer Database</h3><button onClick={onClose} className="text-text-muted hover:text-text-main"><X className="w-5 h-5" /></button></div>
      <div className="p-6 overflow-y-auto space-y-5">
        {!uploading && !success && <div><label className="block text-[13px] font-medium text-text-main mb-1.5">Choose CSV Files</label><input type="file" accept=".csv,.tsv" multiple onChange={event => { const selected = Array.from(event.target.files || []).map(file => ({ file, status: 'pending' as const })); setFiles(previous => [...previous, ...selected]); event.target.value = ''; }} className="w-full text-[13px] text-text-muted cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-[8px] file:border-0 file:text-[13px] file:font-semibold file:bg-surface-bg file:text-text-main file:cursor-pointer hover:file:bg-border-subtle" /><p className="mt-2 text-[12px] text-text-muted">Basic headers are checked here; strict validation runs during ingestion.</p></div>}
        {!!files.length && <div className="space-y-3"><h4 className="text-[13px] font-semibold">Selected Files:</h4>{files.map((item, index) => <div key={`${item.file.name}-${index}`} className="flex items-center bg-surface-bg border border-border-subtle p-3 rounded-[8px]"><div className="flex-1 min-w-0 mr-4"><p className="text-[13px] font-medium truncate">{item.file.name}</p>{item.message && <p className={`text-[12px] mt-1 ${item.status === 'error' ? 'text-error' : 'text-success'}`}>{item.message}</p>}</div>{item.status === 'pending' && <button onClick={() => setFiles(previous => previous.filter((_, itemIndex) => itemIndex !== index))}><X className="w-4 h-4" /></button>}{item.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}{item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}{item.status === 'error' && <AlertCircle className="w-4 h-4 text-error" />}</div>)}</div>}
        {!uploading && !success && !!files.length && <button onClick={handleUpload} className="w-full flex items-center justify-center h-10 bg-brand-600 text-white rounded-[8px] text-[13px] font-semibold hover:bg-brand-700"><Upload className="w-4 h-4 mr-2" />Upload directly to Data Lake</button>}
        {success && <div className="bg-success/10 border border-success/20 rounded-[8px] p-4 flex"><CheckCircle2 className="w-5 h-5 text-success mr-3" /><p className="text-[13px] font-medium text-success">{success}</p></div>}
        {error && <div className="bg-error/10 border border-error/20 rounded-[8px] p-4 flex"><AlertCircle className="w-5 h-5 text-error mr-3" /><p className="text-[13px] font-medium text-error">{error}</p></div>}
      </div>
    </div>
  </div>;
}
