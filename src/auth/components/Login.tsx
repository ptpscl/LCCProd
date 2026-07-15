import { useState } from 'react';
import { authService } from '../authService';

interface LoginProps {
  onLoginSuccess: () => void;
  onNavigateToSignUp: () => void;
}

export default function Login({ onLoginSuccess, onNavigateToSignUp }: LoginProps) {
  const [email, setEmail] = useState('cm@lcc.com.ph');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.signIn(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto bg-white rounded-[10px] border border-border-subtle shadow-subtle p-10">
      <div className="text-center mb-8">
        <h1 className="text-[28px] font-bold text-brand-600 leading-tight">LCC</h1>
        <p className="text-[14px] text-text-muted uppercase tracking-wider mt-1 font-medium">Data Console</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-error/10 border border-error/20 rounded-[8px] text-error text-[13px] font-medium">
            {error}
          </div>
        )}
        
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-text-main">LCC Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-bg border border-border-subtle rounded-[8px] text-[14px] text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition-colors"
            placeholder="name@lcc.com.ph"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-text-main">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-bg border border-border-subtle rounded-[8px] text-[14px] text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition-colors"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-brand-600 text-white text-[14px] font-semibold rounded-[8px] hover:bg-brand-700 transition-colors disabled:opacity-70 mt-2 cursor-pointer"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-border-subtle text-center">
        <p className="text-[14px] text-text-muted">
          Don't have an account?{' '}
          <button
            onClick={onNavigateToSignUp}
            className="text-brand-600 font-medium hover:text-brand-700 hover:underline cursor-pointer transition-colors"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
