import { useState } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAccess } from '../../governance/useAccess';
import { DATASETS } from '../../config/datasets';
import { supabase } from '../../auth/authService';

interface UploadBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadBatchModal({ isOpen, onClose, onSuccess }: UploadBatchModalProps) {
  const { currentUser } = useAccess();
  
  // Array of selected files and their assigned dataset
  const [files, setFiles] = useState<{ file: File; datasetId: string; status: 'pending' | 'uploading' | 'success' | 'error'; message?: string }[]>([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: import('react').ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        datasetId: DATASETS[0].id, // Default to first
        status: 'pending' as const
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateDataset = (index: number, datasetId: string) => {
    setFiles(prev => {
      const copy = [...prev];
      copy[index].datasetId = datasetId;
      return copy;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0 || !currentUser) return;
    
    setIsUploading(true);
    setError('');
    setSuccess('');
    
    let allSuccess = true;
    
    for (let i = 0; i < files.length; i++) {
      const current = files[i];
      if (current.status === 'success') continue;

      setFiles(prev => {
        const copy = [...prev];
        copy[i].status = 'uploading';
        return copy;
      });

      try {
        if (current.datasetId === 'loyalty-sales') {
          const fileName = current.file.name;
          const timestamp = new Date().getTime();
          const path = `loyalty-sales/${timestamp}_${fileName}`;
          
          const { error: uploadError } = await supabase.storage.from('bronze-raw').upload(path, current.file, { upsert: true });
          
          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          const { error: insertError } = await supabase.from('loyalty_batches').insert({
            file_name: fileName,
            file_path: path,
            file_size_bytes: current.file.size,
            uploaded_by: currentUser.email,
            status: 'uploaded',
            row_count: null
          });

          if (insertError) {
            throw new Error(`Database insert failed: ${insertError.message}`);
          }

          setFiles(prev => {
            const copy = [...prev];
            copy[i].status = 'success';
            copy[i].message = 'Success';
            return copy;
          });
        } else {
          const datasetMap: Record<string, string> = {
            'customer-database': 'customer',
            'mms-sales': 'mms',
            'sku-hierarchy': 'sku'
          };
          const endpointKey = datasetMap[current.datasetId];
          
          // For massive datasets, we must stream the file directly to the backend
          // by chunking it, to bypass Vercel/Cloud Run payload size limits.
          const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
          const totalChunks = Math.ceil(current.file.size / CHUNK_SIZE);
          const uploadId = crypto.randomUUID();
          let finalResult = null;

          for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, current.file.size);
            const chunk = current.file.slice(start, end);

            const formData = new FormData();
            formData.append('file', chunk, current.file.name);
            formData.append('chunkIndex', chunkIndex.toString());
            formData.append('totalChunks', totalChunks.toString());
            formData.append('uploadId', uploadId);

            const response = await fetch(`/api/bronze/${endpointKey}/upload`, {
              method: 'POST',
              body: formData
            });

            let result;
            try {
              const text = await response.text();
              try {
                result = JSON.parse(text);
              } catch (e) {
                throw new Error(`Upload failed. Server returned: ${text.substring(0, 100)}...`);
              }
            } catch (e: any) {
              throw new Error(e.message || 'Upload failed: Invalid server response');
            }

            if (!response.ok) {
              let errMsg = result.error || result.message || 'Upload failed';
              if (result.errors && result.errors.length > 0) {
                 errMsg += ' - ' + result.errors[0].error;
              }
              throw new Error(errMsg);
            }
            
            finalResult = result;
          }

          setFiles(prev => {
            const copy = [...prev];
            copy[i].status = 'success';
            copy[i].message = finalResult?.message || 'Success';
            return copy;
          });
        }
      } catch (err: any) {
        allSuccess = false;
        setFiles(prev => {
          const copy = [...prev];
          copy[i].status = 'error';
          copy[i].message = err.message || 'Failed';
          return copy;
        });
      }
    }
    
    setIsUploading(false);
    if (allSuccess) {
      setSuccess('All files successfully uploaded.');
      setTimeout(() => onSuccess(), 2000);
    } else {
      setError('Some files failed to upload.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[12px] shadow-lg w-full max-w-[600px] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border-subtle shrink-0">
          <h3 className="text-[18px] font-semibold text-text-main">Upload to Bronze Layer</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-5">
          {!isUploading && !success && (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-text-main mb-1.5">Choose CSV Files</label>
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={handleFileChange}
                  className="w-full text-[13px] text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-[8px] file:border-0 file:text-[13px] file:font-semibold file:bg-surface-bg file:text-text-main hover:file:bg-border-subtle file:cursor-pointer"
                />
                <p className="mt-2 text-[12px] text-text-muted">Select multiple files at once. Only CSV allowed.</p>
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[13px] font-semibold text-text-main">Selected Files:</h4>
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-surface-bg border border-border-subtle p-3 rounded-[8px]">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-[13px] font-medium text-text-main truncate">{f.file.name}</p>
                    {f.status === 'error' && <p className="text-[12px] text-error mt-1">{f.message}</p>}
                    {f.status === 'success' && <p className="text-[12px] text-success mt-1">{f.message}</p>}
                  </div>
                  
                  {f.status === 'pending' && (
                    <div className="flex items-center space-x-3 shrink-0">
                      <select 
                        value={f.datasetId}
                        onChange={(e) => updateDataset(i, e.target.value)}
                        className="h-8 px-2 bg-white border border-border-subtle rounded-[6px] text-[12px] text-text-main"
                      >
                        {DATASETS.map(d => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                      </select>
                      <button onClick={() => removeFile(i)} className="text-text-muted hover:text-error cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {f.status === 'uploading' && <Loader2 className="w-4 h-4 text-brand-600 animate-spin shrink-0" />}
                  {f.status === 'success' && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                  {f.status === 'error' && <AlertCircle className="w-4 h-4 text-error shrink-0" />}
                </div>
              ))}
            </div>
          )}

          {!isUploading && !success && files.length > 0 && (
            <button
              onClick={handleUpload}
              className="w-full flex items-center justify-center h-10 bg-brand-600 text-white rounded-[8px] text-[13px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer mt-4"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload directly to Data Lake
            </button>
          )}

          {success && (
            <div className="bg-success/10 border border-success/20 rounded-[8px] p-4 flex items-start">
              <CheckCircle2 className="w-5 h-5 text-success mr-3 shrink-0" />
              <p className="text-[13px] font-medium text-success">{success}</p>
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
