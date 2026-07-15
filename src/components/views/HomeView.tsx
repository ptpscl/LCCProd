import { ArrowRight } from 'lucide-react';

export default function HomeView() {
  return (
    <div className="max-w-[1000px] mx-auto space-y-12">
      <div className="text-center mt-4">
        <h2 className="text-[28px] font-bold text-text-main mb-2">LCC Data Console</h2>
        <p className="text-[15px] text-text-muted">
          A three-stage pipeline that turns raw uploads into clean, trustworthy data.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-8 border-t-[3px] border-t-bronze-accent">
          <h3 className="text-[18px] font-bold text-text-main mb-3">Bronze</h3>
          <p className="text-[14px] text-text-muted leading-relaxed">
            Raw & unvalidated. Exactly what was uploaded — nothing checked or changed yet. This is the permanent audit trail. The only action is uploading a new batch.
          </p>
        </div>

        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-8 border-t-[3px] border-t-silver-accent">
          <h3 className="text-[18px] font-bold text-text-main mb-3">Silver</h3>
          <p className="text-[14px] text-text-muted leading-relaxed">
            Validated. Data is checked against rules; flagged records (e.g. impossible birthdays, negative amounts) are reviewed and corrected here. Nothing is deleted — flags stay until a human resolves them.
          </p>
        </div>

        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-8 border-t-[3px] border-t-gold-accent">
          <h3 className="text-[18px] font-bold text-text-main mb-3">Gold</h3>
          <p className="text-[14px] text-text-muted leading-relaxed">
            Clean & trustworthy. Only records that passed validation or were corrected in Silver. Read-only by design — safe to extract and use.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-8 flex items-center justify-between overflow-x-auto text-[14px] font-medium text-text-main">
        <div className="flex items-center space-x-3 shrink-0">
          <span className="px-4 py-2 bg-brand-50 text-brand-600 rounded-full">Upload</span>
          <ArrowRight className="w-4 h-4 text-text-muted" />
        </div>
        
        <div className="flex items-center space-x-3 shrink-0">
          <span className="px-4 py-2 bg-bronze-bg rounded-full text-bronze-text">Bronze</span>
          <ArrowRight className="w-4 h-4 text-text-muted" />
        </div>
        
        <div className="flex items-center space-x-3 shrink-0 text-text-muted text-[13px]">
          <span>validate</span>
          <ArrowRight className="w-4 h-4 text-text-muted" />
        </div>
        
        <div className="flex items-center space-x-3 shrink-0">
          <span className="px-4 py-2 bg-silver-bg rounded-full text-silver-text">Silver</span>
          <ArrowRight className="w-4 h-4 text-text-muted" />
        </div>
        
        <div className="flex items-center space-x-3 shrink-0 text-text-muted text-[13px]">
          <span>promote</span>
          <ArrowRight className="w-4 h-4 text-text-muted" />
        </div>
        
        <div className="flex items-center space-x-3 shrink-0">
          <span className="px-4 py-2 bg-gold-bg rounded-full text-gold-text">Gold</span>
          <ArrowRight className="w-4 h-4 text-text-muted" />
        </div>
        
        <div className="flex items-center shrink-0">
          <span className="px-4 py-2 bg-brand-600 text-white rounded-full font-semibold">Extract</span>
        </div>
      </div>
    </div>
  );
}
