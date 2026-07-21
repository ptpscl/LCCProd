import { Home, Layers, History, Users, LogOut, ChevronDown, ChevronRight, Workflow } from 'lucide-react';
import { ViewType } from '../types';
import { useAccess } from '../governance/useAccess';
import { governanceService } from '../governance/governanceService';
import { authService } from '../auth/authService';
import { useEffect, useState } from 'react';
import { DATASETS, LAYERS } from '../config/datasets';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { currentUser } = useAccess();
  const [pendingCount, setPendingCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    bronze: false,
    silver: false,
    gold: false,
  });

  useEffect(() => {
    if (currentUser?.role !== 'data_admin') return;
    
    const fetchCount = async () => {
      const p = await governanceService.listPendingRequests();
      setPendingCount(p.length);
    };

    fetchCount();
    const unsubscribe = governanceService.subscribe(fetchCount);
    return unsubscribe;
  }, [currentUser]);

  if (!currentUser) return null;

  const initials = currentUser.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderDatasetGroup = (layer: typeof LAYERS[number]) => {
    const isExpanded = expandedGroups[layer.id];
    
    return (
      <div key={layer.id} className="mb-1">
        <button
          onClick={() => toggleGroup(layer.id)}
          className="flex items-center justify-between w-full px-6 py-2.5 text-[14px] font-medium text-text-muted hover:bg-surface-bg hover:text-text-main transition-colors cursor-pointer"
        >
          <div className="flex items-center">
            <Layers className={`w-5 h-5 mr-3 ${layer.accent}`} />
            <span>{layer.label}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        
        {isExpanded && (
          <div className="pl-14 pr-6 py-1 space-y-1 bg-surface-bg/50">
            {DATASETS.map(dataset => {
              const viewId = `${layer.id}/${dataset.id}`;
              const isActive = currentView === viewId;
              return (
                <button
                  key={dataset.id}
                  onClick={() => onViewChange(viewId)}
                  className={`block w-full text-left py-1.5 text-[13px] transition-colors cursor-pointer ${
                    isActive 
                      ? 'text-brand-600 font-semibold' 
                      : 'text-text-muted hover:text-text-main font-medium'
                  }`}
                >
                  {dataset.label}
                </button>
              );
            })}
            {layer.id === 'silver' && (
              <>
              <div className="group relative">
                <button type="button" onClick={() => onViewChange('silver/stage-a')} className={`block w-full py-1.5 text-left text-[13px] transition-colors cursor-pointer ${currentView === 'silver/stage-a' ? 'text-brand-600 font-semibold' : 'text-text-muted hover:text-text-main font-medium'}`}>Stage A</button>
                <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-max max-w-[190px] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Loyalty + Customer DB</span>
              </div>
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => onViewChange('silver/stage-b')}
                  aria-describedby="stage-b-navigation-description"
                  className={`block w-full py-1.5 text-left text-[13px] transition-colors cursor-pointer ${
                    currentView === 'silver/stage-b'
                      ? 'text-brand-600 font-semibold'
                      : 'text-text-muted hover:text-text-main font-medium'
                  }`}
                >
                  Stage B
                </button>
                <span
                  id="stage-b-navigation-description"
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-max max-w-[190px] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-medium leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  Loyalty + Customer DB + MMS
                </span>
              </div>
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => onViewChange('silver/stage-c')}
                  aria-describedby="stage-c-navigation-description"
                  className={`block w-full py-1.5 text-left text-[13px] transition-colors cursor-pointer ${
                    currentView === 'silver/stage-c'
                      ? 'text-brand-600 font-semibold'
                      : 'text-text-muted hover:text-text-main font-medium'
                  }`}
                >
                  Stage C
                </button>
                <span
                  id="stage-c-navigation-description"
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-max max-w-[190px] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-medium leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  SKU Hierarchy + Loyalty/MMS Transactions
                </span>
              </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-[240px] bg-white border-r border-border-subtle flex flex-col h-full shrink-0">
      <div className="p-6 mb-2">
        <h1 className="text-[22px] font-bold text-brand-600 leading-tight">LCC</h1>
        <p className="text-[12px] text-text-muted uppercase tracking-wider">Data Console</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div>
          <button
            onClick={() => onViewChange('home')}
            className={`flex items-center w-full px-6 py-3 cursor-pointer transition-colors ${
              currentView === 'home'
                ? 'bg-brand-50 text-brand-600 border-l-[3px] border-brand-600'
                : 'text-text-muted hover:bg-surface-bg border-l-[3px] border-transparent'
            }`}
          >
            <Home className="w-5 h-5 mr-3" />
            <span className={`text-[14px] ${currentView === 'home' ? 'font-semibold' : 'font-medium'}`}>Home</span>
          </button>
        </div>

        <div className="mb-4">
          <button
            onClick={() => onViewChange('jobs')}
            className={`flex items-center w-full px-6 py-3 cursor-pointer transition-colors ${
              currentView === 'jobs'
                ? 'bg-brand-50 text-brand-600 border-l-[3px] border-brand-600'
                : 'text-text-muted hover:bg-surface-bg border-l-[3px] border-transparent'
            }`}
          >
            <Workflow className="w-5 h-5 mr-3" />
            <span className={`text-[14px] ${currentView === 'jobs' ? 'font-semibold' : 'font-medium'}`}>Jobs</span>
          </button>
        </div>

        <div className="mb-4">
          <div className="px-6 mb-2">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Layers</span>
          </div>
          {LAYERS.map(renderDatasetGroup)}
        </div>

        <div className="mb-4">
          <button
            onClick={() => onViewChange('history')}
            className={`flex items-center w-full px-6 py-3 cursor-pointer transition-colors ${
              currentView === 'history'
                ? 'bg-brand-50 text-brand-600 border-l-[3px] border-brand-600'
                : 'text-text-muted hover:bg-surface-bg border-l-[3px] border-transparent'
            }`}
          >
            <History className="w-5 h-5 mr-3" />
            <span className={`text-[14px] ${currentView === 'history' ? 'font-semibold' : 'font-medium'}`}>History</span>
          </button>

          {currentUser.role === 'data_admin' && (
            <button
              onClick={() => onViewChange('access-requests')}
              className={`flex items-center w-full px-6 py-3 cursor-pointer transition-colors ${
                currentView === 'access-requests'
                  ? 'bg-brand-50 text-brand-600 border-l-[3px] border-brand-600'
                  : 'text-text-muted hover:bg-surface-bg border-l-[3px] border-transparent'
              }`}
            >
              <Users className="w-5 h-5 mr-3" />
              <span className={`text-[14px] flex-1 text-left ${currentView === 'access-requests' ? 'font-semibold' : 'font-medium'}`}>
                Access Requests
              </span>
              {pendingCount > 0 && (
                <span className="bg-error text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-border-subtle">
        <div className="flex items-center p-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-[12px] font-bold mr-3 shrink-0">
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[13px] font-semibold text-text-main truncate">
              {currentUser.full_name}
            </p>
            <p className="text-[11px] text-text-muted truncate">
              {currentUser.position}
            </p>
          </div>
        </div>
        <button
          onClick={() => authService.signOut()}
          className="flex items-center w-full px-2 py-2 text-[13px] font-medium text-error hover:bg-error/10 rounded-[8px] transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Log out
        </button>
      </div>
    </aside>
  );
}
