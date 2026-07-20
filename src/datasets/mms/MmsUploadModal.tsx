import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from 'lucide-react';

import { useAccess } from '../../governance/useAccess';
import { eventsService } from '../../services/eventsService';
import { EXPECTED_MMS_COLUMNS, validateMmsHeader } from './mmsSchema';
import { uploadMmsBatch } from './mmsService';

interface MmsUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
}

function headerError(headerLine: string): string | null {
  const validation = validateMmsHeader(headerLine);
  if (validation.ok) return null;

  const details: string[] = [];
  if (validation.missing.length) details.push(`Missing: ${validation.missing.join(', ')}`);
  if (validation.extra.length) details.push(`Extra: ${validation.extra.join(', ')}`);
  if (validation.duplicates.length) details.push(`Duplicate: ${validation.duplicates.join(', ')}`);
  if (validation.orderMismatch) {
    details.push(`Expected exact order: ${EXPECTED_MMS_COLUMNS.join(', ')}`);
  }
  return `Invalid MMS header. ${details.join(' | ')}`;
}

function safeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('Invalid MMS header.') || message === 'Only CSV files are supported.') {
    return message;
  }
  if (message.startsWith('MMS Storage upload failed:')) {
    return 'The CSV could not be uploaded to MMS Storage. Please try again.';
  }
  if (message.startsWith('MMS batch creation failed:')) {
    return 'The CSV uploaded, but its MMS batch could not be created. Please try again.';
  }
  if (message === 'MMS batch did not return uploaded status.') {
    return 'The MMS batch could not be confirmed as uploaded. Please refresh and try again.';
  }
  return 'The MMS upload could not be completed. Please try again.';
}

export default function MmsUploadModal({ isOpen, onClose, onSuccess }: MmsUploadModalProps) {
  const { currentUser } = useAccess();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen || uploading) return;
    setFiles([]);
    setError('');
    setSuccess('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isOpen, uploading]);

  if (!isOpen) return null;

  const updateFile = (index: number, update: Partial<UploadFile>) => {
    setFiles(previous => previous.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...update } : item
    )));
  };

  const handleUpload = async () => {
    if (uploading || !currentUser || !files.length) return;

    setUploading(true);
    setError('');
    setSuccess('');
    let allSucceeded = true;
    let anySucceeded = false;

    for (let index = 0; index < files.length; index += 1) {
      const selected = files[index];
      if (selected.status === 'success') continue;

      updateFile(index, { status: 'uploading', message: undefined });
      try {
        if (!selected.file.name.toLowerCase().endsWith('.csv')) {
          throw new Error('Only CSV files are supported.');
        }

        const headerLine = (await selected.file.slice(0, 4096).text()).split(/\r?\n/, 1)[0];
        const validationError = headerError(headerLine);
        if (validationError) throw new Error(validationError);

        const batch = await uploadMmsBatch(selected.file, currentUser.email);
        if (batch.status !== 'uploaded') {
          throw new Error('MMS batch did not return uploaded status.');
        }
        const formattedSize = selected.file.size < 1024 * 1024
          ? `${(selected.file.size / 1024).toFixed(1)} KB`
          : `${(selected.file.size / 1024 / 1024).toFixed(2)} MB`;

        try {
          await eventsService.logEvent({
            type: 'upload',
            dataset: 'mms-sales',
            detail: `Uploaded ${selected.file.name} (${formattedSize}), batch ${batch.id.slice(0, 8)}`,
            actor: currentUser.email,
          });
        } catch {
          console.warn('The MMS upload event could not be logged');
        }

        updateFile(index, {
          status: 'success',
          message: `Batch ${batch.id.slice(0, 8)} created with uploaded status.`,
        });
        anySucceeded = true;
      } catch (uploadError) {
        allSucceeded = false;
        updateFile(index, { status: 'error', message: safeUploadError(uploadError) });
      }
    }

    setUploading(false);
    if (anySucceeded) onSuccess();
    if (allSucceeded) {
      setSuccess('All MMS files were uploaded and registered successfully.');
    } else {
      setError('Some MMS files could not be uploaded. Successful files were kept.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[12px] shadow-lg w-full max-w-[600px] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border-subtle shrink-0">
          <h3 className="text-[18px] font-semibold text-text-main">Upload to MMS Sales</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close MMS upload"
            className="text-text-muted hover:text-text-main transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {!success && (
            <div>
              <label className="block text-[13px] font-medium text-text-main mb-1.5">Choose CSV Files</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                disabled={uploading}
                onChange={event => {
                  const selected = Array.from(event.target.files || []).map(file => ({
                    file,
                    status: 'pending' as const,
                  }));
                  setFiles(previous => [...previous, ...selected]);
                  event.target.value = '';
                }}
                className="w-full text-[13px] text-text-muted cursor-pointer disabled:opacity-50 file:mr-4 file:py-2 file:px-4 file:rounded-[8px] file:border-0 file:text-[13px] file:font-semibold file:bg-surface-bg file:text-text-main file:cursor-pointer hover:file:bg-border-subtle"
              />
              <p className="mt-2 text-[12px] text-text-muted">
                The exact MMS header is checked here. Source values are preserved in the Bronze layer for later anomaly checks.
              </p>
            </div>
          )}

          {!!files.length && (
            <div className="space-y-3">
              <h4 className="text-[13px] font-semibold text-text-main">Selected Files:</h4>
              {files.map((item, index) => (
                <div
                  key={`${item.file.name}-${item.file.size}-${index}`}
                  className="flex items-center bg-surface-bg border border-border-subtle p-3 rounded-[8px]"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-[13px] font-medium text-text-main truncate">{item.file.name}</p>
                    {item.message && (
                      <p className={`text-[12px] mt-1 ${item.status === 'error' ? 'text-error' : 'text-success'}`}>
                        {item.message}
                      </p>
                    )}
                  </div>
                  {item.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => setFiles(previous => previous.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={uploading}
                      aria-label={`Remove ${item.file.name}`}
                      className="text-text-muted hover:text-error disabled:opacity-50 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {item.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}
                  {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {item.status === 'error' && <AlertCircle className="w-4 h-4 text-error" />}
                </div>
              ))}
            </div>
          )}

          {!success && !!files.length && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="w-full flex items-center justify-center h-10 bg-brand-600 text-white rounded-[8px] text-[13px] font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? 'Uploading MMS files...' : 'Upload directly to Data Lake'}
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
