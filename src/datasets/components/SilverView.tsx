import SkuSilverView from '../sku/SkuSilverView';
import CustomerSilverView from '../customer/CustomerSilverView';
import MmsSilverView from '../mms/MmsSilverView';
import StageBSilverView from '../stageB/StageBSilverView';

export default function SilverView({ datasetId }: { datasetId: string }) {
  if (datasetId === 'customer-database') return <CustomerSilverView />;
  if (datasetId === 'sku-hierarchy') {
    return <SkuSilverView />;
  }
  if (datasetId === 'mms-sales') {
    return <MmsSilverView />;
  }
  if (datasetId === 'stage-b') {
    return <StageBSilverView />;
  }
  return (
    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-12 flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-silver-bg rounded-full flex items-center justify-center mb-6">
        <span className="text-silver-accent font-bold text-[24px]">S</span>
      </div>
      <h3 className="text-[16px] font-semibold text-text-main mb-2">Silver Layer</h3>
      <p className="text-[14px] text-text-muted max-w-[400px]">
        This layer will be built next. It will display validated data with flagged records for human review and correction.
      </p>
    </div>
  );
}
