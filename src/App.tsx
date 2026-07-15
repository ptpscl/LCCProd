import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AuthFlow from './auth/AuthFlow';
import AccessRequestsView from './governance/components/AccessRequestsView';
import HomeView from './components/views/HomeView';
import HistoryView from './components/views/HistoryView';
import BronzeView from './datasets/components/BronzeView';
import SilverView from './datasets/components/SilverView';
import GoldView from './datasets/components/GoldView';
import UploadBatchModal from './datasets/components/UploadBatchModal';
import { UserAccount } from './auth/types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentView, setCurrentView] = useState<string>('home');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!currentUser) {
    return <AuthFlow onAuthenticated={setCurrentUser} />;
  }

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const renderContent = () => {
    if (currentView === 'home') return <HomeView />;
    if (currentView === 'history') return <HistoryView />;
    if (currentView === 'access-requests') return <AccessRequestsView />;

    if (currentView.includes('/')) {
      const [layerId, datasetId] = currentView.split('/');
      if (layerId === 'bronze') return <BronzeView datasetId={datasetId} refreshTrigger={refreshTrigger} />;
      if (layerId === 'silver') return <SilverView datasetId={datasetId} />;
      if (layerId === 'gold') return <GoldView datasetId={datasetId} />;
    }

    return null;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white font-sans text-text-main selection:bg-brand-50 selection:text-brand-600">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex flex-col flex-1 bg-surface-bg overflow-hidden">
        <Topbar currentView={currentView} onUploadClick={() => setIsUploadModalOpen(true)} />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[1200px] mx-auto w-full">
            {renderContent()}
          </div>
        </div>
      </main>
      <UploadBatchModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onSuccess={handleUploadSuccess} 
      />
    </div>
  );
}
