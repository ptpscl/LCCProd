import { Mail } from 'lucide-react';
import { authService } from '../authService';
import { useState } from 'react';

interface CheckEmailProps {
  email: string;
  onNavigateToLogin: () => void;
}

export default function CheckEmail({ email, onNavigateToLogin }: CheckEmailProps) {
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSimulateVerify = async () => {
    setIsVerifying(true);
    await authService.verifyEmail(email);
    setIsVerifying(false);
    alert('Email successfully verified (simulated). You can now sign in.');
    onNavigateToLogin();
  };

  return (
    <div className="w-full max-w-[440px] mx-auto bg-white rounded-[10px] border border-border-subtle shadow-subtle p-12 flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-6">
        <Mail className="w-8 h-8 text-brand-600" />
      </div>
      
      <h2 className="text-[22px] font-semibold text-text-main mb-2">Check your email</h2>
      
      <p className="text-[14px] text-text-muted mb-8 leading-relaxed">
        We've sent a verification link to <span className="font-medium text-text-main">{email}</span>. Click it to activate your account.
      </p>

      <div className="flex flex-col space-y-3 w-full">
        <button
          onClick={onNavigateToLogin}
          type="button"
          className="w-full py-2.5 bg-brand-600 text-white text-[14px] font-semibold rounded-[8px] hover:bg-brand-700 transition-colors cursor-pointer"
        >
          Back to login
        </button>
      </div>
      
      <div className="mt-8 pt-6 border-t border-border-subtle w-full text-center">
        <button
          onClick={handleSimulateVerify}
          disabled={isVerifying}
          className="text-[12px] text-text-muted hover:text-brand-600 transition-colors cursor-pointer disabled:opacity-50"
        >
          {isVerifying ? 'Verifying...' : '[Dev] Simulate email verified'}
        </button>
      </div>
    </div>
  );
}
