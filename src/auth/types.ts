export type AccountStatus = 'pending' | 'active';
export type Role = 'viewer' | 'editor' | 'data_admin';
export type EditAccessStatus = 'none' | 'pending' | 'approved' | 'denied';

export interface UserAccount {
  id: string;
  full_name: string;
  position: string;
  email: string;
  status: AccountStatus;
  role: Role;
  edit_access_status: EditAccessStatus;
  created_at: string;
}

export interface AuthState {
  user: UserAccount | null;
  isLoading: boolean;
  error: string | null;
}
