import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from 'lucide-react';

import { useAccess } from '../../governance/useAccess';
import { validateCustomerHeader } from './customerSchema';
import { uploadCustomerBatch } from './customerService';

interface Props { isOpen: boolean; onClose: () => void; onSuccess: () => void }
type UploadFile = { file: File; status: 'pending' | 'uploading' | 'success' | 'error'; message?: string };

export default function CustomerUploadModal({ isOpen, onClose, onSuccess }: Props) {
  const { currentUser } = useAccess();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const upload = async () => {
    if (!currentUser) return;
    setUploading(true);
    let succeeded = true;
    for (let index = 0; index < files.length; index += 1) {
      if (files[index].status === 'success') continue;
      setFiles(value => value.map((item, i) => i === index ? { ...item, status: 'uploading' } : item));
      try {
        const firstLine = (await files[index].file.slice(0, 4096).text()).split(/\r?\n/)[0];
        const validation = validateCustomerHeader(firstLine);
        if (!validation.ok) {
          throw new Error(`Invalid schema. Missing: ${validation.missing.join(', ') || 'none'}; Extra: ${validation.extra.join(', ') || 'none'}`);
        }
        const batch = await uploadCustomerBatch(files[index].file, currentUser.email);
        setFiles(value => value.map((item, i) => i === index ? { ...item, status: 'success', message: `${batch.row_count ?? 0} rows ingested` } : item));
      } catch (error: any) {
        succeeded = false;
        setFiles(value => value.map((item, i) => i === index ? { ...item, status: 'error', message: error.message || 'Failed' } : item));
      }
    }
    setUploading(false);
    if (succeeded) onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[12px] shadow-lg w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between p-6 border-b border-border-subtle">
          <div><h3 className="text-[18px] font-semibold">Upload Customer Database</h3><p className="text-[12px] text-text-muted mt-1">Files are validated and ingested automatically.</p></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <input type="file" accept=".csv,.tsv" multiple disabled={uploading} onChange={event => {
            const selected = Array.from(event.target.files || []).map(file => ({ file, status: 'pending' as const }));
            setFiles(value => [...value, ...selected]);
          }} className="w-full text-[13px]" />
          {files.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="flex items-center gap-3 border border-border-subtle rounded-[8px] p-3">
              <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{item.file.name}</p>{item.message && <p className={`text-[12px] mt-1 ${item.status === 'error' ? 'text-error' : 'text-success'}`}>{item.message}</p>}</div>
              {item.status === 'pending' && <button onClick={() => setFiles(value => value.filter((_, i) => i !== index))}><X className="w-4 h-4" /></button>}
              {item.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
              {item.status === 'error' && <AlertCircle className="w-4 h-4 text-error" />}
            </div>
          ))}
          <button disabled={!files.length || uploading} onClick={upload} className="w-full h-10 flex items-center justify-center bg-brand-600 text-white rounded-[8px] disabled:opacity-50">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Upload and ingest
          </button>
        </div>
      </div>
    </div>
  );
}
