import { UserAccount } from './types';

// Mock in-memory storage for accounts
const mockAccounts: UserAccount[] = [
  {
    id: 'user-admin',
    full_name: 'System Admin',
    position: 'Data Admin',
    email: 'admin@lcc.com.ph',
    status: 'active',
    role: 'data_admin',
    edit_access_status: 'approved',
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-1',
    full_name: 'Category Manager',
    position: 'Category Manager',
    email: 'cm@lcc.com.ph',
    status: 'active',
    role: 'viewer',
    edit_access_status: 'none',
    created_at: new Date().toISOString(),
  }
];

let currentUser: UserAccount | null = null;
type AccountListener = (user: UserAccount | null) => void;
const listeners: Set<AccountListener> = new Set();

const notifyListeners = () => {
  listeners.forEach(l => l(currentUser));
};

export const authService = {
  // Event system to keep components in sync
  subscribe(listener: AccountListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // TODO: replace with Supabase Auth / Supabase DB
  async signUp(data: Omit<UserAccount, 'id' | 'status' | 'role' | 'edit_access_status' | 'created_at'>): Promise<UserAccount> {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network
    
    const existing = mockAccounts.find(a => a.email === data.email);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const newAccount: UserAccount = {
      ...data,
      id: `user-${Date.now()}`,
      status: 'pending',
      role: 'viewer',
      edit_access_status: 'none',
      created_at: new Date().toISOString(),
    };
    
    mockAccounts.push(newAccount);
    return newAccount;
  },

  // TODO: replace with Supabase Auth / Supabase DB
  async signIn(email: string, password: string): Promise<UserAccount> {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network
    
    const account = mockAccounts.find(a => a.email === email);
    if (!account) {
      throw new Error('Invalid email or password.');
    }
    if (account.status === 'pending') {
      throw new Error('Please verify your email address before signing in.');
    }
    
    // Accept any password for mock
    currentUser = account;
    notifyListeners();
    return account;
  },

  // TODO: replace with Supabase Auth / Supabase DB
  async verifyEmail(email: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const account = mockAccounts.find(a => a.email === email);
    if (account) {
      account.status = 'active';
    }
  },

  // TODO: replace with Supabase Auth / Supabase DB
  async getCurrentUser(): Promise<UserAccount | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return currentUser;
  },

  // TODO: replace with Supabase Auth / Supabase DB
  async signOut(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    currentUser = null;
    notifyListeners();
  },

  // Helpers for governance (internal/mock use)
  _getAccounts: () => mockAccounts,
  _updateUser: (id: string, updates: Partial<UserAccount>) => {
    const idx = mockAccounts.findIndex(a => a.id === id);
    if (idx > -1) {
      mockAccounts[idx] = { ...mockAccounts[idx], ...updates };
      if (currentUser?.id === id) {
        currentUser = mockAccounts[idx];
        notifyListeners();
      }
    }
  }
};
