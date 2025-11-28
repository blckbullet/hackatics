import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';
import { Bell, X } from 'lucide-react';

type Notification = Database['public']['Tables']['notifications']['Row'];

export function NotificationBell() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (!profile) return;

    loadNotifications();

    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  const loadNotifications = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
      loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border z-50 max-h-[32rem] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Notificaciones</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Marcar todas como leídas
                  </button>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No hay notificaciones</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
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
