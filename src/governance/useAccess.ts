import { useState, useEffect } from 'react';
import { authService } from '../auth/authService';
import { governanceService } from './governanceService';

export function useAccess() {
  const [currentUser, setCurrentUser] = useState(authService._getAccounts().find(a => a.email === 'cm@lcc.com.ph')); // Initial will be updated by effect
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    // Initial fetch
    authService.getCurrentUser().then(user => {
      setCurrentUser(user);
      setCanEdit(user?.role === 'editor' || user?.role === 'data_admin');
    });

    // Subscribe to auth changes
    const unsubscribe = authService.subscribe(user => {
      setCurrentUser(user);
      setCanEdit(user?.role === 'editor' || user?.role === 'data_admin');
    });

    return unsubscribe;
  }, []);

  return {
    currentUser,
    canEdit,
    editAccessStatus: currentUser?.edit_access_status || 'none',
    requestEditAccess: governanceService.requestEditAccess
  };
}
