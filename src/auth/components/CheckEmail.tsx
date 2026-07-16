import { Mail } from 'lucide-react';
import { authService } from '../authService';
import { useState, FormEvent } from 'react';

interface CheckEmailProps {
  email: string;
  onNavigateToLogin: () => void;
  onVerificationSuccess: () => void;
}

export default function CheckEmail({ email, onNavigateToLogin, onVerificationSuccess }: CheckEmailProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the code.');
      return;
    }
    setError('');
    setIsVerifying(true);
    try {
      await authService.verifyOtp(email, otp.trim());
      onVerificationSuccess();
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto bg-white rounded-[10px] border border-border-subtle shadow-subtle p-12 flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-6">
        <Mail className="w-8 h-8 text-brand-600" />
      </div>
      
      <h2 className="text-[22px] font-semibold text-text-main mb-2">Check your email</h2>
      
      <p className="text-[14px] text-text-muted mb-8 leading-relaxed">
        We've sent an 8-digit verification code to <span className="font-medium text-text-main">{email}</span>. Enter it below to activate your account.
      </p>

      <form onSubmit={handleVerifyOtp} className="w-full flex flex-col space-y-4 mb-4">
        {error && (
          <div className="p-3 bg-error/10 border border-error/20 rounded-[8px] text-error text-[13px] font-medium text-left">
            {error}
          </div>
        )}
        <div className="space-y-1.5 text-left">
          <label className="block text-[13px] font-medium text-text-main">Verification Code</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => { setOtp(e.target.value); setError(''); }}
            className={`w-full px-4 py-2.5 bg-surface-bg border ${error ? 'border-error/60 focus:border-error focus:ring-error/20' : 'border-border-subtle focus:border-brand-600 focus:ring-brand-600/20'} rounded-[8px] text-[14px] text-text-main focus:outline-none focus:ring-2 transition-colors text-center tracking-widest font-mono text-lg`}
            placeholder="00000000"
            maxLength={8}
            required
          />
        </div>

        <button
          type="submit"
          disabled={isVerifying}
          className="w-full py-2.5 bg-brand-600 text-white text-[14px] font-semibold rounded-[8px] hover:bg-brand-700 transition-colors cursor-pointer disabled:opacity-70 mt-2"
        >
          {isVerifying ? 'Verifying...' : 'Verify Code'}
        </button>
      </form>

      <div className="flex flex-col space-y-3 w-full">
        <button
          onClick={onNavigateToLogin}
          type="button"
          className="w-full py-2.5 bg-white border border-border-subtle text-text-main text-[14px] font-medium rounded-[8px] hover:bg-surface-bg transition-colors cursor-pointer"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}
