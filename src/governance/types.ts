export interface AccessRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPosition: string;
  requestedAt: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  decidedAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string; // The user who receives it, or 'admin' for data admins
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}
