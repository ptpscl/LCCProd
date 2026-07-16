import { UserAccount } from './types';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL || (import.meta as any).env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta as any).env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

/*
  -- RUN THIS IN SUPABASE SQL EDITOR TO CREATE THE TABLE:
  CREATE TABLE users (
    id uuid references auth.users(id) on delete cascade not null primary key,
    full_name text not null,
    position text,
    email text unique not null,
    role text default 'viewer',
    edit_access_status text default 'none',
    status text default 'pending',
    created_at timestamptz default now()
  );

  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow all operations during pilot" ON users FOR ALL USING (true) WITH CHECK (true);
*/

export const ADMIN_EMAILS = [
  'rpascual.msds2026@aim.edu',
  'mdoria.msds2026@aim.edu',
  'linciso.msds2026@aim.edu',
  'mmoran.msds2026@aim.edu'
];
// TODO: these are temporary dev admins for testing — remove before client handoff, and move role assignment to Supabase (roles table + RLS) rather than a frontend constant, which is not a real security boundary.

// Still retaining mockAccounts for internal governance service mocks if any, but transitioning signUp/signIn to Supabase.
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

// Listen for magic link redirects or auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user?.email) {
    const { data } = await supabase.from('users').select('*').eq('email', session.user.email).maybeSingle();
    if (data) {
       if (data.status === 'pending') {
         await supabase.from('users').update({ status: 'active' }).eq('id', session.user.id);
         data.status = 'active';
       }
       currentUser = data as UserAccount;
       notifyListeners();
    }
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    notifyListeners();
  }
});

export const authService = {
  subscribe(listener: AccountListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async signUp(data: Omit<UserAccount, 'id' | 'status' | 'role' | 'edit_access_status' | 'created_at'>, password?: string): Promise<UserAccount> {
    const trimmedEmail = data.email.trim().toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(trimmedEmail);
    
    const role = isAdmin ? 'data_admin' : 'viewer';
    const edit_access_status = isAdmin ? 'approved' : 'none';
    const status = isAdmin ? 'active' : 'pending'; // Let admins jump right in for testing
    
    try {
      if (!password) throw new Error("Password is required for real sign up.");

      // Check if user already exists first to give an explicit error
      const { data: existingUser } = await supabase.from('users').select('id').eq('email', trimmedEmail).maybeSingle();
      if (existingUser) {
        throw new Error('An account with this email already exists.');
      }

      // 1. Sign up with Supabase Auth (This is what actually sends the verification email)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('An account with this email already exists.');
        }
        throw new Error(`Auth Error: ${authError.message}`);
      }
      
      const authUserId = authData.user?.id;
      if (!authUserId) throw new Error("Failed to create authentication session.");

      // 2. Insert the user's profile details into our public `users` table
      const { data: insertData, error: insertError } = await supabase.from('users').insert({
        id: authUserId,
        full_name: data.full_name,
        position: data.position,
        email: trimmedEmail,
        role: role,
        edit_access_status: edit_access_status,
        status: status
      }).select().single();

      if (insertError) {
        throw new Error(`Failed to save user profile: ${insertError.message}`);
      }

      return insertData as UserAccount;
    } catch (err: any) {
      if (err.message.includes('fetch')) {
         // Fallback to mock for local dev if Supabase is disconnected, so it doesn't hard block.
         const newAccount: UserAccount = {
           ...data,
           id: `user-${Date.now()}`,
           status,
           role,
           edit_access_status,
           created_at: new Date().toISOString(),
         };
         mockAccounts.push(newAccount);
         return newAccount;
      }
      throw err;
    }
  },

  async signIn(email: string, password?: string): Promise<UserAccount> {
    const trimmedEmail = email.trim().toLowerCase();
    
    try {
      if (!password) throw new Error("Password required.");

      // 1. Authenticate with Supabase Auth (Checks password & email verification status)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

      if (authError) {
        if (authError.message.includes('Email not confirmed')) {
           throw new Error('Please verify your email address before signing in. Check your inbox.');
        }
        throw new Error(`Invalid email or password.`);
      }

      // 2. Fetch their role and metadata from our `users` table
      const { data, error } = await supabase.from('users').select('*').eq('email', trimmedEmail).maybeSingle();
      
      if (error) {
        throw new Error(`Failed to load profile: ${error.message}`);
      }
      
      if (!data) {
        // Fallback check in mock for legacy testing
        const account = mockAccounts.find(a => a.email.toLowerCase() === trimmedEmail);
        if (!account) {
          throw new Error('Invalid email or password.');
        }
        if (account.status === 'pending') {
          throw new Error('Please verify your email address before signing in.');
        }
        currentUser = account;
        notifyListeners();
        return account;
      }

      // If Supabase let them log in, their email IS verified! 
      if (data.status === 'pending') {
         await supabase.from('users').update({ status: 'active' }).eq('id', authData.user.id);
         data.status = 'active';
      }

      currentUser = data as UserAccount;
      notifyListeners();
      return currentUser;
    } catch (err: any) {
      // Offline fallback
      const account = mockAccounts.find(a => a.email.toLowerCase() === trimmedEmail);
      if (account) {
        if (account.status === 'pending') {
          throw new Error('Please verify your email address before signing in.');
        }
        currentUser = account;
        notifyListeners();
        return account;
      }
      throw err;
    }
  },

  async verifyOtp(email: string, token: string): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Verify OTP using Supabase Auth
    const { error: authError } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token,
      type: 'signup',
    });

    if (authError) {
      throw new Error(`Verification failed: ${authError.message}`);
    }

    // After auth success, mark the user as active in our public table
    try {
      await supabase.from('users').update({ status: 'active' }).eq('email', trimmedEmail);
    } catch (err) {
      // Ignore if it fails here; they'll get fixed on login anyway
    }

    // Mock fallback
    const account = mockAccounts.find(a => a.email.toLowerCase() === trimmedEmail);
    if (account) {
      account.status = 'active';
    }
  },

  async verifyEmail(email: string): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase();
    try {
      await supabase.from('users').update({ status: 'active' }).eq('email', trimmedEmail);
    } catch (err) {
      // Ignore in mock
    }
    const account = mockAccounts.find(a => a.email.toLowerCase() === trimmedEmail);
    if (account) {
      account.status = 'active';
    }
  },

  async getCurrentUser(): Promise<UserAccount | null> {
    if (currentUser) return currentUser;

    // Check if there is an active session (e.g. from page reload or magic link redirect)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data } = await supabase.from('users').select('*').eq('email', session.user.email).maybeSingle();
        if (data) {
           if (data.status === 'pending') {
             await supabase.from('users').update({ status: 'active' }).eq('id', session.user.id);
             data.status = 'active';
           }
           currentUser = data as UserAccount;
           notifyListeners();
           return currentUser;
        }
      }
    } catch (err) {}

    return currentUser;
  },

  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (err) {}
    currentUser = null;
    notifyListeners();
  },

  // Helpers for governance (internal/mock use)
  _getAccounts: () => mockAccounts,
  _updateUser: async (id: string, updates: Partial<UserAccount>) => {
    // Attempt Supabase update
    try {
      await supabase.from('users').update(updates).eq('id', id);
    } catch (err) {}
    
    // Update mock just in case
    const idx = mockAccounts.findIndex(a => a.id === id);
    if (idx > -1) {
      mockAccounts[idx] = { ...mockAccounts[idx], ...updates };
    }
    
    if (currentUser?.id === id) {
      currentUser = { ...currentUser, ...updates };
      notifyListeners();
    }
  }
};
