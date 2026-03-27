import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { markNotificationRead, markAllNotificationsRead } from '../api';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('ttp_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setLoading(false);
    if (!error) setNotifications(data || []);
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Realtime: listen for new notifications inserted
    const channel = supabase
      .channel('ttp_notifications_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ttp_notifications' },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ttp_notifications' },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => (n.id === payload.new.id ? payload.new : n))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = async (id) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return { notifications, loading, unreadCount, markRead, markAllRead, refetch: fetchNotifications };
}
