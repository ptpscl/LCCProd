import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface VerificationSuccessProps {
  onProceed: () => void;
}

export default function VerificationSuccess({ onProceed }: VerificationSuccessProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onProceed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onProceed]);

  return (
    <div className="w-full max-w-[440px] mx-auto bg-white rounded-[10px] border border-border-subtle shadow-subtle p-12 flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="w-8 h-8 text-brand-600" />
      </div>
      
      <h2 className="text-[22px] font-semibold text-text-main mb-2">Verification Successful</h2>
      
      <p className="text-[14px] text-text-muted mb-8 leading-relaxed">
        Your email has been successfully verified. You can now access your account.
      </p>

      <button
        onClick={onProceed}
        className="w-full py-2.5 bg-brand-600 text-white text-[14px] font-semibold rounded-[8px] hover:bg-brand-700 transition-colors cursor-pointer"
      >
        Proceed to Login ({countdown}s)
      </button>
    </div>
  );
}
