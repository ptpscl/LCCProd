import CustomerGoldView from '../customer/CustomerGoldView';
import SkuGoldView from '../sku/SkuGoldView';
import LoyaltyGoldView from '../loyalty/LoyaltyGoldView';
import MmsGoldView from '../mms/MmsGoldView';
import StageBGoldView from '../stageB/StageBGoldView';

export default function GoldView({ datasetId }: { datasetId: string }) {
  if (datasetId === 'customer-database') return <CustomerGoldView />;
  if (datasetId === 'loyalty-sales') return <LoyaltyGoldView />;
  if (datasetId === 'mms-sales') return <MmsGoldView />;
  if (datasetId === 'stage-b') return <StageBGoldView />;
  if (datasetId === 'sku-hierarchy') return <SkuGoldView />;
  return (
    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-12 flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-gold-bg rounded-full flex items-center justify-center mb-6">
        <span className="text-gold-accent font-bold text-[24px]">G</span>
      </div>
      <h3 className="text-[16px] font-semibold text-text-main mb-2">Gold Layer</h3>
      <p className="text-[14px] text-text-muted max-w-[400px]">
        This layer will be built next. It will provide clean, trustworthy, read-only records ready for extraction.
      </p>
    </div>
  );
}
