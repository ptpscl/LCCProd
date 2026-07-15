import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { governanceService } from '../governanceService';
import { AppNotification } from '../types';
import { useAccess } from '../useAccess';

export default function NotificationsMenu() {
  const { currentUser } = useAccess();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchNotifs = async () => {
      const notifs = await governanceService.listNotifications(currentUser.id, currentUser.role);
      setNotifications(notifs);
    };

    fetchNotifs();
    const unsubscribe = governanceService.subscribe(fetchNotifs);
    return unsubscribe;
  }, [currentUser]);

  if (!currentUser) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToggle = () => {
    if (!isOpen && unreadCount > 0) {
      governanceService.markNotificationsRead(currentUser.id, currentUser.role);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button 
        onClick={handleToggle}
        className="relative p-2 text-text-muted hover:text-text-main transition-colors rounded-full hover:bg-surface-bg cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 w-2 h-2 bg-error rounded-full" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-[10px] border border-border-subtle shadow-subtle z-50 overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-bg">
              <h3 className="text-[14px] font-semibold text-text-main">Notifications</h3>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-text-muted">
                  No notifications yet.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {notifications.map(notif => (
                    <div key={notif.id} className={`p-4 ${notif.read ? 'bg-white' : 'bg-brand-50/50'}`}>
                      <h4 className="text-[13px] font-semibold text-text-main mb-1">{notif.title}</h4>
                      <p className="text-[13px] text-text-muted leading-snug">{notif.message}</p>
                      <span className="text-[11px] text-text-muted/70 mt-2 block">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
