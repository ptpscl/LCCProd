import { useState } from 'react';
import { authService } from '../authService';
import { governanceService } from '../../governance/governanceService';

interface CreateAccountProps {
  onAccountCreated: (email: string) => void;
  onNavigateToLogin: () => void;
}

export default function CreateAccount({ onAccountCreated, onNavigateToLogin }: CreateAccountProps) {
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('Category Manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setSubmitError('');

    if (!email.endsWith('@lcc.com.ph')) {
      setEmailError('Please use your LCC email (@lcc.com.ph)');
      isValid = false;
    }

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    } else if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsLoading(true);
    try {
      await authService.signUp({
        full_name: fullName,
        position: position,
        email: email,
      });
      governanceService._notifyAdminNewUser(fullName);
      onAccountCreated(email);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto bg-white rounded-[10px] border border-border-subtle shadow-subtle p-10">
      <div className="mb-6">
        <h2 className="text-[22px] font-semibold text-text-main mb-1">Create an account</h2>
        <p className="text-[14px] text-text-muted">Enter your details to request access to the Data Console.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="p-3 bg-error/10 border border-error/20 rounded-[8px] text-error text-[13px] font-medium">
            {submitError}
          </div>
        )}
        
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-text-main">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-bg border border-border-subtle rounded-[8px] text-[14px] text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition-colors"
            placeholder="Juan Dela Cruz"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-text-main">Position</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-bg border border-border-subtle rounded-[8px] text-[14px] text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition-colors cursor-pointer appearance-none"
            required
          >
            <option value="Category Manager">Category Manager</option>
            <option value="Buyer">Buyer</option>
            <option value="Data Analyst">Data Analyst</option>
            <option value="Data Admin">Data Admin</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-text-main">LCC Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
            className={`w-full px-4 py-2.5 bg-surface-bg border ${emailError ? 'border-error/60 focus:border-error focus:ring-error/20' : 'border-border-subtle focus:border-brand-600 focus:ring-brand-600/20'} rounded-[8px] text-[14px] text-text-main focus:outline-none focus:ring-2 transition-colors`}
            placeholder="name@lcc.com.ph"
            required
          />
          {emailError && <p className="text-[12px] text-error mt-1">{emailError}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-text-main">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
            className={`w-full px-4 py-2.5 bg-surface-bg border ${passwordError ? 'border-error/60 focus:border-error focus:ring-error/20' : 'border-border-subtle focus:border-brand-600 focus:ring-brand-600/20'} rounded-[8px] text-[14px] text-text-main focus:outline-none focus:ring-2 transition-colors`}
            placeholder="••••••••"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-text-main">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
            className={`w-full px-4 py-2.5 bg-surface-bg border ${passwordError ? 'border-error/60 focus:border-error focus:ring-error/20' : 'border-border-subtle focus:border-brand-600 focus:ring-brand-600/20'} rounded-[8px] text-[14px] text-text-main focus:outline-none focus:ring-2 transition-colors`}
            placeholder="••••••••"
            required
          />
          {passwordError && <p className="text-[12px] text-error mt-1">{passwordError}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-brand-600 text-white text-[14px] font-semibold rounded-[8px] hover:bg-brand-700 transition-colors disabled:opacity-70 mt-4 cursor-pointer"
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-border-subtle text-center">
        <p className="text-[14px] text-text-muted">
          Already have an account?{' '}
          <button
            onClick={onNavigateToLogin}
            className="text-brand-600 font-medium hover:text-brand-700 hover:underline cursor-pointer transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
