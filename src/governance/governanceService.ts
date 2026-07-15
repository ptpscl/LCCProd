import { AccessRequest, AppNotification } from './types';
import { authService } from '../auth/authService';

let mockRequests: AccessRequest[] = [];
let mockNotifications: AppNotification[] = [];

type NotifyListener = () => void;
const listeners: Set<NotifyListener> = new Set();

const notifyListeners = () => {
  listeners.forEach(l => l());
};

export const governanceService = {
  subscribe(listener: NotifyListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // TODO: replace with Supabase
  async requestEditAccess(reason: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const newRequest: AccessRequest = {
      id: `req-${Date.now()}`,
      userId: user.id,
      userName: user.full_name,
      userEmail: user.email,
      userPosition: user.position,
      requestedAt: new Date().toISOString(),
      reason,
      status: 'pending',
    };

    mockRequests.push(newRequest);
    authService._updateUser(user.id, { edit_access_status: 'pending' });

    mockNotifications.push({
      id: `notif-${Date.now()}`,
      userId: 'admin',
      title: 'New Edit Access Request',
      message: `${user.full_name} (${user.position}) requested edit access.`,
      createdAt: new Date().toISOString(),
      read: false,
    });

    notifyListeners();
  },

  // TODO: replace with Supabase
  async listPendingRequests(): Promise<AccessRequest[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockRequests.filter(r => r.status === 'pending');
  },
  
  // TODO: replace with Supabase
  async listHistoryRequests(): Promise<AccessRequest[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockRequests.filter(r => r.status !== 'pending');
  },

  // TODO: replace with Supabase
  async approveRequest(requestId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const req = mockRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Request not found');

    req.status = 'approved';
    req.decidedAt = new Date().toISOString();
    authService._updateUser(req.userId, { role: 'editor', edit_access_status: 'approved' });

    mockNotifications.push({
      id: `notif-${Date.now()}`,
      userId: req.userId,
      title: 'Edit Access Approved',
      message: 'Your request for edit access has been approved.',
      createdAt: new Date().toISOString(),
      read: false,
    });

    notifyListeners();
  },

  // TODO: replace with Supabase
  async denyRequest(requestId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const req = mockRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Request not found');

    req.status = 'denied';
    req.decidedAt = new Date().toISOString();
    authService._updateUser(req.userId, { edit_access_status: 'denied' });

    mockNotifications.push({
      id: `notif-${Date.now()}`,
      userId: req.userId,
      title: 'Edit Access Denied',
      message: 'Your request for edit access has been denied.',
      createdAt: new Date().toISOString(),
      read: false,
    });

    notifyListeners();
  },

  // TODO: replace with Supabase
  async listNotifications(userId: string, role: string): Promise<AppNotification[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    // Data admins see 'admin' notifications
    if (role === 'data_admin') {
      return mockNotifications.filter(n => n.userId === 'admin' || n.userId === userId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    }
    return mockNotifications.filter(n => n.userId === userId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  },
  
  // TODO: replace with Supabase
  async markNotificationsRead(userId: string, role: string): Promise<void> {
    const notifs = await this.listNotifications(userId, role);
    notifs.forEach(n => n.read = true);
    notifyListeners();
  },
  
  // Method to allow other systems to generate notifications (e.g. signup)
  _notifyAdminNewUser(name: string) {
    mockNotifications.push({
      id: `notif-${Date.now()}`,
      userId: 'admin',
      title: 'New Account Created',
      message: `${name} — pending email verification.`,
      createdAt: new Date().toISOString(),
      read: false,
    });
    notifyListeners();
  }
};
