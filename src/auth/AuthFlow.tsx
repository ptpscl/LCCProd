import { useState, useEffect } from 'react';
import Login from './components/Login';
import CreateAccount from './components/CreateAccount';
import CheckEmail from './components/CheckEmail';
import VerificationSuccess from './components/VerificationSuccess';
import { authService } from './authService';
import { UserAccount } from './types';

type AuthStep = 'login' | 'signup' | 'check-email' | 'verification-success';

interface AuthFlowProps {
  onAuthenticated: (user: UserAccount) => void;
}

export default function AuthFlow({ onAuthenticated }: AuthFlowProps) {
  const [step, setStep] = useState<AuthStep>('login');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  
  // Try to load current user on mount (if persisted)
  useEffect(() => {
    authService.getCurrentUser().then(user => {
      if (user) onAuthenticated(user);
    });
  }, [onAuthenticated]);

  const handleLoginSuccess = async () => {
    const user = await authService.getCurrentUser();
    if (user) {
      onAuthenticated(user);
    }
  };

  const handleAccountCreated = (email: string) => {
    setRegisteredEmail(email);
    setStep('check-email');
  };

  const handleVerificationSuccess = () => {
    setStep('verification-success');
  };

  const handleProceedToLogin = () => {
    setLoginMessage('Email verified successfully! You can now sign in.');
    setStep('login');
  };

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
      {step === 'login' && (
        <Login 
          onLoginSuccess={handleLoginSuccess}
          onNavigateToSignUp={() => { setStep('signup'); setLoginMessage(''); }}
          initialMessage={loginMessage}
        />
      )}
      
      {step === 'signup' && (
        <CreateAccount 
          onAccountCreated={handleAccountCreated}
          onNavigateToLogin={() => setStep('login')}
        />
      )}
      
      {step === 'check-email' && (
        <CheckEmail 
          email={registeredEmail}
          onVerificationSuccess={handleVerificationSuccess}
          onNavigateToLogin={() => setStep('login')}
        />
      )}

      {step === 'verification-success' && (
        <VerificationSuccess 
          onProceed={handleProceedToLogin}
        />
      )}
    </div>
  );
}
