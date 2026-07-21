import { ViewType } from '../types';
import AccessChip from '../governance/components/AccessChip';
import NotificationsMenu from '../governance/components/NotificationsMenu';
import { DATASETS, LAYERS } from '../config/datasets';
import { useAccess } from '../governance/useAccess';
import { Upload } from 'lucide-react';

interface TopbarProps {
  currentView: string;
  onUploadClick?: () => void;
}

const viewTitles: Record<string, string> = {
  home: 'Home',
  jobs: 'Jobs',
  history: 'History',
  'access-requests': 'Access Requests'
};

export default function Topbar({ currentView, onUploadClick }: TopbarProps) {
  const { canEdit } = useAccess();
  let title = viewTitles[currentView] || '';
  let statusTag = null;
  let isBronze = false;

  if (currentView === 'gold/stage-b') {
    title = 'Gold / Stage B (Loyalty + Customer DB + MMS)';
    statusTag = (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-gold-bg text-gold-text">
        clean
      </span>
    );
  }

  if (currentView === 'silver/stage-b') {
    title = 'Silver / Stage B (Loyalty + Customer DB + MMS)';
    statusTag = (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-silver-bg text-silver-text">
        validated
      </span>
    );
  }

  if (currentView === 'silver/stage-a') {
    title = 'Silver / Stage A (Loyalty + Customer DB)';
    statusTag = <span className="px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-silver-bg text-silver-text">validated</span>;
  }

  if (!title && currentView.includes('/')) {
    const [layerId, datasetId] = currentView.split('/');
    isBronze = layerId === 'bronze';
    const layer = LAYERS.find(l => l.id === layerId);
    const dataset = DATASETS.find(d => d.id === datasetId);
    
    if (layer && dataset) {
      title = `${layer.label} / ${dataset.label}`;
      
      let tagText = '';
      if (layer.id === 'bronze') tagText = 'raw · unvalidated';
      else if (layer.id === 'silver') tagText = 'validated';
      else if (layer.id === 'gold') tagText = 'clean';

      statusTag = (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${layer.tagBg} ${layer.tagText}`}>
          {tagText}
        </span>
      );
    }
  }

  return (
    <header className="h-[64px] shrink-0 bg-white border-b border-border-subtle flex items-center justify-between px-8">
      <div className="flex items-center space-x-4">
        <h2 className="text-[20px] font-semibold text-text-main">
          {title}
        </h2>
        {statusTag}
        <AccessChip />
      </div>

      <div className="flex items-center space-x-6">
        {isBronze && (
          <div className="relative group">
            <button
              onClick={onUploadClick}
              disabled={!canEdit}
              className={`flex items-center h-9 px-4 rounded-full text-[13px] font-semibold transition-colors ${
                canEdit
                  ? 'bg-brand-600 text-white hover:bg-brand-700 cursor-pointer shadow-sm'
                  : 'bg-surface-bg text-text-muted border border-border-subtle opacity-60 cursor-not-allowed'
              }`}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload new batch
            </button>
            {!canEdit && (
              <div className="absolute top-full right-0 mt-2 hidden group-hover:block w-[200px] bg-gray-900 text-white text-[11px] font-medium p-2 rounded-[6px] shadow-lg text-center z-50">
                Request edit access to upload
              </div>
            )}
          </div>
        )}
        <NotificationsMenu />
      </div>
    </header>
  );
}
